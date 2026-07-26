// Renders generated/hero.svg — an auto-rotating "carousel" hero using SMIL.
// GitHub strips JS from README, but SMIL/CSS animation inside an SVG survives,
// so the panels cycle on their own. The whole image links out to the Pages app.
//
// All panels share one loop (dur = total) and are driven by a circular
// trapezoid opacity curve: fully visible during their 1/N slot, with a short
// crossfade ramp on each side that wraps cleanly from the last panel to the
// first. Sampling the curve avoids SMIL keyTimes edge-cases at the wrap.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadJSON, theme, esc, wrap, ROOT } from "./lib/svg.mjs";

const W = 900, H = 300;
const t = theme();
const { frames, secondsPerFrame } = loadJSON("config/hero.json");
const N = frames.length;
const dwell = secondsPerFrame || 4;
const total = N * dwell;
const crossfade = 0.7; // seconds
const ov = crossfade / total; // as a fraction of the loop
const STEPS = 60;

// Opacity for a panel whose lit slot is [a,b] (fractions), evaluated on a
// circular [0,1) timeline so ramps that cross the wrap point work.
function circOpacity(tf, a, b) {
  let best = 0;
  for (const shift of [-1, 0, 1]) {
    const A = a + shift, B = b + shift;
    let v = 0;
    if (tf >= A && tf <= B) v = 1;
    else if (tf >= A - ov && tf < A) v = (tf - (A - ov)) / ov;
    else if (tf > B && tf <= B + ov) v = 1 - (tf - B) / ov;
    if (v > best) best = v;
  }
  return Math.max(0, Math.min(1, best));
}

function panel(f, i) {
  const a = i / N, b = (i + 1) / N;
  const keyTimes = [], values = [];
  for (let k = 0; k <= STEPS; k++) {
    const tf = k / STEPS;
    keyTimes.push(tf.toFixed(4));
    values.push(circOpacity(tf, a, b).toFixed(3));
  }
  const head = wrap(f.headline, 34);
  return `
  <g opacity="0">
    <animate attributeName="opacity" dur="${total}s" repeatCount="indefinite"
             keyTimes="${keyTimes.join(";")}" values="${values.join(";")}" />
    <text x="48" y="90" fill="${t.accent}" font-family="'JetBrains Mono',monospace"
          font-size="16" letter-spacing="4" font-weight="700">${esc(f.kicker)}</text>
    ${head.map((l, li) => `<text x="46" y="${140 + li * 40}" fill="${t.text}"
          font-family="Georgia,serif" font-size="34" font-weight="600">${esc(l)}</text>`).join("")}
    <text x="48" y="${150 + head.length * 40 + 14}" fill="${t.muted}"
          font-family="'JetBrains Mono',monospace" font-size="14">${esc(f.sub)}</text>
  </g>`;
}

// progress dots — one lights per slot, in sync with the panels.
const dots = frames.map((_, i) => {
  const cx = W - 40 - (N - 1 - i) * 22;
  const a = i / N, b = (i + 1) / N;
  const kt = i === 0 ? `0;${b.toFixed(3)}` : `0;${a.toFixed(3)};${b.toFixed(3)}`;
  const vals = i === 0 ? `${t.accent};${t.line}` : `${t.line};${t.accent};${t.line}`;
  return `<circle cx="${cx}" cy="${H - 30}" r="4" fill="${t.line}">
    <animate attributeName="fill" dur="${total}s" repeatCount="indefinite"
      calcMode="discrete" keyTimes="${kt}" values="${vals}" /></circle>`;
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
console.log("rendered generated/hero.svg", `(${N} frames, ${total}s loop, crossfade)`);
