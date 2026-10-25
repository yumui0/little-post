/* Little Post – after Stripe. The page believes the database (updated by Stripe's signed webhook), never the URL. */
(() => {
	const { $, esc, money } = LP;
	const view = $("#view");
	const order = new URLSearchParams(location.search).get("order") || "";
	const msg = (title, body, actions = "") => { view.innerHTML = `<div class="thanks"><h1>${title}</h1><p>${body}</p>${actions ? `<p>${actions}</p>` : ""}</div>`; };

	async function run() {
		if (!/^[0-9a-f-]{36}$/i.test(order)) return msg("We couldn't find that order", "The link looks incomplete.", `<a class="btn" href="account.html#orders">See my orders</a>`);
		if (!LP.configured) return msg("The shop isn't connected yet", "Orders can't be shown until Supabase is configured.");
		await LP.ready;
		if (!LP.user) return msg("Log in to see your order", "Your cards are saved to your account.", `<a class="btn" href="${esc(LP.loginUrl(`success.html?order=${order}`))}">Log in</a>`);

		/* the webhook can arrive a moment after the redirect: wait up to ~40 seconds */
		let row = null;
		for (let i = 0; i < 20; i++) {
			const { data, error } = await LP.sb.from("orders").select("id,status,total_cents,paid_at").eq("id", order).maybeSingle();
			if (error) return msg("Something went wrong", "We couldn't check your order. Please look in your account in a minute.", `<a class="btn" href="account.html#orders">My orders</a>`);
			row = data;
			if (!row) return msg("We couldn't find that order", "It may belong to a different account.", `<a class="btn" href="account.html#orders">See my orders</a>`);
			if (row.status !== "pending") break;
			if (i === 0) view.innerHTML = `<div class="loading">Confirming your payment with Stripe…<small>This usually takes a few seconds.</small></div>`;
			await new Promise(r => setTimeout(r, 2000));
		}
		if (row.status === "pending") return msg("Still confirming your payment", "Stripe hasn't confirmed it yet. You haven't been charged twice, and your cards will appear in your account as soon as it's confirmed.", `<a class="btn" href="account.html#orders">Check my orders</a>`);
		if (row.status !== "paid") return msg(row.status === "expired" ? "That payment expired" : "That payment didn't go through", "Nothing was charged. Your cart is still waiting for you.", `<a class="btn" href="cart.html">Back to my cart</a>`);

		const { data: items, error } = await LP.sb.from("order_items").select("id,card_id,recipient_name,message,sender_name,share_token").eq("order_id", order).order("created_at");
		if (error) return msg("Payment received", "Your cards are in your account.", `<a class="btn" href="account.html#cards">Open my cards</a>`);
		if (row.paid_at && Date.now() - new Date(row.paid_at).getTime() < 30 * 60 * 1000) LP.Cart.clear();   // only right after paying, never on a later revisit
		document.title = LP.t("Thank you – Little Post");
		view.innerHTML = `
			<div class="thanks">
				<h1>Thank you!</h1>
				<p>${row.total_cents ? `Your payment of <strong>${money(row.total_cents)}</strong> went through. ` : ""}${items.length === 1 ? "Your card is" : "Your cards are"} ready, and saved in your account.</p>
				<div class="mine" id="mine">${items.map(LP.ownedTileHTML).join("")}</div>
				<p style="margin-top:1.6rem"><a class="btn soft" href="account.html#cards">All my cards</a> <a class="btn" href="shop.html">Send another</a></p>
			</div>`;
		LP.bindOwned($("#mine"), items);
		LP.confetti();
	}
	run();
})();
