// Renders generated/feed.svg — the "signal machine": a terminal-style feed of
// the most recent items. New items get prepended by scripts/push-feed.mjs and
// the oldest overflow into archive/feed-archive.json, so this always shows the
// top N of a stack.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadJSON, theme, esc, wrap, ROOT } from "./lib/svg.mjs";

const t = theme();
const cfg = loadJSON("config/feed.json");
const N = cfg.maxVisible || 5;
const items = cfg.items.slice(0, N);

const tagColor = { build: t.accent, ship: "#3fb950", learn: t.accent2, teach: "#d29922", design: "#a371f7", note: t.muted };

const PAD = 24, HEAD = 58, ROW = 46, W = 900;
const H = HEAD + PAD + items.length * ROW + PAD - 10;

// Truncate a (possibly long RSS) title to one line with an ellipsis.
const oneLine = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function row(it, i) {
  const y = HEAD + PAD + i * ROW;
  const col = it.color || tagColor[it.tag] || t.muted;
  const text = oneLine(it.text, 74);
  return `
  <g>
    <text x="${PAD}" y="${y}" fill="${t.muted}" font-family="'JetBrains Mono',monospace" font-size="12">${esc(it.date)}</text>
    <rect x="${PAD + 96}" y="${y - 13}" width="58" height="18" rx="5" fill="${col}" opacity="0.16"/>
    <text x="${PAD + 125}" y="${y}" text-anchor="middle" fill="${col}" font-family="'JetBrains Mono',monospace" font-size="11" font-weight="700">${esc(it.tag)}</text>
    <text x="${PAD + 172}" y="${y}" fill="${t.text}" font-family="'JetBrains Mono',monospace" font-size="13">${esc(text)}</text>
    <line x1="${PAD}" y1="${y + 16}" x2="${W - PAD}" y2="${y + 16}" stroke="${t.line}" opacity="0.6"/>
  </g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Signal feed">
  <rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="${t.bg}" stroke="${t.line}"/>
  <circle cx="26" cy="28" r="6" fill="#ff5f56"/><circle cx="46" cy="28" r="6" fill="#ffbd2e"/><circle cx="66" cy="28" r="6" fill="#27c93f"/>
  <text x="${W / 2}" y="33" text-anchor="middle" fill="${t.muted}" font-family="'JetBrains Mono',monospace" font-size="13" letter-spacing="4">${esc(cfg.title || "SIGNAL")} — live feed</text>
  <line x1="0" y1="${HEAD - 6}" x2="${W}" y2="${HEAD - 6}" stroke="${t.line}"/>
  ${items.map(row).join("")}
</svg>`;

writeFileSync(join(ROOT, "generated/feed.svg"), svg);
console.log("rendered generated/feed.svg", `(top ${items.length} of ${cfg.items.length})`);
