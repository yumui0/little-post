/* Little Post – home page */
(() => {
	const { $, esc, money, ALL, t } = LP;
	const $id = id => document.getElementById(id);

	/* ---------- hero (unchanged) ---------- */
	$id("heroCount").textContent = t("{n} cards for {k} kinds of occasion, and more coming.", { n: ALL.length, k: SHOP.categories.length });
	const pick = (id, i) => findCategory(id).cards[i];
	$id("fan").innerHTML = [["thankyou", 5, "p1"], ["christmas", 1, "p2"], ["love", 0, "p3"]]
		.map(([id, i, cls]) => `<div class="piece ${cls}"><div class="cover-art">${coverHTML(pick(id, i))}</div></div>`).join("");

	/* ---------- shop by occasion ---------- */
	const mini = c => `<div class="mini"><div class="cover-art">${coverHTML(c, "", true).replace("<img ", '<img loading="lazy" ')}</div></div>`;
	$id("occGrid").innerHTML = SHOP.categories.map(cat => `
		<a class="occ" href="shop.html?cat=${cat.id}" style="--tint:${cat.tint}" aria-label="${esc(t("{cat} cards, {n} to choose from", { cat: cat.title, cards: t(`${cat.title} cards`), n: cat.cards.length }))}">
			<div class="occ-text">
				<h3>${esc(cat.title)}</h3>
				<p>${esc(cat.blurb)}</p>
				<span class="occ-n">${t(cat.cards.length === 1 ? "{n} card" : "{n} cards", { n: cat.cards.length })}</span>
			</div>
			<div class="occ-art" aria-hidden="true">${cat.cards.slice(0, 2).map(mini).join("")}</div>
		</a>`).join("") + `
		<a class="occ occ-all" href="shop.html">
			<div class="occ-text">
				<h3>Every card</h3>
				<p>${t("Browse all {n} cards, search and filter.", { n: ALL.length })}</p>
				<span class="btn small soft" aria-hidden="true">Shop all cards</span>
			</div>
		</a>`;

	/* ---------- popular + new ---------- */
	const popular = ALL.filter(x => x.card.fave).slice(0, 4);
	const seen = new Set();
	const fresh = [...ALL].sort((a, b) => b.card.added.localeCompare(a.card.added))
		.filter(x => !seen.has(x.cat.id) && seen.add(x.cat.id)).slice(0, 4);
	const fill = (id, list) => { const el = $id(id); el.innerHTML = list.map(x => LP.tileHTML(x)).join(""); LP.bindTiles(el); };
	fill("popGrid", popular);
	fill("newGrid", fresh);

	/* ---------- personalise teaser (a real card with an example note) ---------- */
	const demo = findCategory("birthday").cards[4];
	$id("persoArt").innerHTML = `
		<div class="pin"><div class="cover-art">${coverHTML(demo)}</div></div>
		<div class="inside-preview">
			<p class="to">Dear Yumi,</p>
			<p class="msg">Happy birthday! I hope your day is full of cake and everything you love.</p>
			<p class="from">With love, x</p>
		</div>`;
})();
