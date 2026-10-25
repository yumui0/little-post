// Decides what to do with a verified Stripe event. Dependencies are injected so it can be tested.
export interface WebhookDeps {
	fulfil(sessionId: string, paymentIntent: string | null, amountTotal: number, currency: string): Promise<string>;
	close(sessionId: string, status: "failed" | "expired"): Promise<string>;
}
// deno-lint-ignore no-explicit-any
export async function handleEvent(event: { type: string; data: { object: any } }, deps: WebhookDeps): Promise<string> {
	const s = event.data.object;
	switch (event.type) {
		case "checkout.session.completed":
		case "checkout.session.async_payment_succeeded":
			// completed fires before delayed payment methods have settled: only fulfil when money has actually arrived
			if (s.payment_status !== "paid") return "waiting_for_payment";
			return await deps.fulfil(s.id, typeof s.payment_intent === "string" ? s.payment_intent : null, s.amount_total, s.currency);
		case "checkout.session.async_payment_failed":
			return await deps.close(s.id, "failed");
		case "checkout.session.expired":
			return await deps.close(s.id, "expired");
		default:
			return "ignored";
	}
}
