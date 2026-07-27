// Renders generated/quote.svg — the "daily item": one quote from the collection,
// selected by date so it rotates every day (the daily Actions run re-picks it).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadJSON, theme, esc, wrap, ROOT } from "./lib/svg.mjs";

const t = theme();
const { quotes } = loadJSON("config/quotes.json");

// Deterministic per-day index (UTC day number). Override with QUOTE_INDEX.
const dayNum = Math.floor(Date.now() / 86400000);
const idx = process.env.QUOTE_INDEX
  ? Number(process.env.QUOTE_INDEX) % quotes.length
  : dayNum % quotes.length;
const q = quotes[idx];

const W = 900;
const lines = wrap(q.text, 64);
const H = 66 + lines.length * 30 + 30;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Quote of the day">
  <rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="${t.bg}" stroke="${t.line}"/>
  <rect x="0" y="0" width="4" height="${H}" rx="2" fill="${t.accent}"/>
  <text x="34" y="40" fill="${t.muted}" font-family="'JetBrains Mono',monospace" font-size="11" letter-spacing="3">QUOTE OF THE DAY</text>
  ${lines.map((l, i) => `<text x="32" y="${72 + i * 30}" fill="${t.text}" font-family="Georgia,serif" font-size="21" font-style="italic">${esc(l)}</text>`).join("")}
  <text x="32" y="${72 + lines.length * 30 + 6}" fill="${t.accent}" font-family="'JetBrains Mono',monospace" font-size="12">— ${esc(q.author)}</text>
</svg>`;

writeFileSync(join(ROOT, "generated/quote.svg"), svg);
console.log(`rendered generated/quote.svg (#${idx}: ${q.author})`);
