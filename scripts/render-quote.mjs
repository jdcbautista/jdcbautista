// Renders generated/quote.svg — the daily quote. Picks one quote (by date, so
// it rotates daily) from the pool in config/quotes.json, limited to authors
// ENABLED in config/speakers.csv.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadJSON, loadCSV, truthy, theme, esc, wrap, ROOT } from "./lib/svg.mjs";

const t = theme();
const pool = loadJSON("config/quotes.json").quotes;
const enabled = new Set(
  loadCSV("config/speakers.csv").filter((r) => truthy(r.enabled)).map((r) => r.speaker),
);

let quotes = pool.filter((q) => enabled.has(q.author));
if (!quotes.length) quotes = pool; // never render empty

// Deterministic per-day index (UTC day). Override with QUOTE_INDEX.
const dayNum = Math.floor(Date.now() / 86400000);
const idx = process.env.QUOTE_INDEX ? Number(process.env.QUOTE_INDEX) % quotes.length : dayNum % quotes.length;
const q = quotes[idx];

const W = 900;
const lines = wrap(q.text, 62);
const H = 66 + lines.length * 30 + 32;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Quote of the day">
  <rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="${t.bg}" stroke="${t.line}"/>
  <rect x="0" y="0" width="4" height="${H}" rx="2" fill="${t.accent}"/>
  <text x="34" y="40" fill="${t.muted}" font-family="'JetBrains Mono',monospace" font-size="11" letter-spacing="3">${esc((q.category || "QUOTE").toUpperCase())}</text>
  ${lines.map((l, i) => `<text x="32" y="${72 + i * 30}" fill="${t.text}" font-family="Georgia,serif" font-size="22" font-style="italic">${esc(l)}</text>`).join("")}
  <text x="32" y="${72 + lines.length * 30 + 8}" fill="${t.accent}" font-family="'JetBrains Mono',monospace" font-size="12">— ${esc(q.author)}</text>
</svg>`;

writeFileSync(join(ROOT, "generated/quote.svg"), svg);
console.log(`rendered generated/quote.svg (${q.author})`);
