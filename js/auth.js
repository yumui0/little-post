/* Little Post – sign up, log in, forgot / reset password. All real Supabase Auth; no passwords are stored by this site's own code. */
(() => {
	const { $, esc } = LP;
	const q = new URLSearchParams(location.search);
	const next = LP.safeNext(q.get("next"));
	const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

	/* decorative cards beside the form */
	const art = $("#authArt");
	if (art) art.insertAdjacentHTML("afterbegin", ["thankyou:0", "love:0"].map(k => { const [c, i] = k.split(":"); return `<div class="piece"><div class="cover-art">${coverHTML(findCategory(c).cards[+i], "", true)}</div></div>`; }).join(""));

	/* keep ?next= when moving between login and signup */
	const keep = (id, page) => { const a = $(id); if (a && q.get("next")) a.href = `${page}?next=${encodeURIComponent(q.get("next"))}`; };
	keep("#toSignup", "signup.html"); keep("#toLogin", "login.html");

	if (!LP.configured) { const n = $("#setupNotice"); if (n) n.hidden = false; $$all("form button[type=submit]").forEach(b => b.disabled = true); }
	function $$all(s) { return [...document.querySelectorAll(s)]; }

	/* ---------- little helpers ---------- */
	const err = (input, id, msg) => { const e = $(id); if (!msg) { e.hidden = true; input.removeAttribute("aria-invalid"); return true; } e.textContent = msg; e.hidden = false; input.setAttribute("aria-invalid", "true"); input.setAttribute("aria-describedby", id.slice(1)); return false; };
	const formErr = msg => { const e = $("#formError"); e.textContent = msg || ""; e.hidden = !msg; };
	const busy = (on, label) => { const b = $("#submit"); if (!b.dataset.label) b.dataset.label = b.textContent; b.disabled = on; b.textContent = on ? label : b.dataset.label; };
	const firstBad = inputs => { const bad = inputs.find(i => i.getAttribute("aria-invalid") === "true"); if (bad) bad.focus(); return !!bad; };
	const friendly = e => {
		const m = (e?.message || "").toLowerCase();
		if (m.includes("invalid login")) return "That email and password don't match. Try again, or reset your password.";
		if (m.includes("rate limit") || e?.status === 429) return "Too many tries. Please wait a minute and try again.";
		if (m.includes("password") && m.includes("least")) return "Please choose a longer password (at least 8 characters).";
		if (m.includes("network") || m.includes("fetch")) return "We couldn't reach the server. Check your connection and try again.";
		return "Something went wrong. Please try again.";
	};
	const showPw = $("#showPw");
	if (showPw) showPw.addEventListener("change", () => ["#password", "#password2"].forEach(s => { const i = $(s); if (i) i.type = showPw.checked ? "text" : "password"; }));

	/* ---------- log in ---------- */
	const login = $("#loginForm");
	if (login) {
		if (q.get("confirmed") || location.hash.includes("type=signup")) { const n = $("#loginNote"); n.hidden = false; n.textContent = "Email confirmed. You can log in now."; }
		LP.ready.then(() => { if (LP.user) location.replace(next); });
		login.addEventListener("submit", async e => {
			e.preventDefault(); formErr("");
			const email = $("#email"), pass = $("#password");
			err(email, "#eEmail", EMAIL.test(email.value.trim()) ? "" : "Enter the email address you signed up with.");
			err(pass, "#ePass", pass.value ? "" : "Enter your password.");
			if (firstBad([email, pass]) || !LP.sb) return;
			try { localStorage.setItem("lp:remember", $("#remember").checked ? "1" : "0"); } catch (x) {}
			busy(true, "Logging in…");
			const { error } = await LP.sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value });
			if (error) {
				busy(false);
				if ((error.message || "").toLowerCase().includes("not confirmed")) {
					formErr("Please confirm your email first. We sent you a link when you signed up.");
					const e2 = $("#formError"); e2.insertAdjacentHTML("beforeend", ` <button class="linkbtn" type="button" id="resend">Send it again</button>`);
					$("#resend").addEventListener("click", async () => { const r = await LP.sb.auth.resend({ type: "signup", email: email.value.trim() }); LP.toast(r.error ? "Couldn't send it. Try again soon." : "Confirmation email sent ♥"); });
				} else formErr(friendly(error));
				return;
			}
			location.href = next;
		});
	}

	/* ---------- sign up ---------- */
	const signup = $("#signupForm");
	if (signup) {
		LP.ready.then(() => { if (LP.user) location.replace(next); });
		signup.addEventListener("submit", async e => {
			e.preventDefault(); formErr("");
			const name = $("#name"), email = $("#email"), pass = $("#password"), pass2 = $("#password2");
			err(name, "#eName", name.value.trim() ? "" : "Tell us your name.");
			err(email, "#eEmail", EMAIL.test(email.value.trim()) ? "" : "Enter a valid email address.");
			err(pass, "#ePass", pass.value.length >= 8 ? "" : "Use at least 8 characters.");
			err(pass2, "#ePass2", pass2.value === pass.value ? "" : "The two passwords don't match.");
			if (firstBad([name, email, pass, pass2]) || !LP.sb) return;
			busy(true, "Creating your account…");
			const { data, error } = await LP.sb.auth.signUp({
				email: email.value.trim(), password: pass.value,
				options: { data: { name: name.value.trim().slice(0, 60) }, emailRedirectTo: new URL("login.html?confirmed=1", location.href).href }
			});
			if (error) { busy(false); formErr(friendly(error)); return; }
			if (data.session) { location.href = next; return; }               // email confirmation is switched off in Supabase
			busy(false);
			if (data.user && data.user.identities && data.user.identities.length === 0) { formErr("There's already an account with that email. Try logging in, or reset your password."); return; }
			signup.hidden = true;
			const done = $("#done"); done.hidden = false;
			done.innerHTML = `<div class="notice ok"><div><strong>Check your inbox.</strong> We sent a confirmation link to <strong translate="no">${esc(email.value.trim())}</strong>. Click it, then log in.</div></div><a class="btn" href="login.html${q.get("next") ? "?next=" + encodeURIComponent(q.get("next")) : ""}">Go to log in</a>`;
			done.querySelector("a").focus();
		});
	}

	/* ---------- forgot password ---------- */
	const forgot = $("#forgotForm");
	if (forgot) forgot.addEventListener("submit", async e => {
		e.preventDefault(); formErr("");
		const email = $("#email");
		err(email, "#eEmail", EMAIL.test(email.value.trim()) ? "" : "Enter a valid email address.");
		if (firstBad([email]) || !LP.sb) return;
		busy(true, "Sending…");
		const { error } = await LP.sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: new URL("reset.html", location.href).href });
		busy(false);
		if (error && (error.status === 429 || /rate/i.test(error.message))) { formErr(friendly(error)); return; }
		// same answer whether or not the address has an account, so nobody can use this form to find out who is registered
		forgot.hidden = true; const done = $("#done"); done.hidden = false;
		done.innerHTML = `<div class="notice ok"><div>If there's an account for <strong translate="no">${esc(email.value.trim())}</strong>, a reset link is on its way. It can take a minute.</div></div>`;
	});

	/* ---------- reset password (arrives from the email link) ---------- */
	const reset = $("#resetForm");
	if (reset) {
		let ready = false;
		const open = () => { if (ready) return; ready = true; $("#resetWait").hidden = true; $("#resetBad").hidden = true; reset.hidden = false; $("#password").focus(); };
		if (LP.sb) {
			LP.sb.auth.onAuthStateChange(ev => { if (ev === "PASSWORD_RECOVERY") open(); });
			setTimeout(async () => { if (ready) return; const { data } = await LP.sb.auth.getSession(); if (data.session && /type=recovery/.test(location.hash + location.search)) open(); }, 1500);
			setTimeout(() => { if (!ready) { $("#resetWait").hidden = true; $("#resetBad").hidden = false; } }, 5000);
		} else $("#resetWait").hidden = true;
		reset.addEventListener("submit", async e => {
			e.preventDefault(); formErr("");
			const pass = $("#password"), pass2 = $("#password2");
			err(pass, "#ePass", pass.value.length >= 8 ? "" : "Use at least 8 characters.");
			err(pass2, "#ePass2", pass2.value === pass.value ? "" : "The two passwords don't match.");
			if (firstBad([pass, pass2])) return;
			busy(true, "Saving…");
			const { error } = await LP.sb.auth.updateUser({ password: pass.value });
			if (error) { busy(false); formErr(friendly(error)); return; }
			LP.toast("Password updated ♥"); setTimeout(() => { location.href = "account.html"; }, 700);
		});
	}
})();
