// Copies only what the website needs into dist/ for hosting (pages, styles, scripts and the images path.js uses).
// Database files, tests, scripts and unused pictures stay out. Run: node scripts/build-site.mjs
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const out = join(root, "dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
const copy = rel => { const to = join(out, rel); mkdirSync(dirname(to), { recursive: true }); cpSync(join(root, rel), to, { recursive: true }); };

for (const f of readdirSync(root)) if (f.endsWith(".html")) copy(f);
["css", "js", "templates", "path.js", "res/favicon.svg"].forEach(copy);

// card pictures and their thumbnails, straight from the catalogue
const ctx = {}; vm.createContext(ctx);
vm.runInContext(readFileSync(join(root, "path.js"), "utf8").replace(/\bconst SHOP\b/, "var SHOP"), ctx);
let n = 0;
for (const cat of ctx.SHOP.categories) for (const c of cat.cards) for (const p of new Set([c.src, c.thumb])) {
	if (existsSync(join(root, p))) { copy(p); n++; } else if (p === c.src) console.warn("missing picture:", p);
}

// basic security headers for Netlify
writeFileSync(join(out, "_headers"), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
`);
console.log(`dist/ ready: ${n} pictures`);
