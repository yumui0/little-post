# Little Post – an e-card shop

A cute little shop of e-cards for every occasion, **€0.99 per card**. Visitors browse by occasion, personalise a card with a name and message, pay securely with Stripe, and get a private link and QR code to send. Customers have accounts with their purchased cards, favourites, drafts and order history.

It is a plain HTML/CSS/JavaScript site (no build step) with **Supabase** (accounts + database) and **Stripe Checkout** (payments) behind it.

> **Out of the box the shop is browse-only.** Browsing, searching, previewing, personalising and the cart all work immediately. Accounts and payments switch on once you complete "Go live" below. Until then the log-in, checkout and account pages say so honestly instead of pretending.

## What's inside

| Page | What it does |
| --- | --- |
| `index.html` | Home: your original hero, **Shop by occasion**, popular cards, new arrivals, how it works |
| `shop.html` | Every card, or one occasion's gallery (`shop.html?cat=birthday`). Search, style filters, sort, favourites |
| `product.html` | One card: front/inside preview, recipient name + message, add to cart, buy now, favourite, save draft |
| `cart.html` | Cart, edit each card's message, remove, total, hand-off to Stripe Checkout |
| `success.html` | After paying. Waits for Stripe's confirmation, then shows the cards and lets you send them |
| `login.html` `signup.html` `forgot.html` `reset.html` | Real Supabase Auth |
| `account.html` | Dashboard: overview, my cards, orders, favourites, drafts, settings, log out |
| `card.html` | What the recipient opens (`card.html?t=<private token>`). Only works for paid orders |
| `faq.html` `contact.html` `terms.html` `privacy.html` | Info pages (see "Before you launch") |

Code: `js/app.js` (header, footer, cart, favourites, share dialog, shared by all pages) · `js/home.js` `shop.js` `product.js` `cart.js` `success.js` `auth.js` `account.js` `info.js` (one per page) · `js/config.js` (your public settings) · `path.js` (the card catalogue) · `css/common.css` + `shop.css` (your original theme and hero) + `site.css` (the shop pages).
Backend: `supabase/migrations/001_littlepost.sql` (tables, security rules, payment fulfilment), `supabase/seed.sql` (the cards and their €0.99 price), `supabase/functions/create-checkout` and `stripe-webhook`.

## Go live (about 30 minutes)

You need free accounts at [Supabase](https://supabase.com) and [Stripe](https://stripe.com), and somewhere to host the static files (GitHub Pages, Netlify, Cloudflare Pages, …).

### 1. Supabase project

1. Create a project. Note the **Project URL** and the **anon public key** (Project settings → API).
2. SQL editor → paste and run `supabase/migrations/001_littlepost.sql`, then `supabase/seed.sql`.
3. Authentication → URL configuration:
   - **Site URL**: where your site lives, e.g. `https://yourname.github.io/little-post`
   - **Redirect URLs**: add `…/login.html` and `…/reset.html` (same base).
4. Authentication → Providers → Email: keep "Confirm email" on if you want people to verify their address (recommended). Supabase's built-in email sender is rate-limited, so before launch add your own SMTP under Authentication → SMTP settings.

### 2. Stripe

1. Get your **secret key** (Developers → API keys). Start with the **test** key (`sk_test_…`) and test cards (`4242 4242 4242 4242`).
2. After step 3 below, add a webhook (Developers → Webhooks → Add endpoint):
   - URL: `https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`
   - Copy the **signing secret** (`whsec_…`).
3. Optional: Settings → Emails → turn on customer receipts.

### 3. Deploy the two server functions

With the [Supabase CLI](https://supabase.com/docs/guides/cli) installed, from this folder:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... SITE_URL=https://yourname.github.io/little-post
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook      # config.toml already turns off the login check for this one
```

`SITE_URL` is the address of the folder that holds `index.html`, with no trailing slash. **The secret keys live only in Supabase's secrets, never in the website files.**

### 4. Connect the website

Edit `js/config.js` and fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY` (these two are meant to be public; the database's security rules protect the data). Also set `CONTACT_EMAIL` and `BUSINESS_NAME`. Then upload the site.

### 5. Test a payment

Sign up, add a card with a message, check out with `4242 4242 4242 4242` (any future date, any CVC). You should land on the thank-you page, see the card under **My cards**, and Stripe → Webhooks should show a delivered event. Test the cancel button and a declined card (`4000 0000 0000 9995`) too. When happy, switch to your live Stripe keys (`supabase secrets set STRIPE_SECRET_KEY=sk_live_…`, new live webhook + secret).

## How the money side is protected

- **Prices live in the database** (`cards.price_cents`, 99). The browser only sends card ids and messages; `create-checkout` looks the price up, totals it and builds the Stripe session. A price sent by the browser is ignored (tested).
- **A card is unlocked only by Stripe's signed webhook.** The webhook verifies Stripe's signature, checks the amount and currency match the order, and only then marks it paid. The success page shows what the *database* says, never what the URL says.
- **No double fulfilment:** a repeated webhook finds the order already paid and does nothing. Failed and expired payments are recorded and unlock nothing.
- **Privacy by row-level security:** customers can only read their own orders, cards, favourites and drafts, and can never write orders. A recipient's private link (64 random hex characters) only works for paid orders and reveals just the card, name, message and sender.
- Card details never touch this site. Stripe handles them.

## Adding cards and occasions

See `path.js`. Add an image to `res/<occasion>/`, add a line to that occasion's `cards`, then:

```bash
node scripts/gen-seed.mjs          # rewrites supabase/seed.sql; run that file in Supabase again
python3 scripts/make-thumbs.py     # PNG cards only: makes small WebP copies so the shelves load fast (needs: pip install pillow)
```

Keep the order of existing cards (ids are `<occasion>-<position>`). A card's price is `price_cents` in the `cards` table; changing it there changes what customers pay (the `PRICE_CENTS` in `path.js` is for display only, so update both).

## Tests

```bash
node --experimental-strip-types --no-warnings tests/logic.test.mjs   # pricing and webhook logic
bash tests/run-db-tests.sh                                            # security rules + fulfilment against a throw-away PostgreSQL 16
```

## Before you launch

- **Legal pages are templates.** Have `terms.html` and `privacy.html` checked for your country and business, fill in `BUSINESS_NAME` / `BUSINESS_ADDRESS`, then delete the yellow "Template text" notes. The checkout asks customers to agree to immediate delivery and the loss of the withdrawal right for digital content (an EU requirement); confirm the wording with a lawyer.
- **Fonts:** Google Fonts are loaded from Google's servers (as in the original design). Some EU privacy rules prefer self-hosted fonts; the privacy page mentions Google Fonts.
- **Old free links:** cards made by the old free version open without payment, and anyone can build such a link by hand. They are switched off (`ALLOW_LEGACY_LINKS: false` in `js/config.js`). Turn them on only if you must keep old shared links working.
- **Artwork files are public** (any website's images are). Payment gates personalisation, the private link and your account, not the raw image files.

## Notes

- Fonts (Bagel Fat One, Nunito, Gaegu) load from Google Fonts. The QR code uses `qrious` from cdnjs and the account system uses `@supabase/supabase-js` (pinned to 2.45.4) from jsDelivr.
- The cart is kept in the visitor's browser; log-in sessions use Supabase's secure session handling. "Remember me" keeps the session across browser restarts; unticked, it ends when the tab closes.

Based on [E-Card-Generator](https://github.com/Ronik22/E-Card-Generator) by Ronik Bhattacharjee (MIT).
