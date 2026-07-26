// Renders generated/hero.svg — fixed text + an ANIMATED background.
//
// The text layer is static (one layer, always visible → no frame artifact).
// Only the background animates, via SMIL (which GitHub's README renderer DOES
// run — same mechanism as the popular typing-SVG cards). The motion echoes the
// p5 Spotify visualizer from the old `devfolio` repo: rotating spokes, pulsing
// beat rings, and drifting particles.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadJSON, theme, esc, wrap, ROOT } from "./lib/svg.mjs";

const W = 900, H = 340;
const t = theme();
const profile = loadJSON("config/profile.json");

const headline = "I build infra that stays boring in production.";
const head = wrap(headline, 26);

// ---- animated visualizer (right side) -------------------------------------
const cx = 690, cy = H / 2;
const colors = [t.accent, t.accent2, "#3fb950", "#a371f7"];

// rotating spokes (a "wedge flock")
const SPOKES = 16;
const spokes = Array.from({ length: SPOKES }, (_, i) => {
  const a = (i / SPOKES) * Math.PI * 2;
  const r1 = 34, r2 = 150;
  const x1 = cx + Math.cos(a) * r1, y1 = cy + Math.sin(a) * r1;
  const x2 = cx + Math.cos(a) * r2, y2 = cy + Math.sin(a) * r2;
  const col = colors[i % colors.length];
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
    stroke="${col}" stroke-width="2" stroke-linecap="round" opacity="0.5">
    <animate attributeName="opacity" values="0.15;0.7;0.15" dur="${(2.4 + (i % 4) * 0.3).toFixed(1)}s"
      begin="${(i * 0.12).toFixed(2)}s" repeatCount="indefinite"/></line>`;
}).join("");

// pulsing "beat" rings
const rings = [0, 1, 2].map((i) => `
  <circle cx="${cx}" cy="${cy}" r="${40 + i * 34}" fill="none" stroke="${colors[i]}" stroke-width="1.5" opacity="0.35">
    <animate attributeName="r" values="${40 + i * 34};${54 + i * 34};${40 + i * 34}" dur="${(3 + i).toFixed(0)}s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1" keyTimes="0;0.5;1"/>
    <animate attributeName="opacity" values="0.4;0.08;0.4" dur="${(3 + i).toFixed(0)}s" repeatCount="indefinite"/>
  </circle>`).join("");

// drifting particles
const particles = Array.from({ length: 20 }, (_, i) => {
  const a = (i / 20) * Math.PI * 2 + i;
  const rad = 60 + ((i * 37) % 110);
  const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad * 0.8;
  const col = colors[i % colors.length];
  return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${1.5 + (i % 3)}" fill="${col}">
    <animate attributeName="opacity" values="0.1;0.9;0.1" dur="${(2 + (i % 5) * 0.4).toFixed(1)}s" begin="${(i * 0.17).toFixed(2)}s" repeatCount="indefinite"/></circle>`;
}).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Julius Bautista — ${esc(headline)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${t.panel}"/>
      <stop offset="1" stop-color="${t.bg}"/>
    </linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${t.accent}"/>
      <stop offset="1" stop-color="${t.accent2}"/>
    </linearGradient>
    <radialGradient id="scrim" cx="35%" cy="50%" r="70%">
      <stop offset="0" stop-color="${t.bg}" stop-opacity="0.95"/>
      <stop offset="0.6" stop-color="${t.bg}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${t.bg}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="url(#bg)" stroke="${t.line}"/>

  <!-- animated background layer -->
  <g transform="translate(${cx} ${cy})">
    <g>
      <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="26s" repeatCount="indefinite"/>
      <g transform="translate(${-cx} ${-cy})">${spokes}</g>
    </g>
  </g>
  ${rings}
  ${particles}

  <!-- scrim so the left-side text stays crisp over the motion -->
  <rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="url(#scrim)"/>
  <rect x="0" y="0" width="6" height="${H}" rx="3" fill="url(#edge)"/>

  <!-- static text layer (never animates) -->
  <text x="40" y="70" fill="${t.accent}" font-family="'JetBrains Mono',monospace" font-size="15" letter-spacing="4" font-weight="700">JULIUS BAUTISTA</text>
  <text x="40" y="94" fill="${t.muted}" font-family="'JetBrains Mono',monospace" font-size="12" letter-spacing="2">SRE · APPLIED AI · EDUCATOR · ARTIST</text>
  ${head.map((l, i) => `<text x="38" y="${150 + i * 46}" fill="${t.text}" font-family="Georgia,serif" font-size="40" font-weight="600">${esc(l)}</text>`).join("")}
  <text x="40" y="${H - 30}" fill="${t.accent}" font-family="'JetBrains Mono',monospace" font-size="13" font-weight="700">▶ enter the site</text>
  <text x="180" y="${H - 30}" fill="${t.muted}" font-family="'JetBrains Mono',monospace" font-size="13">${esc(profile.pagesUrl.replace(/^https?:\/\//, ""))} →</text>
</svg>`;

writeFileSync(join(ROOT, "generated/hero.svg"), svg);
console.log("rendered generated/hero.svg (animated bg + static text)");
