// Renders generated/hero.gif — the animated hero (this IS the "hero" module).
//
// Why a GIF and not an animated SVG: SMIL/CSS animation is FROZEN inside a
// README <img> (Chromium renders only the first frame — verified live). A GIF
// animates in an <img> in every browser, guaranteed. So we render the
// visualizer as a seamless frame loop (rotation + pulses are periodic over the
// loop), bake the fixed text into every frame, rasterize with resvg, and encode
// with gifenc. The motion echoes the old p5 Spotify visualizer.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import gifenc from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifenc;
import { loadJSON, theme, esc, wrap, ROOT } from "./lib/svg.mjs";

const W = 900, H = 340, FRAMES = 30, DELAY = 60; // ~1.8s loop
const t = theme();
const profile = loadJSON("config/profile.json");
const headline = "I build infra that stays boring in production.";
const head = wrap(headline, 26);

const cx = 690, cy = H / 2;
const colors = [t.accent, t.accent2, "#3fb950", "#a371f7"];
const TAU = Math.PI * 2;

// Build one frame's SVG at loop phase p in [0,1). All motion is periodic in p
// so frame FRAMES wraps seamlessly onto frame 0.
function frameSVG(p) {
  // rotating spokes — one full turn per loop
  const rot = p * 360;
  const SPOKES = 16;
  let spokes = "";
  for (let i = 0; i < SPOKES; i++) {
    const a = (i / SPOKES) * TAU;
    const r1 = 34, r2 = 150;
    const x1 = cx + Math.cos(a) * r1, y1 = cy + Math.sin(a) * r1;
    const x2 = cx + Math.cos(a) * r2, y2 = cy + Math.sin(a) * r2;
    const op = 0.15 + 0.55 * (0.5 + 0.5 * Math.sin(TAU * (p * 2 + i / SPOKES)));
    spokes += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${colors[i % colors.length]}" stroke-width="2" stroke-linecap="round" opacity="${op.toFixed(2)}"/>`;
  }

  // pulsing beat rings
  let rings = "";
  for (let i = 0; i < 3; i++) {
    const base = 40 + i * 34;
    const r = base + 14 * (0.5 + 0.5 * Math.sin(TAU * (p * (i + 2)) )) ;
    const op = 0.08 + 0.32 * (0.5 + 0.5 * Math.cos(TAU * (p * (i + 2))));
    rings += `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none" stroke="${colors[i]}" stroke-width="1.5" opacity="${op.toFixed(2)}"/>`;
  }

  // drifting/pulsing particles
  let parts = "";
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU + i;
    const rad = 60 + ((i * 37) % 110);
    const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad * 0.8;
    const op = 0.1 + 0.8 * (0.5 + 0.5 * Math.sin(TAU * (p * (1 + (i % 3)) + i / 20)));
    parts += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${1.5 + (i % 3)}" fill="${colors[i % colors.length]}" opacity="${op.toFixed(2)}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.panel}"/><stop offset="1" stop-color="${t.bg}"/></linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.accent2}"/></linearGradient>
    <radialGradient id="scrim" cx="35%" cy="50%" r="70%"><stop offset="0" stop-color="${t.bg}" stop-opacity="0.95"/><stop offset="0.6" stop-color="${t.bg}" stop-opacity="0.55"/><stop offset="1" stop-color="${t.bg}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="${t.bg}"/>
  <rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="url(#bg)" stroke="${t.line}"/>
  <g transform="rotate(${rot.toFixed(2)} ${cx} ${cy})">${spokes}</g>
  ${rings}${parts}
  <rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="url(#scrim)"/>
  <rect x="0" y="0" width="6" height="${H}" rx="3" fill="url(#edge)"/>
  <text x="40" y="70" fill="${t.accent}" font-family="monospace" font-size="15" letter-spacing="4" font-weight="700">JULIUS BAUTISTA</text>
  <text x="40" y="94" fill="${t.muted}" font-family="monospace" font-size="12" letter-spacing="2">SRE · APPLIED AI · EDUCATOR · ARTIST</text>
  ${head.map((l, i) => `<text x="38" y="${150 + i * 46}" fill="${t.text}" font-family="Georgia,serif" font-size="40" font-weight="600">${esc(l)}</text>`).join("")}
  <text x="40" y="${H - 30}" fill="${t.accent}" font-family="monospace" font-size="13" font-weight="700">▶ enter the site</text>
  <text x="180" y="${H - 30}" fill="${t.muted}" font-family="monospace" font-size="13">${esc(profile.pagesUrl.replace(/^https?:\/\//, ""))} →</text>
</svg>`;
}

// Rasterize each frame to RGBA.
const frames = [];
for (let f = 0; f < FRAMES; f++) {
  const svg = frameSVG(f / FRAMES);
  const png = new Resvg(svg, { fitTo: { mode: "width", value: W } }).render();
  frames.push({ data: png.pixels, width: png.width, height: png.height });
}

// One shared palette (sampled across frames) keeps colors stable — no flicker.
const sample = new Uint8Array(frames.length * frames[0].data.length > 6_000_000
  ? frames[0].data // fallback: single frame if huge
  : Buffer.concat([frames[0].data, frames[Math.floor(FRAMES / 2)].data]));
const palette = quantize(sample, 128, { format: "rgb565" });

const gif = GIFEncoder();
for (const fr of frames) {
  const index = applyPalette(fr.data, palette, "rgb565");
  gif.writeFrame(index, fr.width, fr.height, { palette, delay: DELAY });
}
gif.finish();

const bytes = gif.bytes();
writeFileSync(join(ROOT, "generated/hero.gif"), bytes);
console.log(`rendered generated/hero.gif (${FRAMES} frames, ${(bytes.length / 1024).toFixed(0)} KB)`);
