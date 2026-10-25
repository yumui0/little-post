(() => {
	const $ = id => document.getElementById(id);
	const params = new URLSearchParams(location.search);

	const broken = () => { $("hello").hidden = true; $("tap").hidden = true; $("oops").hidden = false; document.title = LP.t("Card link not working"); };

	/* Paid cards open through a private token. The database only answers for orders that are paid. */
	async function lookup() {
		const token = params.get("t");
		if (token) {
			if (!/^[0-9a-f]{64}$/.test(token) || !LP.sb) return null;
			const { data, error } = await LP.sb.rpc("get_shared_card", { p_token: token });
			const row = !error && data && data[0];
			const x = row && LP.byId(row.card_id);
			return x ? { cat: x.cat, card: x.card, to: row.recipient_name || "", text: row.message || "", from: row.sender_name || "" } : null;
		}
		/* links made by the old free version: only while ALLOW_LEGACY_LINKS is on (they bypass payment) */
		if (LP.cfg.ALLOW_LEGACY_LINKS && params.get("card")) {
			const cat = findCategory(params.get("card"));
			const card = cat && cat.cards[Number(params.get("templ"))];
			const text = dec(params.get("text") || "").trim();
			return card && text ? { cat, card, to: dec(params.get("name") || "").trim(), text, from: dec(params.get("from") || "").trim() } : null;
		}
		return null;
	}

	lookup().then(found => { if (!found) return broken(); show(found); }).catch(broken);

	function show({ cat, card, to, text, from }) {
		/* everything the sender typed goes in as plain text, never as HTML */
		$("uname").textContent = to ? LP.t("Dear {name},", { name: to }) : LP.t("Hello,");
		$("utext").textContent = text;
		$("ufrom").textContent = from ? LP.t("With love, {name}", { name: from }) : "";
		$("ufrom").hidden = !from;
		$("utext").classList.toggle("long", text.length > 180);
		$("back").style.setProperty("--tint", cat.tint);
		document.body.style.setProperty("--bg", `color-mix(in srgb, ${cat.tint} calc(var(--tint-amt) * .35), var(--paper))`);
		$("front").innerHTML = coverHTML(card, LP.esc(LP.t(`${cat.title} card`)));

		document.title = to ? LP.t("A card for {name}", { name: to }) : LP.t("You've got a card");
		$("hello").textContent = to ? LP.t("A card for {name}", { name: to }) : LP.t("A card is waiting for you");
		$("stage").hidden = false;
		$("tap").hidden = false;

		const cover = $("cover"), book = $("book"), scene = $("scene");
		let opened = false;

		function open() {
			if (opened) return;
			opened = true;
			cover.setAttribute("aria-expanded", "true");
			cover.setAttribute("aria-label", "Your card is open");
			cover.tabIndex = -1;
			book.classList.add("open");
			scene.classList.add("is-open");
			$("tap").hidden = true;
			$("after").hidden = false;
			confetti();
		}
		cover.addEventListener("click", open);

		function confetti() {
			if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
			const box = $("confetti");
			const bits = [cat.tint, "#ff6f9c", "#ffd36e", "#8fd6b4", "#8ec5ff"];
			for (let i = 0; i < 36; i++) {
				const s = document.createElement("span");
				s.style.background = bits[i % bits.length];
				box.appendChild(s);
				const x0 = innerWidth / 2 + (Math.random() - .5) * 120, y0 = innerHeight * .45;
				const x1 = Math.random() * innerWidth, y1 = innerHeight * (.75 + Math.random() * .4);
				const peak = y0 - (80 + Math.random() * 220);
				s.animate([
					{ transform: `translate(${x0}px, ${y0}px) scale(.4) rotate(0deg)`, opacity: 1 },
					{ transform: `translate(${(x0 + x1) / 2}px, ${peak}px) scale(1) rotate(${Math.random() * 200}deg)`, opacity: 1, offset: .4 },
					{ transform: `translate(${x1}px, ${y1}px) scale(.8) rotate(${Math.random() * 500 - 100}deg)`, opacity: 0 }
				], { duration: 1700 + Math.random() * 900, easing: "cubic-bezier(.2,.6,.4,1)", delay: Math.random() * 150 }).onfinish = () => s.remove();
			}
		}
	}
})();
