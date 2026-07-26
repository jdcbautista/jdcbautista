// Renders generated/stats.svg — self-hosted stats (no third-party service, so
// no rate limits and full art control). In Actions it reads real numbers from
// the GitHub API via env vars; locally it falls back to placeholders so the
// card always renders.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { theme, esc, ROOT } from "./lib/svg.mjs";

const t = theme();
const n = (v, fallback) => (v && !Number.isNaN(+v) ? +v : fallback);

const stats = [
  { label: "public repos", value: n(process.env.STAT_REPOS, 48) },
  { label: "followers", value: n(process.env.STAT_FOLLOWERS, 0) },
  { label: "stars earned", value: n(process.env.STAT_STARS, 0) },
  { label: "commits (yr)", value: n(process.env.STAT_COMMITS, 0) },
];

const PAD = 24, W = 900, H = 150, CW = (W - PAD * 2 - 30) / stats.length;

function tile(s, i) {
  const x = PAD + i * (CW + 10);
  return `
  <g>
    <rect x="${x}" y="52" width="${CW}" height="72" rx="12" fill="${t.panel}" stroke="${t.line}"/>
    <text x="${x + CW / 2}" y="94" text-anchor="middle" fill="${t.text}" font-family="Georgia,serif" font-size="30" font-weight="700">${esc(s.value)}</text>
    <text x="${x + CW / 2}" y="114" text-anchor="middle" fill="${t.muted}" font-family="'JetBrains Mono',monospace" font-size="11">${esc(s.label)}</text>
  </g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub stats">
  <rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="${t.bg}" stroke="${t.line}"/>
  <text x="${PAD}" y="36" fill="${t.text}" font-family="'JetBrains Mono',monospace" font-size="16" letter-spacing="5" font-weight="700">BY THE NUMBERS</text>
  ${stats.map(tile).join("")}
</svg>`;

writeFileSync(join(ROOT, "generated/stats.svg"), svg);
console.log("rendered generated/stats.svg");
