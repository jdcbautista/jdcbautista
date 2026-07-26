// Renders generated/hero.svg — an auto-rotating "carousel" hero using SMIL.
// GitHub strips JS from README, but SMIL/CSS animation inside an SVG survives,
// so the panels cycle on their own. The whole image links out to the Pages app.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadJSON, theme, esc, wrap, ROOT } from "./lib/svg.mjs";

const W = 900, H = 300;
const t = theme();
const { frames, secondsPerFrame } = loadJSON("config/hero.json");
const dwell = secondsPerFrame || 4;
const total = frames.length * dwell;

// Each frame fades in during its slot and out at the end -> crossfade carousel.
function panel(f, i) {
  const start = i * dwell;
  const head = wrap(f.headline, 34);
  const keyTimes = `0;${(0.06).toFixed(3)};${(0.9).toFixed(3)};1`;
  return `
  <g opacity="0">
    <animate attributeName="opacity" values="0;1;1;0" keyTimes="${keyTimes}"
             dur="${dwell}s" begin="${start}s" repeatCount="indefinite"
             calcMode="spline" keySplines="0.4 0 0.2 1;0 0 1 1;0.4 0 0.2 1" />
    <text x="48" y="90" fill="${t.accent}" font-family="'JetBrains Mono',monospace"
          font-size="16" letter-spacing="4" font-weight="700">${esc(f.kicker)}</text>
    ${head.map((l, li) => `<text x="46" y="${140 + li * 40}" fill="${t.text}"
          font-family="Georgia,serif" font-size="34" font-weight="600">${esc(l)}</text>`).join("")}
    <text x="48" y="${150 + head.length * 40 + 14}" fill="${t.muted}"
          font-family="'JetBrains Mono',monospace" font-size="14">${esc(f.sub)}</text>
  </g>`;
}

// progress dots — each lights up during its frame's slot, using a discrete
// step across the full loop so exactly one dot is active at a time.
const dots = frames.map((_, i) => {
  const cx = W - 40 - (frames.length - 1 - i) * 22;
  const active = i / frames.length;
  const next = (i + 1) / frames.length;
  // i===0 lights at t=0; others light at their slot start. Discrete steps.
  const kt = i === 0 ? `0;${next.toFixed(3)}` : `0;${active.toFixed(3)};${next.toFixed(3)}`;
  const vals = i === 0 ? `${t.accent};${t.line}` : `${t.line};${t.accent};${t.line}`;
  return `<circle cx="${cx}" cy="${H - 30}" r="4" fill="${t.line}">
    <animate attributeName="fill" dur="${total}s" repeatCount="indefinite"
      calcMode="discrete" keyTimes="${kt}" values="${vals}" />
  </circle>`;
}).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Julius Bautista — rotating intro">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${t.panel}"/>
      <stop offset="1" stop-color="${t.bg}"/>
    </linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${t.accent}"/>
      <stop offset="1" stop-color="${t.accent2}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="url(#bg)" stroke="${t.line}"/>
  <rect x="0" y="0" width="6" height="${H}" rx="3" fill="url(#edge)"/>
  ${frames.map(panel).join("")}
  ${dots}
  <text x="48" y="${H - 24}" fill="${t.muted}" font-family="'JetBrains Mono',monospace"
        font-size="12" opacity="0.8">▶ enter the site →</text>
</svg>`;

writeFileSync(join(ROOT, "generated/hero.svg"), svg);
console.log("rendered generated/hero.svg", `(${frames.length} frames, ${total}s loop)`);
