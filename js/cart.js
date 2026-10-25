/* Little Post – the cart. Free cards are made straight away; paid ones (if prices come back) go through Stripe Checkout. */
(() => {
	const { $, $$, esc, money, price, Cart, t } = LP;
	const view = $("#cartView"), notices = $("#notices");
	const MAX = 20;
	let busy = false, consent = false;

	/* each message has its own slot so one never overwrites another */
	const notice = (slot, kind, html) => {
		let el = $(`#note-${slot}`);
		if (!el) { el = document.createElement("div"); el.id = `note-${slot}`; notices.appendChild(el); }
		el.innerHTML = html ? `<div class="notice ${kind}" role="${kind === "bad" ? "alert" : "status"}"><div>${html}</div></div>` : "";
	};

	if (new URLSearchParams(location.search).get("canceled")) notice("canceled", "", "<strong>Payment canceled.</strong> Nothing was charged and your cards are still here.");

	function lineHTML(it) {
		const x = LP.byId(it.cardId), { card, cat } = x, missing = !it.message.trim();
		return `
		<li class="line" data-uid="${it.uid}">
			<a href="product.html?card=${card.id}" aria-label="${esc(t("Open {name}", { name: t(card.name) }))}"><div class="cover-art">${coverHTML(card, esc(t(card.name)), true)}</div></a>
			<div>
				<div class="top-row">
					<div><h2>${esc(card.name)}</h2><p class="sub" translate="no">${esc(t(cat.title))}${it.to ? ` · ${esc(t("for {name}", { name: it.to }))}` : ""}</p></div>
					<span class="price">${price(card)}</span>
				</div>
				${missing ? `<p class="need" data-need>Add a message before you check out.</p>` : ""}
				<details ${missing ? "open" : ""}>
					<summary>Personalise</summary>
					<div class="field"><label for="to-${it.uid}">Who is it for?</label><input id="to-${it.uid}" data-f="to" maxlength="40" autocomplete="off" value="${esc(it.to)}"></div>
					<div class="field"><label for="msg-${it.uid}">Message</label><textarea id="msg-${it.uid}" data-f="message" rows="3" maxlength="400">${esc(it.message)}</textarea></div>
					<div class="field"><label for="from-${it.uid}">From <small>(optional)</small></label><input id="from-${it.uid}" data-f="from" maxlength="40" autocomplete="off" value="${esc(it.from)}"></div>
				</details>
				<div class="actions"><button class="linkbtn" type="button" data-remove aria-label="${esc(t("Remove {name} from cart", { name: t(card.name) }))}">Remove</button></div>
			</div>
		</li>`;
	}

	function render() {
		const items = Cart.items(), n = items.length;
		if (!n) {
			view.innerHTML = `<div class="big-empty"><h2>Your cart is empty</h2><p>Pick a card you love and it will wait for you here.</p><a class="btn" href="shop.html">Browse the cards</a></div>`;
			return;
		}
		view.innerHTML = `
		<div class="cart-layout">
			<ul class="lines" id="lines">${items.map(lineHTML).join("")}</ul>
			<aside class="summary" aria-labelledby="sumTitle">
				<h2 id="sumTitle">Order summary</h2>
				<div class="sum-row"><span id="sumCount"></span><span id="sumSub"></span></div>
				<div class="sum-row"><span>Delivery</span><span>Instant, online</span></div>
				<div class="sum-row total"><span>Total</span><span id="sumTotal"></span></div>
				<label class="consent"><input type="checkbox" id="consent"> <span>I agree to the <a href="terms.html" target="_blank" rel="noopener">terms of use</a> and will only send kind messages.</span></label>
				<p class="error" id="coErr" role="alert" hidden></p>
				<button class="btn" type="button" id="checkout"></button>
				<p class="fine"><a href="shop.html">← Keep browsing</a></p>
			</aside>
		</div>`;
		$("#consent").checked = consent;
		totals(); button();
	}

	function totals() {
		const n = Cart.count();
		$("#sumCount").textContent = t(n === 1 ? "{n} card" : "{n} cards", { n });
		$("#sumSub").textContent = Cart.totalCents() ? money(Cart.totalCents()) : t("Free");
		$("#sumTotal").textContent = Cart.totalCents() ? money(Cart.totalCents()) : t("Free");
	}

	function button() {
		const b = $("#checkout"); if (!b) return;
		if (!LP.configured) { b.textContent = "Checkout not available yet"; b.disabled = true; notice("setup", "", "<strong>The shop is still being set up.</strong> Payments will switch on as soon as the owner connects Supabase and Stripe (see the README)."); return; }
		b.disabled = busy;
		const free = !Cart.totalCents();
		b.textContent = busy ? (free ? "Getting your cards ready…" : "Opening secure checkout…")
			: !LP.user ? (free ? "Log in to get your cards" : "Log in to check out")
			: free ? t(Cart.count() === 1 ? "Get my free card" : "Get my free cards")
			: t("Pay {price} securely", { price: money(Cart.totalCents()) });
	}

	/* edits inside a cart line are saved as you type */
	view.addEventListener("input", e => {
		const el = e.target.closest("[data-f]"); if (!el) return;
		const li = el.closest("[data-uid]"); Cart.update(li.dataset.uid, { [el.dataset.f]: el.value });
		if (el.dataset.f === "message") { const need = $("[data-need]", li); if (need) need.hidden = !!el.value.trim(); }
		$("#coErr") && ($("#coErr").hidden = true);
	});
	view.addEventListener("change", e => { if (e.target.id === "consent") consent = e.target.checked; });
	view.addEventListener("click", e => {
		const rm = e.target.closest("[data-remove]");
		if (rm) {
			const li = rm.closest("[data-uid]"), next = li.nextElementSibling || li.previousElementSibling;
			Cart.remove(li.dataset.uid); LP.toast("Removed from your cart");
			render(); (next ? $(`[data-uid="${next.dataset.uid}"] [data-remove]`) || $("#main a") : $("#main .btn"))?.focus();
		} else if (e.target.closest("#checkout")) checkout();
	});
	document.addEventListener("lp:auth", button);
	LP.ready.then(button);
	window.addEventListener("pageshow", e => { if (e.persisted) { busy = false; button(); } });   // back button from Stripe

	/* the browser asks the server to start a payment; the server decides the price */
	async function checkout() {
		if (busy) return;
		const err = $("#coErr"); err.hidden = true;
		if (!LP.configured) return;
		if (!LP.user) { location.href = LP.loginUrl("cart.html"); return; }
		const items = Cart.items();
		if (items.length > MAX) return fail(t("You can send up to {max} cards at once. Please remove a few.", { max: MAX }));
		const bad = items.find(i => !i.message.trim());
		if (bad) { const li = $(`[data-uid="${bad.uid}"]`); $("details", li).open = true; $("textarea", li).focus(); return fail("Every card needs a message. Add one to the highlighted card."); }
		if (!$("#consent").checked) { $("#consent").focus(); return fail("Please tick the box to agree to the terms."); }
		busy = true; button();
		try {
			const { data, error } = await LP.sb.functions.invoke("create-checkout", { body: { locale: LP.lang, items: items.map(i => ({ cardId: i.cardId, to: i.to, message: i.message, from: i.from })) } });
			if (error) {
				let msg = error.context?.status === 404 ? "Checkout isn't switched on yet. Please try again later." : "Something went wrong. Please try again.";
				try { const j = await error.context.json(); if (j?.error) msg = j.error; } catch (e) {}
				throw new Error(msg);
			}
			if (data?.free && /^[0-9a-f-]{36}$/i.test(data.orderId || "")) { location.href = `success.html?order=${data.orderId}`; return; }   // free cards: no payment page
			if (!data?.url || !/^https:\/\/checkout\.stripe\.com\//.test(data.url)) throw new Error("The payment page could not be opened. Please try again.");
			location.href = data.url;
		} catch (e) { busy = false; button(); fail(e.message); }
	}
	function fail(msg) { const err = $("#coErr"); err.textContent = msg; err.hidden = false; }

	document.addEventListener("lp:cart", () => { if (!$("#lines")) return; totals(); button(); });
	render();
})();
