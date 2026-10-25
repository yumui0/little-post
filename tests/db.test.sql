-- Database tests. Run with tests/run-db-tests.sh (needs a local PostgreSQL 16).
\set ON_ERROR_STOP on
\set QUIET on
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
\i supabase/migrations/001_littlepost.sql
\i supabase/seed.sql

create table t_log (n serial, name text);
create function t_ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin if p_cond is not true then raise exception 'FAILED: %', p_name; end if; insert into t_log(name) values (p_name); raise notice '  ok  %', p_name; end $$;
-- number of rows a statement returns/affects when run as role+user; -1 when it is refused
create function t_rows(p_role text, p_uid text, p_sql text) returns bigint language plpgsql as $$
declare n bigint; begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid, ''), true);
  execute 'set local role ' || p_role;
  begin execute p_sql; get diagnostics n = row_count; exception when others then n := -1; end;
  execute 'reset role'; return n; end $$;
create function t_val(p_role text, p_uid text, p_sql text) returns text language plpgsql as $$
declare v text; begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid, ''), true);
  execute 'set local role ' || p_role; execute p_sql into v; execute 'reset role'; return v; end $$;

\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'
insert into auth.users values (:'A', 'a@x.test', '{"name":"Ada"}'), (:'B', 'b@x.test', '{}');

select t_ok((select name from profiles where id = :'A') = 'Ada', 'profile is created on sign-up');
select t_ok((select count(*) from cards) = 49 and (select count(distinct price_cents) from cards) = 1 and (select max(price_cents) from cards) = 99, '49 cards, every one costs 99 cents');
select t_ok(t_rows('anon', null, 'select * from cards') = 49, 'guests can read the 49 published cards');
select t_ok(t_rows('anon', null, 'update cards set price_cents = 1') in (-1, 0), 'guests cannot change prices');
select t_ok(t_rows('authenticated', :'A', 'update cards set price_cents = 1') in (-1, 0), 'logged-in users cannot change prices');
select t_ok((select max(price_cents) from cards) = 99, 'prices are still 99 afterwards');
select t_ok(t_rows('authenticated', :'A', format($q$insert into orders (user_id,total_cents,status) values ('%s',99,'paid')$q$, :'A')) = -1, 'users cannot create an order, paid or not');
select t_ok(t_rows('authenticated', :'A', 'select * from stripe_events') = -1, 'users cannot read the Stripe event log');
select t_ok(t_rows('anon', null, 'select * from orders') = -1, 'guests cannot read orders');

insert into orders (id, user_id, total_cents, stripe_session_id) values ('aaaaaaaa-0000-0000-0000-000000000001', :'A', 198, 'cs_A'), ('bbbbbbbb-0000-0000-0000-000000000001', :'B', 198, 'cs_B');
insert into order_items (order_id, card_id, price_cents, message, recipient_name)
  select o, c, 99, 'hello ' || c, '' from (values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid), ('bbbbbbbb-0000-0000-0000-000000000001')) o(o), (values ('birthday-1'), ('love-1')) c(c);

select t_ok(t_rows('authenticated', :'A', 'select * from order_items') = 0, 'items of an unpaid order are hidden (no access before payment)');
select t_ok(t_rows('authenticated', :'A', 'select * from orders') = 1, 'a user sees only their own order');
select t_ok(t_rows('authenticated', :'A', $q$select fulfil_order('cs_A','pi_1',198,'eur')$q$) = -1, 'users cannot call fulfil_order');
select t_ok(t_rows('anon', null, $q$select fulfil_order('cs_A','pi_1',198,'eur')$q$) = -1, 'guests cannot call fulfil_order');
select t_ok(t_rows('authenticated', :'A', $q$select close_order('cs_A','failed')$q$) = -1, 'users cannot call close_order');

select t_ok(t_val('service_role', null, $q$select fulfil_order('cs_A','pi_1',99,'eur')$q$) = 'amount_mismatch', 'wrong amount is refused');
select t_ok(t_val('service_role', null, $q$select fulfil_order('cs_A','pi_1',198,'usd')$q$) = 'amount_mismatch', 'wrong currency is refused');
select t_ok((select status from orders where stripe_session_id = 'cs_A') = 'pending', 'order stays pending after a refused payment');
select t_ok(t_val('service_role', null, $q$select fulfil_order('cs_nope','pi_1',198,'eur')$q$) = 'not_found', 'unknown session is ignored');
select t_ok(t_val('service_role', null, $q$select fulfil_order('cs_A','pi_1',198,'eur')$q$) = 'paid', 'matching payment marks the order paid');
select t_ok(t_val('service_role', null, $q$select fulfil_order('cs_A','pi_1',198,'eur')$q$) = 'already_paid', 'a repeated notification does nothing (no duplicate fulfilment)');
select t_ok((select count(*) from orders where status = 'paid') = 1 and (select paid_at is not null from orders where stripe_session_id = 'cs_A'), 'exactly one paid order, with a timestamp');
select t_ok(t_rows('authenticated', :'A', 'select * from order_items') = 2, 'after payment the buyer sees both cards');
select t_ok(t_rows('authenticated', :'B', 'select * from order_items') = 0, 'another user still sees none of them');

select t_ok((select share_token ~ '^[0-9a-f]{64}$' from order_items limit 1), 'share token is 64 hex characters');
select t_ok(t_rows('anon', null, format($q$select * from get_shared_card('%s')$q$, (select share_token from order_items where order_id = 'aaaaaaaa-0000-0000-0000-000000000001' limit 1))) = 1, 'a recipient can open a paid card with its link');
select t_ok(t_rows('anon', null, $q$select * from get_shared_card('nope')$q$) = 0, 'a wrong token returns nothing');
select t_ok(t_rows('anon', null, format($q$select * from get_shared_card('%s')$q$, (select share_token from order_items where order_id = 'bbbbbbbb-0000-0000-0000-000000000001' limit 1))) = 0, 'a token from an unpaid order returns nothing');
select t_ok((select count(*) from information_schema.routines r, information_schema.parameters q where r.routine_name = 'get_shared_card' and q.specific_name = r.specific_name and q.parameter_mode = 'OUT') = 4, 'shared-card lookup exposes exactly 4 fields (card, to, message, from)');

select t_ok(t_val('service_role', null, $q$select close_order('cs_B','expired')$q$) = 'expired', 'an unpaid order can expire');
select t_ok(t_val('service_role', null, $q$select close_order('cs_A','failed')$q$) = 'unchanged', 'a paid order can never be closed');
select t_ok(t_rows('anon', null, format($q$select * from get_shared_card('%s')$q$, (select share_token from order_items where order_id = 'bbbbbbbb-0000-0000-0000-000000000001' limit 1))) = 0, 'expired order stays locked');

select t_ok(t_rows('authenticated', :'A', format($q$insert into favorites (user_id,card_id) values ('%s','love-1')$q$, :'A')) = 1, 'a user can favourite a card');
select t_ok(t_rows('authenticated', :'A', format($q$insert into favorites (user_id,card_id) values ('%s','love-2')$q$, :'B')) = -1, 'cannot add a favourite for someone else');
select t_ok(t_rows('authenticated', :'B', 'select * from favorites') = 0, 'favourites are private');
select t_ok(t_rows('authenticated', :'B', 'delete from favorites') = 0, 'cannot delete someone else''s favourites');
select t_ok(t_rows('authenticated', :'A', 'delete from favorites') = 1, 'can remove own favourite');
select t_ok(t_rows('authenticated', :'A', format($q$insert into personalized_cards (user_id,card_id,message) values ('%s','love-1','draft')$q$, :'A')) = 1, 'a user can save a draft');
select t_ok(t_rows('authenticated', :'B', 'select * from personalized_cards') = 0, 'drafts are private');
select t_ok(t_rows('authenticated', :'B', $q$update personalized_cards set message = 'x'$q$) = 0, 'cannot edit someone else''s draft');
select t_ok(t_rows('authenticated', :'A', format($q$insert into personalized_cards (user_id,card_id,message) values ('%s','love-1',repeat('x',401))$q$, :'A')) = -1, 'message length is enforced in the database');
select t_ok(t_rows('authenticated', :'A', $q$update profiles set name = 'Ada L'$q$) = 1, 'a user can rename themselves');
select t_ok(t_rows('authenticated', :'B', format($q$update profiles set name = 'hacked' where id = '%s'$q$, :'A')) = 0, 'cannot rename another user');
select t_ok(t_rows('authenticated', :'A', $q$update profiles set id = gen_random_uuid()$q$) = -1, 'cannot change profile id');
select t_ok((select name from profiles where id = :'A') = 'Ada L', 'profile name is as expected');
select t_ok(t_rows('authenticated', :'A', format($q$insert into order_items (order_id,card_id,price_cents,message) values ('aaaaaaaa-0000-0000-0000-000000000001','love-2',1,'x')$q$)) = -1, 'users cannot add items to an order');
