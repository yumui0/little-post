/* Little Post – shared by every page: cart, accounts, favourites, header, footer, card tiles, share dialog. */
(() => {
	const cfg = window.LP_CONFIG || {};
	const $ = (s, r = document) => r.querySelector(s);
	const $$ = (s, r = document) => [...r.querySelectorAll(s)];
	const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
	const { t, lang, locale } = window.I18N;   // js/i18n.js
	const money = cents => (cents / 100).toLocaleString(locale, { style: "currency", currency: "EUR" });
	const price = card => priceOf(card) ? money(priceOf(card)) : t("Free");   // what a card costs, as shown on the page
	const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));
	const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

	/* ---------- catalogue ---------- */
	const ALL = SHOP.categories.flatMap(cat => cat.cards.map((card, idx) => ({ cat, card, idx, id: card.id })));
	const byId = id => ALL.find(x => x.id === id);

	/* if a small thumbnail is missing, show the full-size picture instead */
	document.addEventListener("error", e => { const i = e.target; if (i && i.tagName === "IMG" && i.dataset.full && !i.dataset.fell) { i.dataset.fell = "1"; i.src = i.dataset.full; } }, true);

	/* ---------- storage that never throws ---------- */
	const mem = {};
	const store = {
		get(k, d) { try { const v = localStorage.getItem(k); return v === null ? (k in mem ? mem[k] : d) : JSON.parse(v); } catch (e) { return k in mem ? mem[k] : d; } },
		set(k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
	};

	/* ---------- supabase (optional until configured) ---------- */
	let sb = null;
	if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase) {
		// "Remember me": session lives in localStorage when ticked, otherwise only until the tab closes
		const pick = () => { try { return localStorage.getItem("lp:remember") === "0" ? sessionStorage : localStorage; } catch (e) { return localStorage; } };
		const storage = {
			getItem: k => { try { return pick().getItem(k) ?? localStorage.getItem(k) ?? sessionStorage.getItem(k); } catch (e) { return null; } },
			setItem: (k, v) => { try { pick().setItem(k, v); } catch (e) {} },
			removeItem: k => { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) {} }
		};
		sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
	}

	const LP = { cfg, $, $$, esc, money, price, t, lang, locale, emit, store, ALL, byId, sb, configured: !!sb, user: null, favs: new Set(), reduceMotion };
	window.LP = LP;

	/* only same-site relative paths are allowed as a redirect target */
	LP.safeNext = (v, fallback = "account.html") => (typeof v === "string" && /^[A-Za-z0-9_\-./?=&%#]+$/.test(v) && !v.startsWith("/") && !v.includes("..")) ? v : fallback;
	LP.loginUrl = next => `login.html?next=${encodeURIComponent(next || location.pathname.split("/").pop() + location.search + location.hash)}`;

	/* ---------- toast ---------- */
	let toastTimer;
	LP.toast = (msg, link) => {
		let el = $("#toast");
		if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); document.body.appendChild(el); }
		const host = $("dialog[open]") || document.body;
		host.appendChild(el);
		el.innerHTML = esc(msg) + (link ? ` <a href="${esc(link.href)}">${esc(link.text)}</a>` : "");
		el.classList.add("show");
		clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), link ? 4200 : 2000);
	};

	/* ---------- cart (kept in this browser; the server re-prices everything when the cards are made) ---------- */
	const CART_KEY = "littlepost:cart";
	const uid = () => Math.random().toString(36).slice(2, 10);
	const Cart = {
		items() { const v = store.get(CART_KEY, []); return Array.isArray(v) ? v.filter(i => i && byId(i.cardId)) : []; },
		save(items) { store.set(CART_KEY, items); emit("lp:cart"); },
		add(item) { const items = this.items(); const line = { uid: uid(), cardId: item.cardId, to: item.to || "", message: item.message || "", from: item.from || "" }; items.push(line); this.save(items); return line; },
		update(id, patch) { this.save(this.items().map(i => i.uid === id ? { ...i, ...patch } : i)); },
		remove(id) { this.save(this.items().filter(i => i.uid !== id)); },
		clear() { this.save([]); },
		count() { return this.items().length; },
		totalCents() { return this.items().reduce((sum, i) => sum + priceOf(byId(i.cardId).card), 0); },   // display only
		get(id) { return this.items().find(i => i.uid === id); }
	};
	LP.Cart = Cart;

	/* ---------- auth + favourites ---------- */
	const loadFavs = async () => {
		if (!sb || !LP.user) { LP.favs = new Set(); return; }
		const { data } = await sb.from("favorites").select("card_id");
		LP.favs = new Set((data || []).map(r => r.card_id));
	};
	LP.ready = (async () => {
		if (!sb) return;
		try { const { data } = await sb.auth.getSession(); LP.user = data?.session?.user || null; await loadFavs(); } catch (e) { console.warn(e); }
		sb.auth.onAuthStateChange((event, session) => {
			setTimeout(async () => {   // never call the database from inside this callback directly
				const was = LP.user?.id;
				LP.user = session?.user || null;
				if (was !== LP.user?.id) { await loadFavs(); emit("lp:favs"); }
				emit("lp:auth", { event });
			}, 0);
		});
	})();

	LP.toggleFav = async id => {
		if (!sb || !LP.user) { LP.toast("Log in to save favourites.", { href: LP.loginUrl(), text: "Log in" }); return false; }
		const had = LP.favs.has(id);
		had ? LP.favs.delete(id) : LP.favs.add(id); emit("lp:favs");          // optimistic
		const res = had ? await sb.from("favorites").delete().eq("card_id", id).eq("user_id", LP.user.id)
			: await sb.from("favorites").insert({ user_id: LP.user.id, card_id: id });
		if (res.error) { had ? LP.favs.add(id) : LP.favs.delete(id); emit("lp:favs"); LP.toast("Couldn't save that. Please try again."); return false; }
		LP.toast(had ? "Removed from favourites" : "Added to favourites ♥");
		return true;
	};

	LP.signOut = async () => { if (sb) await sb.auth.signOut(); LP.user = null; LP.favs = new Set(); emit("lp:favs"); };

	/* ---------- icons ---------- */
	const I = {
		heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5C5 15.3 3 11.8 4.2 8.6 5.4 5.6 9.4 5.2 12 8.4c2.6-3.2 6.6-2.8 7.8.2 1.2 3.2-.8 6.7-7.8 11.9Z"/></svg>',
		search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="m16 16 5 5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
		user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M4 21c.8-4.4 4-6 8-6s7.200 1.600 8 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
		bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8Z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M9 8V6.500a3 3 0 0 1 6 0V8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
		moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/></svg>',
		sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
		menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>'
	};
	LP.icons = I;

	/* ---------- header + footer ---------- */
	const page = location.pathname.split("/").pop() || "index.html";
	const here = (...names) => names.includes(page) ? ' aria-current="page"' : "";
	const header = $("#siteHeader");
	if (header) {
		header.classList.add("top");
		header.innerHTML = `
			<a class="logo" href="index.html" aria-label="Little Post, home">
				<svg viewBox="0 0 48 36" width="40" height="30" aria-hidden="true"><rect x="2" y="3" width="44" height="30" rx="7" fill="#ffd3e1" stroke="#3b2745" stroke-width="3"/><path d="M4 8 24 22 44 8" fill="none" stroke="#3b2745" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M24 31c-7-5-9-9-6-11 2-1 5 0 6 2 1-2 4-3 6-2 3 2 1 6-6 11Z" fill="#ff6f9c" stroke="#3b2745" stroke-width="2.4" stroke-linejoin="round"/></svg>
				<span>Little Post</span>
			</a>
			<nav id="mainNav" aria-label="Main">
				<a href="index.html"${here("index.html", "")}>Home</a>
				<a href="shop.html"${here("shop.html", "product.html")}>Shop all cards</a>
				<a href="index.html#occasions">Occasions</a>
				<a href="notes.html"${here("notes.html")}>Notes</a>
				<a href="account.html#favorites" id="favLink">Favourites <span class="count" id="favCount" hidden>0</span></a>
			</nav>
			<div class="tools">
				<button class="iconbtn lang" id="langToggle" type="button" translate="no" lang="${lang === "fr" ? "en" : "fr"}" aria-label="${lang === "fr" ? "Switch to English" : "Passer en français"}">${lang === "fr" ? "EN" : "FR"}</button>
				<button class="iconbtn" id="themeToggle" type="button"></button>
				<button class="iconbtn" id="searchToggle" type="button" aria-label="Search cards" aria-expanded="false" aria-controls="searchBar">${I.search}</button>
				<a class="iconbtn" href="account.html" id="accountLink" aria-label="My account"${here("account.html", "login.html", "signup.html")}>${I.user}</a>
				<a class="iconbtn" href="cart.html" aria-label="Cart, 0 cards"${here("cart.html")} id="cartLink">${I.bag}<span class="badge" id="cartBadge" hidden>0</span></a>
				<button class="iconbtn menu" id="menuToggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="mainNav">${I.menu}</button>
			</div>
			<form class="searchbar" id="searchBar" action="shop.html" role="search" hidden>
				<label class="visually-hidden" for="navQ">Search cards</label>
				<input id="navQ" name="q" type="search" placeholder="Search birthday, love, sorry…" autocomplete="off">
				<button class="btn small" type="submit">Search</button>
			</form>`;
		const nav = $("#mainNav"), menuBtn = $("#menuToggle"), sbar = $("#searchBar"), sBtn = $("#searchToggle");
		menuBtn.addEventListener("click", () => { const o = nav.classList.toggle("open"); menuBtn.setAttribute("aria-expanded", o); });
		sBtn.addEventListener("click", () => { sbar.hidden = !sbar.hidden; sBtn.setAttribute("aria-expanded", !sbar.hidden); if (!sbar.hidden) $("#navQ").focus(); });
		document.addEventListener("keydown", e => { if (e.key === "Escape" && !sbar.hidden) { sbar.hidden = true; sBtn.setAttribute("aria-expanded", "false"); sBtn.focus(); } });
		/* theme: the device setting unless the visitor chose one here (remembered in this browser) */
		const tBtn = $("#themeToggle"), darkMq = matchMedia("(prefers-color-scheme: dark)");
		const isDark = () => (document.documentElement.dataset.theme || (darkMq.matches ? "dark" : "light")) === "dark";
		const syncTheme = () => { const d = isDark(); tBtn.innerHTML = d ? I.sun : I.moon; tBtn.setAttribute("aria-label", d ? "Switch to light theme" : "Switch to dark theme"); };
		tBtn.addEventListener("click", () => {
			const next = isDark() ? "light" : "dark";
			document.documentElement.dataset.theme = next;
			try { localStorage.setItem("lp-theme", next); } catch (e) {}
			syncTheme();
		});
		darkMq.addEventListener("change", syncTheme); syncTheme();
		/* language: remembered in this browser; the page reloads so everything is drawn in the new language */
		$("#langToggle").addEventListener("click", () => { try { localStorage.setItem("lp-lang", lang === "fr" ? "en" : "fr"); } catch (e) {} location.reload(); });
		const syncCart = () => {
			const n = Cart.count(), b = $("#cartBadge");
			b.hidden = !n; b.textContent = n; $("#cartLink").setAttribute("aria-label", t(n === 1 ? "Cart, {n} card" : "Cart, {n} cards", { n }));
		};
		const syncFavCount = () => { const n = LP.favs.size, c = $("#favCount"); c.hidden = !n; c.textContent = n; };
		const syncAuthLinks = () => {
			$("#accountLink").setAttribute("aria-label", LP.user ? "My account" : "Log in or sign up");
			$("#favLink").href = LP.user ? "account.html#favorites" : LP.loginUrl("account.html#favorites");
		};
		document.addEventListener("lp:cart", syncCart); document.addEventListener("lp:favs", syncFavCount); document.addEventListener("lp:auth", syncAuthLinks);
		window.addEventListener("storage", e => { if (e.key === CART_KEY) syncCart(); });
		syncCart(); syncAuthLinks(); LP.ready.then(() => { syncFavCount(); syncAuthLinks(); });
	}

	const footer = $("#siteFooter");
	if (footer) {
		footer.classList.add("foot");
		footer.innerHTML = `
			<div class="foot-grid">
				<div><p class="foot-brand">Little Post</p><p>${t("Cute e-cards for every little occasion, free to send. Made with ♥ for people who like sending nice things.")}</p></div>
				<nav aria-label="Shop"><h2>Shop</h2><a href="shop.html">All cards</a><a href="index.html#occasions">By occasion</a><a href="shop.html?cat=birthday">Birthday</a><a href="shop.html?cat=thankyou">Thank you</a><a href="shop.html?cat=love">Love</a></nav>
				<nav aria-label="Help"><h2>Help</h2><a href="faq.html">FAQ</a><a href="notes.html">Notes</a><a href="contact.html">Contact us</a><a href="account.html">My account</a></nav>
				<nav aria-label="Legal"><h2>Legal</h2><a href="terms.html">Terms of use</a><a href="privacy.html">Privacy policy</a></nav>
			</div>
			<p class="credit">${t("© {year} Little Post. Made by Yumi.", { year: new Date().getFullYear() })}</p>`;
	}

	/* ---------- card tiles (shop, home, product page) ---------- */
	LP.tileHTML = (x, opts = {}) => {
		const { card, cat } = x;
		return `
		<article class="item" data-id="${card.id}">
			${card.free && PRICE_CENTS ? '<span class="sticker free">Free to try</span>' : card.fave ? '<span class="sticker">Fan favourite</span>' : ""}
			<a class="thumb" href="product.html?card=${card.id}" aria-label="${esc(t("Open {name}", { name: t(card.name) }))}">
				<div class="cover-art">${coverHTML(card, "", true).replace("<img ", '<img loading="lazy" ')}</div>
			</a>
			<div class="info">
				<h3><a href="product.html?card=${card.id}">${esc(card.name)}</a></h3>
				<span class="cat" style="--tint:${cat.tint}">${esc(cat.title)}</span>
			</div>
			<div class="row">
				<span class="price">${price(card)}</span>
				<button class="heart" type="button" data-fav aria-pressed="${LP.favs.has(card.id)}" aria-label="${esc(t("Favourite {name}", { name: t(card.name) }))}">${I.heart}</button>
			</div>
			<div class="tile-actions">
				<button class="btn small soft" type="button" data-preview>Preview Card</button>
				<a class="btn small soft" href="product.html?card=${card.id}">Personalise</a>
				<button class="btn small wide" type="button" data-add>Add to cart</button>
			</div>
		</article>`;
	};
	const syncHearts = () => $$(".heart[data-fav]").forEach(b => { const id = b.closest("[data-id]")?.dataset.id || b.dataset.id; if (id) b.setAttribute("aria-pressed", LP.favs.has(id)); });
	document.addEventListener("lp:favs", syncHearts);
	LP.ready.then(syncHearts);

	LP.addToCartQuick = id => {
		Cart.add({ cardId: id });
		LP.toast("Added to your cart ♥", { href: "cart.html", text: "View cart" });
	};

	LP.bindTiles = root => root.addEventListener("click", async e => {
		const tile = e.target.closest("[data-id]"); if (!tile) return;
		const id = tile.dataset.id;
		if (e.target.closest("[data-fav]")) {
			const btn = e.target.closest("[data-fav]");
			btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop");
			await LP.toggleFav(id); syncHearts();
		} else if (e.target.closest("[data-preview]")) LP.openPreview(id);
		else if (e.target.closest("[data-add]")) LP.addToCartQuick(id);
	});

	/* ---------- preview dialog ---------- */
	LP.openPreview = id => {
		const x = byId(id); if (!x) return;
		let dlg = $("#previewDlg");
		if (!dlg) {
			dlg = document.createElement("dialog"); dlg.id = "previewDlg"; dlg.className = "narrow"; dlg.setAttribute("aria-labelledby", "pvTitle");
			document.body.appendChild(dlg);
			dlg.addEventListener("click", e => {
				if (e.target === dlg || e.target.closest("[data-close]")) dlg.close();
				else if (e.target.closest("[data-pv-add]")) { LP.addToCartQuick(dlg.dataset.id); }
				else if (e.target.closest("[data-pv-buy]")) { Cart.add({ cardId: dlg.dataset.id }); location.href = "cart.html"; }
				else if (e.target.closest("[data-pv-fav]")) LP.toggleFav(dlg.dataset.id).then(() => syncHearts());
			});
			document.addEventListener("lp:favs", () => { const b = $("[data-pv-fav]", dlg); if (b) b.setAttribute("aria-pressed", LP.favs.has(dlg.dataset.id)); });
		}
		dlg.dataset.id = id;
		dlg.innerHTML = `
			<button class="close" type="button" data-close aria-label="Close preview">✕</button>
			<div class="pv" style="--tint:${x.cat.tint}">
				<div class="pin"><div class="cover-art">${coverHTML(x.card, esc(t(x.card.name)))}</div></div>
				<div class="pv-info">
					<h2 id="pvTitle">${esc(x.card.name)}</h2>
					<p class="pv-cat">${esc(t(x.cat.title))} · <span class="price">${price(x.card)}</span></p>
					<p>${esc(LP.describe(x))}</p>
					<div class="pv-actions">
						<a class="btn" href="product.html?card=${id}">Personalise</a>
						<button class="btn soft" type="button" data-pv-add>Add to cart</button>
						<button class="btn butter" type="button" data-pv-buy>Send now</button>
						<button class="heart" type="button" data-pv-fav aria-pressed="${LP.favs.has(id)}" aria-label="Favourite">${I.heart}</button>
					</div>
				</div>
			</div>`;
		dlg.showModal();
	};

	LP.describe = x => {
		const st = t((STYLES.find(s => s[0] === x.card.style) || [0, "Cute"])[1]).toLowerCase();
		return t("A {style} {cat} eCard. Add your own words inside, then send it with a private link or a QR code.", { style: st, cat: x.cat.title.toLowerCase(), card: t(`${x.cat.title} card`) });
	};

	/* ---------- a card turned into a picture (download) ---------- */
	const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
	const wrap = (ctx, text, maxW) => {
		const out = [];
		for (const para of String(text).split("\n")) {
			let line = "";
			for (const w of para.split(/\s+/)) {
				const t = line ? line + " " + w : w;
				if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
			}
			out.push(line);
		}
		return out;
	};
	LP.renderCardPNG = async ({ cardId, to, message, from }) => {
		const x = byId(cardId); if (!x) throw new Error("unknown card");
		try { await Promise.all([document.fonts.load('80px "Bagel Fat One"'), document.fonts.load('48px "Gaegu"')]); } catch (e) {}
		const W = 1400, H = 1000, GAP = 60, PAD = 40;
		const c = document.createElement("canvas"); c.width = W * 2 + GAP + PAD * 2; c.height = H + PAD * 2;
		const g = c.getContext("2d");
		g.fillStyle = "#fff0f4"; g.fillRect(0, 0, c.width, c.height);
		const img = await loadImg(x.card.src);
		g.drawImage(img, PAD, PAD, W, H);
		if (x.card.caption) {
			g.fillStyle = "#3b2745"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = '90px "Bagel Fat One", "Arial Rounded MT Bold", sans-serif';
			const lines = wrap(g, x.card.caption, W * .5), lh = 101, y0 = PAD + H * ((x.card.capY ?? 50) / 100) - ((lines.length - 1) * lh) / 2;
			lines.forEach((l, i) => g.fillText(l, PAD + W / 2, y0 + i * lh));
		}
		const ix = PAD + W + GAP;
		g.fillStyle = "#fffdf8"; g.fillRect(ix, PAD, W, H);
		g.fillStyle = "rgba(59,39,69,.12)"; for (let yy = PAD + 30; yy < PAD + H; yy += 44) for (let xx = ix + 30; xx < ix + W; xx += 44) { g.beginPath(); g.arc(xx, yy, 2.4, 0, 7); g.fill(); }
		g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillStyle = "#3b2745";
		g.font = '84px "Bagel Fat One", "Arial Rounded MT Bold", sans-serif';
		g.fillText(to ? t("Dear {name},", { name: to }) : t("Hello,"), ix + 110, PAD + 200, W - 220);
		g.font = '700 58px "Gaegu", "Comic Sans MS", cursive';
		const lines = wrap(g, message, W - 220); let y = PAD + 300;
		for (const l of lines.slice(0, 12)) { g.fillText(l, ix + 110, y); y += 72; }
		if (from) { g.fillStyle = "#d93f78"; g.textAlign = "right"; g.fillText(t("With love, {name}", { name: from }), ix + W - 110, Math.min(y + 70, PAD + H - 90)); }
		g.strokeStyle = "#3b2745"; g.lineWidth = 8;
		g.strokeRect(PAD, PAD, W, H); g.strokeRect(ix, PAD, W, H);
		return await new Promise(res => c.toBlob(res, "image/png"));
	};

	/* ---------- share dialog (used by the account page and the thank-you page) ---------- */
	LP.openShare = item => {
		let dlg = $("#shareDlg");
		if (!dlg) {
			dlg = document.createElement("dialog"); dlg.id = "shareDlg"; dlg.className = "narrow"; dlg.setAttribute("aria-labelledby", "shTitle");
			dlg.innerHTML = `
				<button class="close" type="button" data-close aria-label="Close">✕</button>
				<div class="share">
					<h2 id="shTitle">Send your card</h2>
					<p class="muted">Anyone with this private link can open the card. Only share it with the person it's for.</p>
					<div class="copy-row"><input id="shLink" readonly aria-label="Card link"><button class="btn small butter" id="shCopy" type="button">Copy link</button></div>
					<div class="qr-row">
						<canvas id="shQr" width="320" height="320" aria-label="QR code for the card link"></canvas>
						<div class="qr-actions">
							<a class="btn small soft" id="shOpen" target="_blank" rel="noopener">Open card</a>
							<a class="btn small soft" id="shMail">Send by email</a>
							<button class="btn small soft" id="shShare" type="button" hidden>Share…</button>
							<a class="btn small soft" id="shQrSave" download="little-post-qr.png" href="#">Save QR code</a>
							<button class="btn small soft" id="shPng" type="button">Download card (PNG)</button>
						</div>
					</div>
				</div>`;
			document.body.appendChild(dlg);
			dlg.addEventListener("click", e => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); });
			$("#shCopy", dlg).addEventListener("click", async () => {
				const i = $("#shLink", dlg);
				try { await navigator.clipboard.writeText(i.value); } catch (e) { i.select(); document.execCommand("copy"); }
				LP.toast("Link copied");
			});
			$("#shShare", dlg).addEventListener("click", () => navigator.share({ title: t("A card for you"), text: t("I made you a card."), url: $("#shLink", dlg).value }).catch(() => {}));
			$("#shPng", dlg).addEventListener("click", async e => {
				const b = e.currentTarget, it = dlg._item; b.disabled = true; b.textContent = "Making your picture…";
				try {
					const blob = await LP.renderCardPNG({ cardId: it.cardId, to: it.to, message: it.message, from: it.from });
					const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `little-post-${it.cardId}.png`; document.body.appendChild(a); a.click(); a.remove();
					setTimeout(() => URL.revokeObjectURL(a.href), 4000);
				} catch (err) { LP.toast("Couldn't make the picture. Please try again."); }
				b.disabled = false; b.textContent = "Download card (PNG)";
			});
		}
		dlg._item = item;
		const url = new URL("card.html", location.href); url.search = new URLSearchParams({ t: item.token });
		const link = url.toString();
		$("#shLink", dlg).value = link; $("#shOpen", dlg).href = link;
		$("#shMail", dlg).href = `mailto:?subject=${encodeURIComponent(t("A card for you"))}&body=${encodeURIComponent(t("I made you a card. Open it here:") + "\n\n" + link)}`;
		$("#shShare", dlg).hidden = !navigator.share;
		const cv = $("#shQr", dlg);
		if (window.QRious) { new QRious({ element: cv, value: link, size: 320, padding: 24, level: "M" }); $("#shQrSave", dlg).href = cv.toDataURL("image/png"); cv.hidden = false; $("#shQrSave", dlg).hidden = false; }
		else { cv.hidden = true; $("#shQrSave", dlg).hidden = true; }
		dlg.showModal();
	};

	/* ---------- a card the customer owns (success page, account) ---------- */
	LP.ownedTileHTML = it => {
		const x = byId(it.card_id); if (!x) return "";
		const { card, cat } = x;
		return `
		<article class="item" data-owned="${esc(it.id)}">
			<div class="thumb"><div class="cover-art">${coverHTML(card, esc(t(card.name)), true)}</div></div>
			<div class="info">
				<h3>${esc(card.name)}</h3>
				<span class="cat" style="--tint:${cat.tint}">${esc(cat.title)}</span>
			</div>
			<p class="note" translate="no">${it.recipient_name ? esc(t("For {name}: ", { name: it.recipient_name })) : ""}${esc(it.message)}</p>
			<div class="tile-actions">
				<a class="btn small soft" href="card.html?t=${encodeURIComponent(it.share_token)}" target="_blank" rel="noopener">Open card</a>
				<button class="btn small" type="button" data-share>Send it</button>
			</div>
		</article>`;
	};
	LP.bindOwned = (root, items) => root.addEventListener("click", e => {
		const b = e.target.closest("[data-share]"); if (!b) return;
		const it = items.find(i => i.id === b.closest("[data-owned]").dataset.owned); if (!it) return;
		LP.openShare({ token: it.share_token, cardId: it.card_id, to: it.recipient_name, message: it.message, from: it.sender_name });
	});

	/* ---------- sprinkles: small celebratory burst ---------- */
	LP.confetti = (colors = ["#ff6f9c", "#ffd36e", "#8fd6b4", "#8ec5ff", "#c9a7f0"]) => {
		if (reduceMotion()) return;
		const box = document.createElement("div"); box.className = "confetti"; box.setAttribute("aria-hidden", "true"); document.body.appendChild(box);
		for (let i = 0; i < 30; i++) {
			const s = document.createElement("span"); s.style.background = colors[i % colors.length]; box.appendChild(s);
			const x0 = innerWidth / 2 + (Math.random() - .5) * 120, y0 = innerHeight * .4, x1 = Math.random() * innerWidth, y1 = innerHeight * (.8 + Math.random() * .3), peak = y0 - (60 + Math.random() * 200);
			s.animate([
				{ transform: `translate(${x0}px,${y0}px) scale(.4)`, opacity: 1 },
				{ transform: `translate(${(x0 + x1) / 2}px,${peak}px) scale(1) rotate(${Math.random() * 200}deg)`, opacity: 1, offset: .4 },
				{ transform: `translate(${x1}px,${y1}px) scale(.8) rotate(${Math.random() * 400}deg)`, opacity: 0 }
			], { duration: 1500 + Math.random() * 800, easing: "cubic-bezier(.2,.6,.4,1)", delay: Math.random() * 150 }).onfinish = () => s.remove();
		}
		setTimeout(() => box.remove(), 3000);
	};

	/* tell pages the shared parts are ready */
	emit("lp:ready");
})();
