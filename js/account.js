/* Little Post – the customer dashboard. Every query below is filtered by the database's row-level security to the signed-in user. */
(() => {
	const { $, esc, money, t } = LP;
	const gate = $("#acctGate"), app = $("#acct"), panel = $("#panel");
	const TABS = ["overview", "cards", "orders", "favorites", "drafts", "settings"];
	const data = { items: [], orders: [], drafts: [], name: "" };
	let tab = "overview";

	const showGate = (title, body, actions = "") => { gate.hidden = false; app.hidden = true; gate.innerHTML = `<div class="big-empty"><h2>${title}</h2><p>${body}</p>${actions}</div>`; };
	const fmtDate = s => s ? new Date(s).toLocaleDateString(LP.locale, { day: "numeric", month: "short", year: "numeric" }) : "";
	const loading = what => `<div class="loading">Fetching ${what}…</div>`;
	const empty = (title, text, cta) => `<div class="big-empty"><h2>${title}</h2><p>${text}</p>${cta}</div>`;

	async function boot() {
		if (!LP.configured) return showGate("Accounts aren't switched on yet", "The shop owner needs to connect Supabase first.", `<a class="btn" href="index.html">Back home</a>`);
		await LP.ready;
		if (!LP.user) { location.replace(LP.loginUrl("account.html" + (location.hash || ""))); return; }
		gate.hidden = true; app.hidden = false;
		$("#who").textContent = LP.user.email;
		panel.innerHTML = loading("your things");
		await load();
		route();
	}

	async function load() {
		const sb = LP.sb, uid = LP.user.id;
		const [prof, items, orders, drafts] = await Promise.all([
			sb.from("profiles").select("name").eq("id", uid).maybeSingle(),
			sb.from("order_items").select("id,card_id,recipient_name,message,sender_name,share_token,created_at").order("created_at", { ascending: false }),
			sb.from("orders").select("id,status,total_cents,created_at,paid_at,order_items(card_id)").order("created_at", { ascending: false }),
			sb.from("personalized_cards").select("id,card_id,recipient_name,message,sender_name,updated_at").order("updated_at", { ascending: false })
		]);
		data.name = prof.data?.name || LP.user.user_metadata?.name || "";
		data.items = items.data || []; data.orders = orders.data || []; data.drafts = drafts.data || [];
		data.failed = [prof, items, orders, drafts].some(r => r.error);
		$("#hello").textContent = data.name ? t("Hello, {name}", { name: data.name }) : t("My account");
	}

	/* ---------- tabs ---------- */
	function route() {
		const h = location.hash.slice(1);
		tab = TABS.includes(h) ? h : "overview";
		$$tabs().forEach(a => a.dataset.tab === tab ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current"));
		render();
	}
	function $$tabs() { return [...document.querySelectorAll("#tabs a")]; }
	window.addEventListener("hashchange", route);

	function render() {
		panel.className = "panel"; void panel.offsetWidth;
		const fn = { overview, cards, orders, favorites, drafts, settings }[tab];
		fn();
	}

	function overview() {
		const paid = data.orders.filter(o => o.status === "paid").length;
		panel.innerHTML = `
			${data.failed ? `<div class="notice bad" role="alert"><div>Some of your information couldn't be loaded. Please refresh the page.</div></div>` : ""}
			<div class="stat-row">
				<a class="stat" href="#cards"><b>${data.items.length}</b><span>Cards bought</span></a>
				<a class="stat" href="#orders"><b>${paid}</b><span>Orders</span></a>
				<a class="stat" href="#favorites"><b>${LP.favs.size}</b><span>Favourites</span></a>
				<a class="stat" href="#drafts"><b>${data.drafts.length}</b><span>Drafts</span></a>
			</div>
			<h2>Your latest cards</h2>
			${data.items.length ? `<div class="mine" id="latest">${data.items.slice(0, 4).map(LP.ownedTileHTML).join("")}</div>` : empty("No cards yet", "Cards you get will live here, ready to send whenever you like.", `<a class="btn" href="shop.html">Browse the cards</a>`)}`;
		const l = $("#latest"); if (l) LP.bindOwned(l, data.items);
	}

	function cards() {
		panel.innerHTML = `<h2>My cards</h2>` + (data.items.length
			? `<p class="muted">Open, send or download any card you've bought. Anyone with a card's private link can open it, so only share it with the person it's for.</p><div class="mine" id="mine">${data.items.map(LP.ownedTileHTML).join("")}</div>`
			: empty("No cards yet", "Cards you get will live here, ready to send whenever you like.", `<a class="btn" href="shop.html">Browse the cards</a>`));
		const m = $("#mine"); if (m) LP.bindOwned(m, data.items);
	}

	function orders() {
		const label = { paid: "Ready", pending: "Waiting for payment", failed: "Payment failed", expired: "Not completed" };
		panel.innerHTML = `<h2>Order history</h2>` + (data.orders.length
			? `<div class="orders">${data.orders.map(o => {
				const names = (o.order_items || []).map(i => LP.byId(i.card_id)?.card.name).filter(Boolean);
				return `<article class="order">
					<div class="order-top"><strong>${fmtDate(o.paid_at || o.created_at)}</strong><span class="status ${o.status}">${o.status === "paid" ? "✓ " : ""}${esc(t(label[o.status] || o.status))}</span></div>
					<small>${esc(t("Order {id}", { id: o.id.slice(0, 8) }))}</small>
					${names.length ? `<ul>${names.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
					<div class="sum-row total" style="font-size:1.1rem"><span>Total</span><span>${money(o.total_cents)}</span></div>
					${o.status === "pending" ? `<small>Started a payment but didn't finish? <a href="cart.html">Go back to your cart</a>.</small>` : ""}
				</article>`; }).join("")}</div>`
			: empty("No orders yet", "When you get a card, it will show up here.", `<a class="btn" href="shop.html">Browse the cards</a>`));
	}

	function favorites() {
		const list = [...LP.favs].map(id => LP.byId(id)).filter(Boolean);
		panel.innerHTML = `<h2>Favourites</h2>` + (list.length
			? `<div class="tiles" id="favGrid">${list.map(x => LP.tileHTML(x)).join("")}</div>`
			: empty("No favourites yet", "Tap the heart on any card to keep it here for later.", `<a class="btn" href="shop.html">Find some favourites</a>`));
		const g = $("#favGrid"); if (g) LP.bindTiles(g);
	}
	document.addEventListener("lp:favs", () => { if (tab === "favorites" && !app.hidden) favorites(); else if (tab === "overview" && !app.hidden) overview(); });

	function drafts() {
		panel.innerHTML = `<h2>Drafts</h2>` + (data.drafts.length
			? `<div class="mine" id="drafts">${data.drafts.map(d => { const x = LP.byId(d.card_id); if (!x) return ""; return `
				<article class="item" data-draft="${esc(d.id)}">
					<a class="thumb" href="product.html?card=${x.card.id}&draft=${encodeURIComponent(d.id)}"><div class="cover-art">${coverHTML(x.card, esc(t(x.card.name)), true)}</div></a>
					<div class="info"><h3>${esc(x.card.name)}</h3><span class="cat" style="--tint:${x.cat.tint}">${esc(x.cat.title)}</span></div>
					<p class="note" translate="no">${d.recipient_name ? esc(t("For {name}: ", { name: d.recipient_name })) : ""}${d.message ? esc(d.message) : esc(t("No message yet"))}</p>
					<small class="note">${esc(t("Saved {date}", { date: fmtDate(d.updated_at) }))}</small>
					<div class="tile-actions"><a class="btn small" href="product.html?card=${x.card.id}&draft=${encodeURIComponent(d.id)}">Continue</a><button class="btn small soft" type="button" data-del>Delete</button></div>
				</article>`; }).join("")}</div>`
			: empty("No drafts", "On any card, tap “Save as draft” to keep your words for later.", `<a class="btn" href="shop.html">Pick a card</a>`));
		const d = $("#drafts"); if (d) d.addEventListener("click", async e => {
			const b = e.target.closest("[data-del]"); if (!b) return;
			const id = b.closest("[data-draft]").dataset.draft; b.disabled = true;
			const { error } = await LP.sb.from("personalized_cards").delete().eq("id", id);
			if (error) { b.disabled = false; LP.toast("Couldn't delete that. Please try again."); return; }
			data.drafts = data.drafts.filter(x => x.id !== id); LP.toast("Draft deleted"); drafts();
		});
	}

	function settings() {
		panel.innerHTML = `
			<h2>Settings</h2>
			<div class="settings">
				<form id="nameForm" novalidate>
					<h3>Your details</h3>
					<div class="field"><label for="sEmail">Email</label><input id="sEmail" value="${esc(LP.user.email)}" readonly></div>
					<div class="field"><label for="sName">Name</label><input id="sName" maxlength="60" autocomplete="name" value="${esc(data.name)}"></div>
					<p class="error" id="nameErr" role="alert" hidden></p>
					<button class="btn" type="submit">Save name</button>
				</form>
				<form id="pwForm" novalidate>
					<h3>Change password</h3>
					<div class="field"><label for="pw1">New password</label><input id="pw1" type="password" autocomplete="new-password" minlength="8"><span class="hint">At least 8 characters.</span></div>
					<div class="field"><label for="pw2">Confirm new password</label><input id="pw2" type="password" autocomplete="new-password"></div>
					<p class="error" id="pwErr" role="alert" hidden></p>
					<button class="btn" type="submit">Update password</button>
				</form>
				<div><button class="btn soft" type="button" id="logout2">Log out</button>
				<p class="muted" style="font-size:.9rem">Want your account and data deleted? <a href="contact.html">Contact us</a> and we'll take care of it.</p></div>
			</div>`;
		$("#nameForm").addEventListener("submit", async e => {
			e.preventDefault(); const v = $("#sName").value.trim().slice(0, 60), er = $("#nameErr"); er.hidden = true;
			if (!v) { er.textContent = "Please enter a name."; er.hidden = false; return; }
			const { error } = await LP.sb.from("profiles").update({ name: v }).eq("id", LP.user.id);
			if (error) { er.textContent = "Couldn't save. Please try again."; er.hidden = false; return; }
			data.name = v; $("#hello").textContent = t("Hello, {name}", { name: v }); LP.toast("Name saved ♥");
		});
		$("#pwForm").addEventListener("submit", async e => {
			e.preventDefault(); const a = $("#pw1").value, b = $("#pw2").value, er = $("#pwErr"); er.hidden = true;
			if (a.length < 8) { er.textContent = "Use at least 8 characters."; er.hidden = false; return; }
			if (a !== b) { er.textContent = "The two passwords don't match."; er.hidden = false; return; }
			const { error } = await LP.sb.auth.updateUser({ password: a });
			if (error) { er.textContent = /same/i.test(error.message) ? "Choose a password you haven't used before." : "Couldn't update the password. Please try again."; er.hidden = false; return; }
			$("#pw1").value = $("#pw2").value = ""; LP.toast("Password updated ♥");
		});
		$("#logout2").addEventListener("click", logout);
	}

	async function logout() { await LP.signOut(); LP.toast("You're logged out. See you soon ♥"); setTimeout(() => location.replace("index.html"), 600); }
	$("#logout").addEventListener("click", logout);
	document.addEventListener("lp:auth", e => { if (e.detail?.event === "SIGNED_OUT" && !LP.user) location.replace("index.html"); });

	boot();
})();
