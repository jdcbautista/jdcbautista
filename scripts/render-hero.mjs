// Renders generated/hero.svg — a STATIC hero composition.
//
// Why static: GitHub's image proxy (camo) does not run SMIL/CSS animation in
// README images, so an animated SVG carousel renders blank or stacked. The
// reliable move is a strong static hero here; the real animated 3D carousel
// lives on the Pages site this image links to.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadJSON, theme, esc, wrap, ROOT } from "./lib/svg.mjs";

const W = 900, H = 415;
const t = theme();
const profile = loadJSON("config/profile.json");
const { frames } = loadJSON("config/hero.json");

const headline = "I build infra that stays boring in production.";
const head = wrap(headline, 30);

// 2x2 grid of facet cards built from the hero frames.
const GX = 40, GY = 210, CW = 400, CH = 66, GAP = 20;
function facet(f, i) {
  const col = i % 2, row = Math.floor(i / 2);
  const x = GX + col * (CW + GAP);
  const y = GY + row * (CH + GAP);
  return `
  <g>
    <rect x="${x}" y="${y}" width="${CW}" height="${CH}" rx="12" fill="${t.panel}" stroke="${t.line}"/>
    <rect x="${x}" y="${y}" width="4" height="${CH}" rx="2" fill="${f.color}"/>
    <text x="${x + 20}" y="${y + 27}" fill="${f.color}" font-family="'JetBrains Mono',monospace" font-size="12" letter-spacing="2" font-weight="700">${esc(f.kicker)}</text>
    <text x="${x + 20}" y="${y + 48}" fill="${t.muted}" font-family="'JetBrains Mono',monospace" font-size="12">${esc(f.sub)}</text>
  </g>`;
}

// give each facet a color if the config doesn't (hero.json frames may omit it)
const palette = [t.accent, t.accent2, "#3fb950", "#a371f7"];
const facets = frames.slice(0, 4).map((f, i) => ({ ...f, color: f.color || palette[i] }));

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
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="url(#bg)" stroke="${t.line}"/>
  <rect x="0" y="0" width="6" height="${H}" rx="3" fill="url(#edge)"/>

  <text x="40" y="64" fill="${t.accent}" font-family="'JetBrains Mono',monospace" font-size="14" letter-spacing="4" font-weight="700">JULIUS BAUTISTA</text>
  <text x="40" y="86" fill="${t.muted}" font-family="'JetBrains Mono',monospace" font-size="12" letter-spacing="2">SRE · APPLIED AI · EDUCATOR · ARTIST</text>

  ${head.map((l, i) => `<text x="38" y="${140 + i * 42}" fill="${t.text}" font-family="Georgia,serif" font-size="38" font-weight="600">${esc(l)}</text>`).join("")}

  ${facets.map(facet).join("")}

  <text x="40" y="${H - 22}" fill="${t.accent}" font-family="'JetBrains Mono',monospace" font-size="13" font-weight="700">▶ enter the site</text>
  <text x="180" y="${H - 22}" fill="${t.muted}" font-family="'JetBrains Mono',monospace" font-size="13">${esc(profile.pagesUrl.replace(/^https?:\/\//, ""))} →</text>
</svg>`;

writeFileSync(join(ROOT, "generated/hero.svg"), svg);
console.log("rendered generated/hero.svg (static)");
