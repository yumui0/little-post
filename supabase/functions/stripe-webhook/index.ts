// Receives Stripe events. Verifies the signature, then fulfils the order. Deploy with --no-verify-jwt.
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { handleEvent } from "../_shared/webhook.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { httpClient: Stripe.createFetchHttpClient() });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async req => {
	const sig = req.headers.get("stripe-signature");
	if (!sig) return new Response("Missing signature", { status: 400 });
	const raw = await req.text(); // the exact bytes Stripe signed
	let event: Stripe.Event;
	try {
		event = await stripe.webhooks.constructEventAsync(raw, sig, Deno.env.get("STRIPE_WEBHOOK_SECRET")!, undefined, Stripe.createSubtleCryptoProvider());
	} catch (e) {
		console.error("bad signature", (e as Error).message);
		return new Response("Bad signature", { status: 400 });
	}
	try {
		const result = await handleEvent(event, {
			fulfil: async (id, pi, amount, cur) => { const { data, error } = await admin.rpc("fulfil_order", { p_session_id: id, p_payment_intent: pi, p_amount_total: amount, p_currency: cur }); if (error) throw error; return data as string; },
			close: async (id, status) => { const { data, error } = await admin.rpc("close_order", { p_session_id: id, p_status: status }); if (error) throw error; return data as string; },
		});
		if (result === "amount_mismatch") console.error("AMOUNT MISMATCH for event", event.id);
		await admin.from("stripe_events").upsert({ id: event.id, type: event.type }, { onConflict: "id", ignoreDuplicates: true });
		return new Response(JSON.stringify({ received: true, result }), { headers: { "Content-Type": "application/json" } });
	} catch (e) {
		console.error("webhook failed", e);
		return new Response("Server error", { status: 500 }); // Stripe will retry
	}
});
