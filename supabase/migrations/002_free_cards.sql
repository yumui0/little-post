-- Little Post: free cards to try. Run once in the Supabase SQL editor, after 001.
-- A price of 0 is now allowed. An order made only of free cards is marked paid by create-checkout without Stripe.

alter table public.cards drop constraint if exists cards_price_cents_check;
alter table public.cards add constraint cards_price_cents_check check (price_cents >= 0);
alter table public.order_items drop constraint if exists order_items_price_cents_check;
alter table public.order_items add constraint order_items_price_cents_check check (price_cents >= 0);
alter table public.orders drop constraint if exists orders_total_cents_check;
alter table public.orders add constraint orders_total_cents_check check (total_cents >= 0);

-- the cards marked `free: true` in path.js
update public.cards set price_cents = 0 where id in (
	'birthday-1', 'anniversary-1', 'love-2', 'valentine-3', 'christmas-1', 'halloween-3', 'easter-1',
	'graduation-4', 'mothers-4', 'fathers-1', 'thankyou-5', 'thinking-4', 'congrats-3', 'sorry-6'
);
