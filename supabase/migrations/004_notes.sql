-- Little Post: the notes wall (guestbook). Run once in the Supabase SQL editor, after 003.
-- Logged-in visitors write notes; a note is only public once approved (tick `approved` in Table Editor → notes).

create table public.notes (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	name text not null default '' check (char_length(name) <= 40),
	message text not null check (char_length(message) between 1 and 300),
	approved boolean not null default false,
	created_at timestamptz not null default now()
);
create index notes_wall_idx on public.notes (created_at desc) where approved;

-- trims the text and allows at most 3 notes per account per day (keeps spam out)
create function public.notes_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
	new.name := btrim(new.name);
	new.message := btrim(new.message);
	if (select count(*) from public.notes where user_id = new.user_id and created_at > now() - interval '1 day') >= 3 then
		raise exception 'note_limit';
	end if;
	return new;
end $$;
create trigger notes_before_insert before insert on public.notes
	for each row execute function public.notes_before_insert();

-- everyone sees approved notes; you also see your own notes while they wait; nobody can approve their own
alter table public.notes enable row level security;
create policy "approved notes are public" on public.notes for select to anon, authenticated using (approved);
create policy "own notes read" on public.notes for select to authenticated using (user_id = auth.uid());
create policy "own notes add" on public.notes for insert to authenticated with check (user_id = auth.uid() and approved = false);
create policy "own notes remove" on public.notes for delete to authenticated using (user_id = auth.uid());

-- column privileges: who wrote a note (user_id) is never readable, and only name + message can be written
revoke all on public.notes from anon, authenticated;
grant select (id, name, message, created_at) on public.notes to anon;
grant select (id, name, message, approved, created_at) on public.notes to authenticated;
grant insert (name, message) on public.notes to authenticated;
grant delete on public.notes to authenticated;
