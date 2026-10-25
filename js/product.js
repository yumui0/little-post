/* Little Post – one card: preview, personalise, add to cart / buy now, favourite, save a draft */
(() => {
	const { $, esc, money, store, t } = LP;
	const view = document.getElementById("view");
	const params = new URLSearchParams(location.search);
	const x = LP.byId(params.get("card") || "");

	if (!x) {
		document.title = t("Card not found – Little Post");
		view.innerHTML = `<div class="big-empty"><h1 class="page-title">We couldn't find that card</h1><p>It may have been removed, or the link is incomplete.</p><a class="btn" href="shop.html">Browse all cards</a></div>`;
		return;
	}
	const { card, cat } = x;
	const FORM_KEY = `lp:form:${card.id}`;
	document.title = t("{name} – {card} – Little Post", { name: t(card.name), card: t(`${cat.title} card`) });
	let draftId = null;

	const related = cat.cards.filter(c => c.id !== card.id).slice(0, 4).map(c => LP.byId(c.id));
	view.innerHTML = `
		<nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="shop.html">Shop</a><span aria-hidden="true">/</span><a href="shop.html?cat=${cat.id}">${esc(cat.title)}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(card.name)}</span></nav>
		<div class="product" style="--tint:${cat.tint}">
			<section class="p-stage" aria-label="Card preview">
				<div class="view-tabs" role="tablist" aria-label="Preview side">
					<button type="button" role="tab" id="tabFront" aria-selected="true" aria-controls="paneFront">Front</button>
					<button type="button" role="tab" id="tabInside" aria-selected="false" aria-controls="paneInside" tabindex="-1">Inside</button>
				</div>
				<div class="pin" id="paneFront" role="tabpanel" aria-labelledby="tabFront"><div class="cover-art">${coverHTML(card, esc(t("{name}, a {cat} card", { name: t(card.name), cat: cat.title.toLowerCase(), card: t(`${cat.title} card`) })))}</div></div>
				<div class="pin" id="paneInside" role="tabpanel" aria-labelledby="tabInside" hidden>
					<div class="inside-preview" translate="no">
						<p class="to" id="pvTo">Dear you,</p>
						<p class="msg is-empty" id="pvMsg">Your message shows up here.</p>
						<p class="from" id="pvFrom"></p>
					</div>
				</div>
				<p class="p-note">This is how it looks when they open it. The sender's name, message and card appear on a private page.</p>
			</section>

			<section class="p-info">
				<h1>${esc(card.name)}</h1>
				<div class="p-meta">
					<a class="cat" href="shop.html?cat=${cat.id}" style="--tint:${cat.tint}">${esc(cat.title)}</a>
					<span class="price">${LP.price(card)}</span>
				</div>
				<p class="p-desc">${esc(LP.describe(x))}</p>

				<form class="p-form" id="form" novalidate>
					<h2>Personalise it</h2>
					<div class="field">
						<label for="fTo">Who is it for?</label>
						<input id="fTo" maxlength="40" autocomplete="off" placeholder="e.g. Yumi" aria-describedby="eTo">
						<span class="err" id="eTo" hidden></span>
					</div>
					<div class="field">
						<label for="fMsg">Your message</label>
						<textarea id="fMsg" rows="5" maxlength="400" placeholder="Write something kind…" aria-describedby="eMsg"></textarea>
						<span class="err" id="eMsg" hidden></span>
						<div class="msg-tools"><span id="count">0 / 400</span></div>
						<div class="ideas" id="ideas" aria-label="Message ideas">${cat.messages.map((m, i) => `<button class="idea" type="button" data-i="${i}">${esc(m)}</button>`).join("")}</div>
					</div>
					<div class="field">
						<label for="fFrom">From <small>(optional)</small></label>
						<input id="fFrom" maxlength="40" autocomplete="off" placeholder="Your name">
					</div>
					<div class="buy-row">
						<button class="btn" type="submit" id="addBtn">${(priceOf(card) ? t("Add to cart · {price}", { price: LP.price(card) }) : t("Add to cart"))}</button>
						<button class="btn butter" type="button" id="buyBtn">Send now</button>
						<button class="heart" type="button" id="favBtn" aria-pressed="false" aria-label="${esc(t("Favourite {name}", { name: t(card.name) }))}">${LP.icons.heart}</button>
					</div>
					<div class="save-draft">
						<button class="btn small soft" type="button" id="draftBtn">Save as draft</button>
						<span class="muted" id="draftNote">Keep this for later in your account.</span>
					</div>
				</form>
			</section>
		</div>

		${related.length ? `<section class="related" aria-labelledby="relTitle"><div class="sec-head"><h2 id="relTitle">${esc(t("More {cards}", { cards: t(`${cat.title} cards`).toLowerCase() }))}</h2><a class="more" href="shop.html?cat=${cat.id}">${t("See all {n} →", { n: cat.cards.length })}</a></div><div class="tiles" id="relGrid">${related.map(r => LP.tileHTML(r)).join("")}</div></section>` : ""}`;

	const f = { to: $("#fTo"), msg: $("#fMsg"), from: $("#fFrom") };
	const val = () => ({ to: f.to.value.trim(), message: f.msg.value.trim(), from: f.from.value.trim() });

	/* ---------- live preview ---------- */
	function sync() {
		const v = val();
		$("#pvTo").textContent = v.to ? t("Dear {name},", { name: v.to }) : t("Dear you,");
		const m = $("#pvMsg"); m.textContent = v.message || t("Your message shows up here."); m.classList.toggle("is-empty", !v.message);
		$("#pvFrom").textContent = v.from ? t("With love, {name}", { name: v.from }) : "";
		$("#count").textContent = `${f.msg.value.length} / 400`;
		store.set(FORM_KEY, { to: f.to.value, message: f.msg.value, from: f.from.value });
	}
	[f.to, f.msg, f.from].forEach(el => el.addEventListener("input", () => { sync(); clearErr(); }));
	$("#ideas").addEventListener("click", e => {
		const b = e.target.closest(".idea"); if (!b) return;
		f.msg.value = t(cat.messages[b.dataset.i]); sync(); clearErr(); f.msg.focus();
	});

	/* front / inside tabs (arrow keys move between them) */
	const tabs = [$("#tabFront"), $("#tabInside")], panes = [$("#paneFront"), $("#paneInside")];
	const show = i => tabs.forEach((t, j) => { t.setAttribute("aria-selected", i === j); t.tabIndex = i === j ? 0 : -1; panes[j].hidden = i !== j; });
	tabs.forEach((t, i) => { t.addEventListener("click", () => show(i)); t.addEventListener("keydown", e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { const n = (i + 1) % 2; show(n); tabs[n].focus(); } }); });

	/* ---------- restore what they typed (or a saved draft) ---------- */
	const saved = store.get(FORM_KEY, null);
	if (saved && typeof saved === "object") { f.to.value = String(saved.to || "").slice(0, 40); f.msg.value = String(saved.message || "").slice(0, 400); f.from.value = String(saved.from || "").slice(0, 40); }
	sync();
	if (params.get("draft")) LP.ready.then(async () => {
		if (!LP.sb || !LP.user) return;
		const { data } = await LP.sb.from("personalized_cards").select("id,recipient_name,message,sender_name").eq("id", params.get("draft")).eq("card_id", card.id).maybeSingle();
		if (data) { draftId = data.id; f.to.value = data.recipient_name; f.msg.value = data.message; f.from.value = data.sender_name; sync(); $("#draftNote").textContent = "Draft loaded. Saving again updates it."; }
	});

	/* ---------- validation ---------- */
	function clearErr() { ["eTo", "eMsg"].forEach(id => { $("#" + id).hidden = true; }); [f.to, f.msg].forEach(el => el.removeAttribute("aria-invalid")); }
	function check() {
		clearErr(); const v = val(); let bad = null;
		if (!v.message) { $("#eMsg").textContent = "Write a short message, or pick one of the ideas."; $("#eMsg").hidden = false; f.msg.setAttribute("aria-invalid", "true"); bad = f.msg; }
		if (!v.to) { $("#eTo").textContent = "Add who the card is for."; $("#eTo").hidden = false; f.to.setAttribute("aria-invalid", "true"); bad = f.to; }
		if (bad) { bad.focus(); return null; }
		return v;
	}

	$("#form").addEventListener("submit", e => {
		e.preventDefault(); const v = check(); if (!v) return;
		LP.Cart.add({ cardId: card.id, ...v });
		LP.toast("Added to your cart ♥", { href: "cart.html", text: "View cart" });
		const b = $("#addBtn"); b.textContent = "Added ✓"; setTimeout(() => { b.textContent = (priceOf(card) ? t("Add to cart · {price}", { price: LP.price(card) }) : t("Add to cart")); }, 1600);
	});
	$("#buyBtn").addEventListener("click", () => { const v = check(); if (!v) return; LP.Cart.add({ cardId: card.id, ...v }); location.href = "cart.html"; });

	/* ---------- favourite ---------- */
	const favBtn = $("#favBtn");
	const syncFav = () => favBtn.setAttribute("aria-pressed", LP.favs.has(card.id));
	favBtn.addEventListener("click", async () => { favBtn.classList.remove("pop"); void favBtn.offsetWidth; favBtn.classList.add("pop"); await LP.toggleFav(card.id); syncFav(); });
	document.addEventListener("lp:favs", syncFav); LP.ready.then(syncFav);

	/* ---------- draft ---------- */
	$("#draftBtn").addEventListener("click", async () => {
		if (!LP.configured) { LP.toast("Accounts aren't switched on yet."); return; }
		if (!LP.user) { LP.toast("Log in to save drafts.", { href: LP.loginUrl(`product.html?card=${card.id}`), text: "Log in" }); return; }
		const v = val(), row = { card_id: card.id, recipient_name: v.to, message: v.message, sender_name: v.from, updated_at: new Date().toISOString() };
		const btn = $("#draftBtn"); btn.disabled = true;
		const res = draftId ? await LP.sb.from("personalized_cards").update(row).eq("id", draftId).select("id").single()
			: await LP.sb.from("personalized_cards").insert({ ...row, user_id: LP.user.id }).select("id").single();
		btn.disabled = false;
		if (res.error) { LP.toast("Couldn't save the draft. Please try again."); return; }
		draftId = res.data.id; $("#draftNote").textContent = "Draft saved in your account."; LP.toast("Draft saved ♥", { href: "account.html#drafts", text: "View drafts" });
	});

	const rel = document.getElementById("relGrid"); if (rel) LP.bindTiles(rel);
})();
