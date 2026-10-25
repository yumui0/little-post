/* Little Post – small bits of the FAQ, contact and legal pages that come from settings */
(() => {
	const cfg = LP.cfg, $$ = LP.$$;
	$$("[data-price]").forEach(el => { el.textContent = LP.money(PRICE_CENTS); });
	$$("[data-business]").forEach(el => { el.textContent = cfg.BUSINESS_NAME || "Little Post"; });
	$$("[data-address]").forEach(el => { el.textContent = cfg.BUSINESS_ADDRESS ? `, ${cfg.BUSINESS_ADDRESS}` : ""; });
	const mail = cfg.CONTACT_EMAIL;
	$$("[data-contact]").forEach(el => { if (mail) { el.href = `mailto:${mail}`; el.textContent = mail; } });
	$$("[data-mail-btn]").forEach(b => { if (mail) { b.href = `mailto:${mail}?subject=${encodeURIComponent("Little Post")}`; b.textContent = LP.t("Email {mail}", { mail }); } });
})();
