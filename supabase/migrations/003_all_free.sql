-- Little Post: the whole site is free. Run once in the Supabase SQL editor, after 002.
-- To sell cards again later, set prices back (e.g. update public.cards set price_cents = 99;) and PRICE_CENTS in path.js.
update public.cards set price_cents = 0;
