// Renders the Feed as separate stacked SVGs so each row can be its OWN link:
//   generated/feed-header.svg   (title bar, rounded top)
//   generated/feed-item-<i>.svg (one article, identical styling)
//   generated/feed-footer.svg   (rounded bottom)
// assemble-readme stacks them with zero gap; each item is wrapped in an <a> to
// its article. Data comes from fetch-feed.mjs (config/feed.json).
import { writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { loadJSON, theme, esc, ROOT } from "./lib/svg.mjs";

const t = theme();
const cfg = loadJSON("config/feed.json");
const items = cfg.items || [];
const gen = join(ROOT, "generated");

const W = 900, HEAD = 52, ROW = 48, FOOT = 38, R = 16;

const TRACK = { AI: "#4c8bf5", Cloud: "#d29922", SRE: "#39c5cf", Systems: "#3fb950", News: "#e0533d" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}` : ""; };
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

const svg = (h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" role="img">${body}</svg>`;

// rounded-top panel (square bottom) + border on top/sides/bottom-divider
function header() {
  const fill = `M0 ${HEAD} L0 ${R} Q0 0 ${R} 0 L${W - R} 0 Q${W} 0 ${W} ${R} L${W} ${HEAD} Z`;
  return svg(HEAD, `
    <path d="${fill}" fill="${t.panel}"/>
    <path d="M0 ${HEAD} L0 ${R} Q0 0 ${R} 0 L${W - R} 0 Q${W} 0 ${W} ${R} L${W} ${HEAD}" fill="none" stroke="${t.line}"/>
    <line x1="0" y1="${HEAD}" x2="${W}" y2="${HEAD}" stroke="${t.line}"/>
    <circle cx="28" cy="27" r="6" fill="#ff5f56"/><circle cx="48" cy="27" r="6" fill="#ffbd2e"/><circle cx="68" cy="27" r="6" fill="#27c93f"/>
    <text x="${W / 2}" y="32" text-anchor="middle" fill="${t.text}" font-family="'JetBrains Mono',monospace" font-size="14" letter-spacing="5" font-weight="700">FEED</text>
    <text x="${W - 24}" y="32" text-anchor="end" fill="${t.muted}" font-family="'JetBrains Mono',monospace" font-size="10">refreshed daily</text>`);
}

function item(it) {
  const col = TRACK[it.track] || t.muted;
  const meta = [it.source, shortDate(it.date)].filter(Boolean).join("  ·  ");
  const y = 30;
  return svg(ROW, `
    <rect x="0" y="0" width="${W}" height="${ROW}" fill="${t.panel}"/>
    <rect x="${24}" y="${y - 15}" width="78" height="20" rx="5" fill="${col}" opacity="0.16"/>
    <text x="${24 + 39}" y="${y}" text-anchor="middle" fill="${col}" font-family="'JetBrains Mono',monospace" font-size="11" font-weight="700" letter-spacing="1">${esc((it.track || "").toUpperCase())}</text>
    <text x="${24 + 90}" y="${y}" fill="${t.text}" font-family="'JetBrains Mono',monospace" font-size="13">${esc(clip(it.text, 52))}</text>
    <text x="${W - 24}" y="${y}" text-anchor="end" fill="${t.muted}" font-family="'JetBrains Mono',monospace" font-size="11">${esc(meta)}</text>
    <line x1="0" y1="0" x2="0" y2="${ROW}" stroke="${t.line}"/><line x1="${W}" y1="0" x2="${W}" y2="${ROW}" stroke="${t.line}"/>
    <line x1="24" y1="${ROW}" x2="${W - 24}" y2="${ROW}" stroke="${t.line}" opacity="0.6"/>`);
}

function footer() {
  const fill = `M0 0 L${W} 0 L${W} ${FOOT - R} Q${W} ${FOOT} ${W - R} ${FOOT} L${R} ${FOOT} Q0 ${FOOT} 0 ${FOOT - R} Z`;
  return svg(FOOT, `
    <path d="${fill}" fill="${t.panel}"/>
    <path d="M0 0 L0 ${FOOT - R} Q0 ${FOOT} ${R} ${FOOT} L${W - R} ${FOOT} Q${W} ${FOOT} ${W} ${FOOT - R} L${W} 0" fill="none" stroke="${t.line}"/>
    <text x="${W / 2}" y="24" text-anchor="middle" fill="${t.muted}" font-family="'JetBrains Mono',monospace" font-size="10" letter-spacing="2">◷ one random article per track · click to read</text>`);
}

// Clean out stale item files, then write the current set.
for (const f of readdirSync(gen)) if (/^feed-item-\d+\.svg$/.test(f)) unlinkSync(join(gen, f));
writeFileSync(join(gen, "feed-header.svg"), header());
items.forEach((it, i) => writeFileSync(join(gen, `feed-item-${i}.svg`), item(it)));
writeFileSync(join(gen, "feed-footer.svg"), footer());
console.log(`rendered feed: header + ${items.length} items + footer`);
