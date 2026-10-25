/* Little Post – the notes wall. Notes are written by logged-in visitors and only shown once approved in Supabase. */
(() => {
	const { $, esc, t } = LP;
	const box = $("#noteBox"), wall = $("#wall");
	const MAX = 300;
	const TINTS = ["--butter", "--pink", "--mint", "--sky", "--lilac", "--peach"];
	const fmtDate = s => new Date(s).toLocaleDateString(LP.locale, { day: "numeric", month: "short", year: "numeric" });

	/* one sticky note; the colour and tilt come from its id so they never jump around */
	const noteHTML = (n, own) => {
		const h = [...n.id].reduce((a, c) => a + c.charCodeAt(0), 0);
		return `
		<li class="note${n.approved === false ? " pending" : ""}" style="--tint:var(${TINTS[h % TINTS.length]});--tilt:${(h % 5) - 2}deg">
			<p translate="no">${esc(n.message)}</p>
			<footer>
				<span translate="no">${esc(n.name || t("A friend"))}</span>
				<span>${n.approved === false ? esc(t("Waiting for approval")) : fmtDate(n.created_at)}</span>
			</footer>
			${own ? `<button class="linkbtn" type="button" data-del="${n.id}">${esc(t("Delete"))}</button>` : ""}
		</li>`;
	};

	async function loadWall() {
		// guests can only ever see approved notes (and may not read the `approved` column), so only logged-in visitors filter on it
		let q = LP.sb.from("notes").select("id,name,message,created_at");
		if (LP.user) q = q.eq("approved", true);
		const { data, error } = await q.order("created_at", { ascending: false }).limit(60);
		if (error) { wall.innerHTML = `<p class="muted">${esc(t("The notes couldn't be loaded. Please try again later."))}</p>`; return; }
		wall.innerHTML = data.length
			? `<ul class="note-wall">${data.map(n => noteHTML(n, false)).join("")}</ul>`
			: `<p class="muted">${esc(t("No notes yet. Be the first to leave one!"))}</p>`;
	}

	/* your own notes that are still waiting, so you know they arrived */
	async function loadMine() {
		const { data } = await LP.sb.from("notes").select("id,name,message,approved,created_at").eq("approved", false).order("created_at", { ascending: false });
		const list = $("#mine");
		if (list) list.innerHTML = (data || []).length ? `<h3>${esc(t("Your notes waiting for approval"))}</h3><ul class="note-wall">${data.map(n => noteHTML(n, true)).join("")}</ul>` : "";
	}

	async function showForm() {
		const { data: prof } = await LP.sb.from("profiles").select("name").eq("id", LP.user.id).maybeSingle();
		box.innerHTML = `
		<form class="note-form" id="noteForm" novalidate>
			<h2>Leave a note</h2>
			<div class="field">
				<label for="nName">Your name <small>(shown with your note, optional)</small></label>
				<input id="nName" maxlength="40" autocomplete="nickname" value="${esc(prof?.name || "")}">
			</div>
			<div class="field">
				<label for="nMsg">Your note</label>
				<textarea id="nMsg" rows="4" maxlength="${MAX}" placeholder="Say something nice…" aria-describedby="nCount"></textarea>
				<div class="msg-tools"><span id="nCount">0 / ${MAX}</span></div>
			</div>
			<p class="error" id="nErr" role="alert" hidden></p>
			<button class="btn" type="submit" id="nSend">Post my note</button>
		</form>
		<div id="mine"></div>`;
		const msg = $("#nMsg"), err = $("#nErr"), send = $("#nSend");
		msg.addEventListener("input", () => { $("#nCount").textContent = `${msg.value.length} / ${MAX}`; err.hidden = true; });
		$("#noteForm").addEventListener("submit", async e => {
			e.preventDefault();
			const message = msg.value.trim(), name = $("#nName").value.trim();
			if (!message) { err.textContent = t("Write a note first."); err.hidden = false; msg.focus(); return; }
			send.disabled = true;
			const { error } = await LP.sb.from("notes").insert({ name, message });
			send.disabled = false;
			if (error) {
				err.textContent = /note_limit/.test(error.message) ? t("You've left 3 notes today. Come back tomorrow!") : t("Something went wrong. Please try again.");
				err.hidden = false; return;
			}
			msg.value = ""; $("#nCount").textContent = `0 / ${MAX}`;
			LP.toast(t("Thank you! Your note will appear once it's approved."));
			loadMine();
		});
		box.addEventListener("click", async e => {
			const b = e.target.closest("[data-del]"); if (!b) return;
			await LP.sb.from("notes").delete().eq("id", b.dataset.del);
			loadMine();
		});
		loadMine();
	}

	async function boot() {
		if (!LP.configured) { wall.innerHTML = `<p class="muted">${esc(t("Notes aren't switched on yet."))}</p>`; return; }
		await LP.ready;
		loadWall();
		if (LP.user) showForm();
		else box.innerHTML = `<div class="notice"><div>${esc(t("Log in to leave a note."))} <a href="${esc(LP.loginUrl())}">${esc(t("Log in"))}</a></div></div>`;
	}
	boot();
})();
