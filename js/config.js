/*
  Little Post – public settings. Safe to publish: the anon key only works within the database's row-level-security rules.
  Fill these in after creating your Supabase project (see README, "Go live").
  Never put the Stripe secret key, the webhook secret or the Supabase service-role key in this file.
*/
window.LP_CONFIG = {
	SUPABASE_URL: "https://kxcyisxwgljunpgcmbon.supabase.co",
	SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4Y3lpc3h3Z2xqdW5wZ2NtYm9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5NDE5MTgsImV4cCI6MjEwODUxNzkxOH0.5YHtr2Fl11fwKxWqdyKZn0lTduVmoj5fTD_4FcBbsps",   // the "anon public" key (safe to publish)
	// Cards made with the old FREE version (card.html?card=…&text=…) open without payment, and anyone can build such a link by hand.
	// Leave this false so every card has to be bought. Set it to true only if you must keep old shared links alive.
	ALLOW_LEGACY_LINKS: false,
	CONTACT_EMAIL: "little0post@gmail.com",      // shown on the Contact page and in the Terms
	BUSINESS_NAME: "Little Post",                // the seller named in the Terms and Privacy pages (your legal name or company)
	BUSINESS_ADDRESS: ""                         // optional: your postal address, shown in the Terms if filled in
};
