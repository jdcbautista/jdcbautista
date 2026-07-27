// Renders generated/feed.svg — the SIGNAL MACHINE: one freshest item per track,
// as a clean terminal-style panel (not a table). Data comes from fetch-feed.mjs.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadJSON, theme, esc, ROOT } from "./lib/svg.mjs";

const t = theme();
const cfg = loadJSON("config/feed.json");
const items = cfg.items || [];

// Track → color. Unknown tracks fall back to muted.
const TRACK = {
  AI: "#4c8bf5", Cloud: "#d29922", SRE: "#39c5cf", Systems: "#3fb950", News: "#e0533d",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}` : "";
};
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

const PAD = 26, HEAD = 58, ROW = 48, W = 900;
const H = HEAD + PAD + items.length * ROW + PAD - 12;

function row(it, i) {
  const y = HEAD + PAD + i * ROW;
  const col = TRACK[it.track] || t.muted;
  const meta = [it.source, shortDate(it.date)].filter(Boolean).join("  ·  ");
  return `
  <g>
    <rect x="${PAD}" y="${y - 14}" width="78" height="20" rx="5" fill="${col}" opacity="0.16"/>
    <text x="${PAD + 39}" y="${y}" text-anchor="middle" fill="${col}" font-family="'JetBrains Mono',monospace" font-size="11" font-weight="700" letter-spacing="1">${esc((it.track || "").toUpperCase())}</text>
    <text x="${PAD + 92}" y="${y}" fill="${t.text}" font-family="'JetBrains Mono',monospace" font-size="13">${esc(clip(it.text, 54))}</text>
    <text x="${W - PAD}" y="${y}" text-anchor="end" fill="${t.muted}" font-family="'JetBrains Mono',monospace" font-size="11">${esc(meta)}</text>
    <line x1="${PAD}" y1="${y + 17}" x2="${W - PAD}" y2="${y + 17}" stroke="${t.line}" opacity="0.6"/>
  </g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Signal machine">
  <rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="${t.bg}" stroke="${t.line}"/>
  <circle cx="26" cy="28" r="6" fill="#ff5f56"/><circle cx="46" cy="28" r="6" fill="#ffbd2e"/><circle cx="66" cy="28" r="6" fill="#27c93f"/>
  <text x="${W / 2}" y="33" text-anchor="middle" fill="${t.muted}" font-family="'JetBrains Mono',monospace" font-size="13" letter-spacing="4">SIGNAL MACHINE — freshest per track</text>
  <line x1="0" y1="${HEAD - 6}" x2="${W}" y2="${HEAD - 6}" stroke="${t.line}"/>
  ${items.map(row).join("")}
</svg>`;

writeFileSync(join(ROOT, "generated/feed.svg"), svg);
console.log(`rendered generated/feed.svg (${items.length} tracks)`);
