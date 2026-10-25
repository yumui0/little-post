// Creates a pending order and a Stripe Checkout Session. Prices come from the `cards` table only.
// An order of free cards only (total 0) skips Stripe and is marked paid at once.
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { buildOrder } from "../_shared/checkout.ts";

const SITE_URL = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
// browsers send only the origin (no folder path), so CORS must name the origin even if the site lives in a sub-folder
const ORIGIN = (() => { try { return new URL(SITE_URL).origin; } catch { return ""; } })();
const cors = {
	"Access-Control-Allow-Origin": ORIGIN || "*",
	"Vary": "Origin",
	"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async req => {
	if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
	if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
	if (!SITE_URL) return json({ error: "The shop is not configured yet (SITE_URL is missing)." }, 500);

	const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

	// who is asking? (verifies the JWT with Supabase Auth)
	const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /i, "");
	const { data: auth } = await admin.auth.getUser(token);
	const user = auth?.user;
	if (!user) return json({ error: "Please log in to check out." }, 401);

	let body: { items?: unknown; locale?: unknown };
	try { body = await req.json(); } catch { return json({ error: "Bad request." }, 400); }

	const ids = Array.isArray(body.items) ? [...new Set((body.items as { cardId?: unknown }[]).map(i => i?.cardId).filter((x): x is string => typeof x === "string"))] : [];
	const { data: cards, error: cardsErr } = await admin.from("cards").select("id,title,occasion,price_cents,published").in("id", ids.length ? ids : ["-"]);
	if (cardsErr) return json({ error: "Could not load the cards." }, 500);

	const built = buildOrder(body.items, cards ?? []);
	if ("error" in built) return json({ error: built.error }, 400);

	const { data: order, error: orderErr } = await admin.from("orders").insert({ user_id: user.id, total_cents: built.total }).select("id").single();
	if (orderErr || !order) return json({ error: "Could not create your order." }, 500);
	const { error: itemsErr } = await admin.from("order_items").insert(built.lines.map(l => ({
		order_id: order.id, card_id: l.card_id, price_cents: l.price_cents, recipient_name: l.recipient_name, message: l.message, sender_name: l.sender_name,
	})));
	if (itemsErr) { await admin.from("orders").delete().eq("id", order.id); return json({ error: "Could not save your cards." }, 500); }

	// only free cards: nothing to pay, so the order is delivered straight away without Stripe
	if (built.total === 0) {
		const { error: freeErr } = await admin.from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", order.id);
		if (freeErr) { await admin.from("orders").delete().eq("id", order.id); return json({ error: "Could not save your cards." }, 500); }
		return json({ free: true, orderId: order.id });
	}

	const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { httpClient: Stripe.createFetchHttpClient() });
	try {
		const session = await stripe.checkout.sessions.create({
			mode: "payment",
			locale: body.locale === "fr" ? "fr" : "en",   // the Stripe page speaks the language the shopper picked on the site
			currency: "eur",
			customer_email: user.email ?? undefined,
			client_reference_id: order.id,
			metadata: { order_id: order.id, user_id: user.id },
			line_items: built.lines.filter(l => l.price_cents > 0).map(l => ({   // free cards ride along at no charge
				quantity: 1, price_data: { currency: "eur", unit_amount: l.price_cents, product_data: { name: `eCard: ${l.title}` } } })),
			success_url: `${SITE_URL}/success.html?order=${order.id}`,
			cancel_url: `${SITE_URL}/cart.html?canceled=1`,
			expires_at: Math.floor(Date.now() / 1000) + 45 * 60,   // Stripe requires 30 minutes to 24 hours; 45 leaves a safe margin
		}, { idempotencyKey: `order-${order.id}` });
		await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);
		return json({ url: session.url, orderId: order.id });
	} catch (e) {
		console.error("stripe error", e);
		await admin.from("orders").update({ status: "failed" }).eq("id", order.id);
		return json({ error: "The payment page could not be opened. Please try again." }, 502);
	}
});
