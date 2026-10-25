-- Little Post: schema, row-level security and payment fulfilment.
-- Money is always integer cents. Run this once in the Supabase SQL editor (or `supabase db push`).

-- ---------- profiles ----------
create table public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	name text not null default '' check (char_length(name) <= 60),
	created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
	insert into public.profiles (id, name)
	values (new.id, left(coalesce(new.raw_user_meta_data ->> 'name', ''), 60))
	on conflict (id) do nothing;
	return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
	for each row execute function public.handle_new_user();

-- ---------- cards (the price lives here, never in the browser) ----------
create table public.cards (
	id text primary key,
	occasion text not null,
	title text not null,
	description text not null default '',
	image_url text not null,
	price_cents integer not null check (price_cents > 0),
	published boolean not null default true,
	created_at timestamptz not null default now()
);

-- ---------- orders ----------
create table public.orders (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete restrict,
	status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired')),
	currency text not null default 'eur' check (currency = 'eur'),
	total_cents integer not null check (total_cents > 0),
	stripe_session_id text unique,
	stripe_payment_intent text,
	created_at timestamptz not null default now(),
	paid_at timestamptz
);
create index orders_user_idx on public.orders (user_id, created_at desc);

create table public.order_items (
	id uuid primary key default gen_random_uuid(),
	order_id uuid not null references public.orders (id) on delete cascade,
	card_id text not null references public.cards (id),
	price_cents integer not null check (price_cents > 0),
	recipient_name text not null default '' check (char_length(recipient_name) <= 40),
	message text not null check (char_length(message) between 1 and 400),
	sender_name text not null default '' check (char_length(sender_name) <= 40),
	-- unguessable link token (two random UUIDs, ~244 bits). Only readable once the order is paid.
	share_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
	created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);

-- ---------- favourites and drafts ----------
create table public.favorites (
	user_id uuid not null references auth.users (id) on delete cascade,
	card_id text not null references public.cards (id) on delete cascade,
	created_at timestamptz not null default now(),
	primary key (user_id, card_id)
);

create table public.personalized_cards (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete cascade,
	card_id text not null references public.cards (id) on delete cascade,
	recipient_name text not null default '' check (char_length(recipient_name) <= 40),
	message text not null default '' check (char_length(message) <= 400),
	sender_name text not null default '' check (char_length(sender_name) <= 40),
	design jsonb not null default '{}'::jsonb,
	updated_at timestamptz not null default now()
);
create index drafts_user_idx on public.personalized_cards (user_id, updated_at desc);

-- keep a log of processed Stripe events (audit only; fulfilment is idempotent on its own)
create table public.stripe_events (
	id text primary key,
	type text not null,
	received_at timestamptz not null default now()
);

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.cards enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.favorites enable row level security;
alter table public.personalized_cards enable row level security;
alter table public.stripe_events enable row level security;   -- no policies: service role only

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "published cards are public" on public.cards for select to anon, authenticated using (published);

-- orders and items can be READ by their owner; nobody but the server can write them
create policy "own orders read" on public.orders for select to authenticated using (user_id = auth.uid());
create policy "own paid items read" on public.order_items for select to authenticated
	using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid() and o.status = 'paid'));

create policy "own favourites read" on public.favorites for select to authenticated using (user_id = auth.uid());
create policy "own favourites add" on public.favorites for insert to authenticated with check (user_id = auth.uid());
create policy "own favourites remove" on public.favorites for delete to authenticated using (user_id = auth.uid());

create policy "own drafts read" on public.personalized_cards for select to authenticated using (user_id = auth.uid());
create policy "own drafts add" on public.personalized_cards for insert to authenticated with check (user_id = auth.uid());
create policy "own drafts edit" on public.personalized_cards for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own drafts remove" on public.personalized_cards for delete to authenticated using (user_id = auth.uid());

-- table privileges: least privilege (RLS is the second lock)
revoke all on public.profiles, public.cards, public.orders, public.order_items, public.favorites, public.personalized_cards, public.stripe_events from anon, authenticated;
grant select on public.cards to anon, authenticated;
grant select on public.orders, public.order_items to authenticated;
grant select, update (name) on public.profiles to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select, insert, update, delete on public.personalized_cards to authenticated;

-- ---------- opening a shared card (recipient link) ----------
-- Returns only what the recipient needs, and only for paid orders. Knowing the token is the permission.
create function public.get_shared_card(p_token text)
returns table (card_id text, recipient_name text, message text, sender_name text)
language sql stable security definer set search_path = public as $$
	select i.card_id, i.recipient_name, i.message, i.sender_name
	from public.order_items i join public.orders o on o.id = i.order_id
	where i.share_token = p_token and o.status = 'paid'
	limit 1;
$$;
revoke all on function public.get_shared_card(text) from public;
grant execute on function public.get_shared_card(text) to anon, authenticated;

-- ---------- payment fulfilment (server only) ----------
-- Idempotent: only a 'pending' order can become 'paid', so a repeated webhook changes nothing.
create function public.fulfil_order(p_session_id text, p_payment_intent text, p_amount_total integer, p_currency text)
returns text language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
	select * into o from public.orders where stripe_session_id = p_session_id for update;
	if not found then return 'not_found'; end if;
	if o.status = 'paid' then return 'already_paid'; end if;
	if o.total_cents <> p_amount_total or lower(o.currency) <> lower(p_currency) then return 'amount_mismatch'; end if;
	update public.orders set status = 'paid', paid_at = now(), stripe_payment_intent = p_payment_intent where id = o.id;
	return 'paid';
end $$;

create function public.close_order(p_session_id text, p_status text)
returns text language plpgsql security definer set search_path = public as $$
begin
	if p_status not in ('failed', 'expired') then raise exception 'bad status'; end if;
	update public.orders set status = p_status where stripe_session_id = p_session_id and status = 'pending';
	return case when found then p_status else 'unchanged' end;
end $$;

revoke all on function public.fulfil_order(text, text, integer, text) from public, anon, authenticated;
revoke all on function public.close_order(text, text) from public, anon, authenticated;
grant execute on function public.fulfil_order(text, text, integer, text) to service_role;
grant execute on function public.close_order(text, text) to service_role;
