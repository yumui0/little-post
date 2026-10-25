/* Little Post – the shop gallery (all cards, or one occasion). State lives in the URL so every view can be linked to. */
(() => {
	const { $, esc, ALL, t } = LP;
	const $id = id => document.getElementById(id);
	const grid = $id("grid"), searchEl = $id("search"), sortEl = $id("sort");
	const SORTS = ["popular", "newest", "az"];

	const params = new URLSearchParams(location.search);
	const state = {
		cat: findCategory(params.get("cat")) ? params.get("cat") : "all",
		q: (params.get("q") || "").slice(0, 80),
		sort: SORTS.includes(params.get("sort")) ? params.get("sort") : "popular",
		favs: params.get("favs") === "1"
	};
	searchEl.value = state.q; sortEl.value = state.sort;

	const syncUrl = () => {
		const p = new URLSearchParams();
		if (state.cat !== "all") p.set("cat", state.cat);
		if (state.q.trim()) p.set("q", state.q.trim());
		if (state.sort !== "popular") p.set("sort", state.sort);
		if (state.favs) p.set("favs", "1");
		const qs = p.toString();
		try { history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "")); } catch (e) {}
	};

	/* ---------- header of the page ---------- */
	function renderHead() {
		const cat = findCategory(state.cat);
		const head = $id("pageHead");
		head.style.setProperty("--tint", cat ? cat.tint : "var(--pink)");
		$id("headTitle").textContent = cat ? t(`${cat.title} cards`) : t("All cards");
		$id("headText").textContent = cat
			? t(cat.cards.length === 1 ? "{blurb}. {n} free card to choose from." : "{blurb}. {n} free cards to choose from.", { blurb: t(cat.blurb), n: cat.cards.length })
			: t("Every card in the shop, all free. Search, filter or pick an occasion below.");
		document.title = cat ? t("{cards} – Little Post", { cards: t(`${cat.title} cards`) }) : t("Shop all cards – Little Post");
		$id("crumbs").innerHTML = `<a href="index.html">Home</a><span aria-hidden="true">/</span>` +
			(cat ? `<a href="shop.html">Shop</a><span aria-hidden="true">/</span><span aria-current="page">${esc(cat.title)}</span>` : `<span aria-current="page">Shop</span>`);
	}
	const money = LP.money;

	function renderChips() {
		const all = `<button class="chip" type="button" data-cat="all" aria-pressed="${state.cat === "all"}">All <span class="n">${ALL.length}</span></button>`;
		$id("chips").innerHTML = all + SHOP.categories.map(c =>
			`<button class="chip" type="button" data-cat="${c.id}" style="--tint:${c.tint}" aria-pressed="${state.cat === c.id}">${esc(c.title)} <span class="n">${c.cards.length}</span></button>`).join("");
	}
	function renderStyles() {
		$id("styleRow").innerHTML = `<button class="chip sm on-favs" type="button" data-favs aria-pressed="${state.favs}">♥ My favourites</button>`;
	}

	$id("chips").addEventListener("click", e => {
		const b = e.target.closest("[data-cat]"); if (!b) return;
		state.cat = b.dataset.cat; renderAll();
		b.scrollIntoView({ inline: "center", block: "nearest", behavior: LP.reduceMotion() ? "auto" : "smooth" });
	});
	$id("styleRow").addEventListener("click", e => {
		if (e.target.closest("[data-favs]")) {
			if (!LP.user && !state.favs) { LP.toast("Log in to see your favourites.", { href: LP.loginUrl("shop.html?favs=1"), text: "Log in" }); return; }
			state.favs = !state.favs; renderAll();
		}
	});
	searchEl.addEventListener("input", () => { state.q = searchEl.value; renderGrid(); });
	sortEl.addEventListener("change", () => { state.sort = sortEl.value; renderGrid(); });
	$id("clearBtn").addEventListener("click", () => {
		Object.assign(state, { cat: "all", q: "", favs: false }); searchEl.value = ""; renderAll();
	});

	/* ---------- the grid ---------- */
	const words = s => s.toLowerCase().split(/\s+/).filter(Boolean);
	function visible() {
		const terms = words(state.q);
		let list = ALL.filter(x => {
			if (state.cat !== "all" && x.cat.id !== state.cat) return false;
			if (state.favs && !LP.favs.has(x.card.id)) return false;
			if (!terms.length) return true;
			const hay = [x.cat.title, t(x.cat.title), x.cat.id, x.cat.blurb, t(x.cat.blurb), x.card.name, t(x.card.name), x.card.caption || "", x.card.style].join(" ").toLowerCase();
			return terms.every(t => hay.includes(t));
		});
		const pos = x => ALL.indexOf(x);
		if (state.sort === "newest") list = list.sort((a, b) => b.card.added.localeCompare(a.card.added) || pos(a) - pos(b));
		else if (state.sort === "az") list = list.sort((a, b) => t(a.card.name).localeCompare(t(b.card.name), LP.locale));
		else list = list.sort((a, b) => (b.card.fave ? 1 : 0) - (a.card.fave ? 1 : 0) || pos(a) - pos(b));
		return list;
	}

	function renderGrid() {
		const list = visible();
		grid.innerHTML = list.map(x => LP.tileHTML(x)).join("");
		const cat = findCategory(state.cat);
		$id("resultNote").textContent = list.length ? t(`Showing {n} ${list.length === 1 ? "card" : "cards"}${cat ? " in {cat}" : ""}.`, { n: list.length, cat: cat && t(cat.title) }) : "";
		const empty = $id("empty"); empty.hidden = list.length > 0;
		if (!list.length) {
			const t = $id("emptyTitle"), p = $id("emptyText"), b = $id("clearBtn");
			if (state.favs && !LP.favs.size) { t.textContent = "No favourites yet"; p.textContent = "Tap the heart on any card to keep it here for later."; b.textContent = "Show all cards"; }
			else if (state.q.trim()) { t.textContent = "No cards match that"; p.textContent = t("We couldn't find “{q}”. Try a simpler word like birthday or love.", { q: state.q.trim() }); b.textContent = "Clear filters"; }
			else { t.textContent = "No cards here"; p.textContent = "Try another occasion, or show everything."; b.textContent = "Show all cards"; }
		}
		syncUrl();
	}
	function renderAll() { renderHead(); renderChips(); renderStyles(); renderGrid(); }

	LP.bindTiles(grid);
	document.addEventListener("lp:favs", () => { if (state.favs) renderGrid(); });
	renderAll();
	LP.ready.then(() => { if (state.favs && !LP.user) { state.favs = false; renderAll(); } else if (state.favs) renderGrid(); });
})();
