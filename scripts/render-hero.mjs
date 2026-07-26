// Renders generated/hero.gif — the animated hero (this IS the "hero" module).
//
// The motion is a faithful port of the `s01` p5 sketch from the old `devfolio`
// Spotify visualizer: three circles orbit a center, leaping ~110°/step (tempo),
// their radius creeping outward then snapping back, over a background redrawn
// with low alpha each frame so everything leaves a smoky trail.
//
// SMIL/CSS animation is frozen inside a README <img> (verified), so we bake the
// motion into a GIF. Trails need real frame-to-frame persistence, so the orbit
// is simulated in an RGBA accumulation buffer (fade toward the panel each step,
// then draw the circles). The panel + fixed text are rasterized once with resvg
// and composited under/over the buffer so the text stays crisp.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import gifenc from "gifenc";
import { loadJSON, theme, esc, wrap, ROOT } from "./lib/svg.mjs";
const { GIFEncoder, quantize, applyPalette } = gifenc;

const W = 900, H = 340, FRAMES = 46, DELAY = 55; // ~2.5s loop
const t = theme();
const profile = loadJSON("config/profile.json");
const headline = "I build infra that stays boring in production.";
const head = wrap(headline, 26);

const cx = 690, cy = H / 2; // orbit center (right side, clear of the text)
const DEG = Math.PI / 180;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const bg = hex(t.bg);

// ---- rasterize the two static layers once ---------------------------------
// Panel (under the motion): gradient + edge bar. Fully opaque.
const panelSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.panel}"/><stop offset="1" stop-color="${t.bg}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="${t.bg}"/>
  <rect width="${W}" height="${H}" rx="16" fill="url(#bg)" stroke="${t.line}"/></svg>`;
const panel = new Resvg(panelSVG, { fitTo: { mode: "width", value: W } }).render();
const panelPx = panel.pixels; // RGBA, opaque

// Overlay (over the motion): left scrim so text stays readable, edge bar, text.
const overlaySVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="scrim" cx="34%" cy="50%" r="66%"><stop offset="0" stop-color="${t.bg}" stop-opacity="0.96"/><stop offset="0.55" stop-color="${t.bg}" stop-opacity="0.6"/><stop offset="1" stop-color="${t.bg}" stop-opacity="0"/></radialGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.accent2}"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" rx="16" fill="url(#scrim)"/>
  <rect width="6" height="${H}" rx="3" fill="url(#edge)"/>
  <text x="40" y="70" fill="${t.accent}" font-family="monospace" font-size="15" letter-spacing="4" font-weight="700">JULIUS BAUTISTA</text>
  <text x="40" y="94" fill="${t.muted}" font-family="monospace" font-size="12" letter-spacing="2">SRE · APPLIED AI · EDUCATOR · ARTIST</text>
  ${head.map((l, i) => `<text x="38" y="${150 + i * 46}" fill="${t.text}" font-family="Georgia,serif" font-size="40" font-weight="600">${esc(l)}</text>`).join("")}
  <text x="40" y="${H - 30}" fill="${t.accent}" font-family="monospace" font-size="13" font-weight="700">▶ enter the site</text>
  <text x="180" y="${H - 30}" fill="${t.muted}" font-family="monospace" font-size="13">${esc(profile.pagesUrl.replace(/^https?:\/\//, ""))} →</text></svg>`;
const overlay = new Resvg(overlaySVG, { fitTo: { mode: "width", value: W }, background: "rgba(0,0,0,0)" }).render();
const overPx = overlay.pixels; // RGBA with alpha

// ---- the s01 orbit simulation ---------------------------------------------
const acc = new Uint8ClampedArray(panelPx); // start from the panel
const idx = (x, y) => (y * W + x) * 4;

// Soft additive-ish circle: blend `col` into acc with radial falloff.
function disc(px, py, sz, col, a) {
  const x0 = Math.max(0, (px - sz) | 0), x1 = Math.min(W - 1, (px + sz) | 0);
  const y0 = Math.max(0, (py - sz) | 0), y1 = Math.min(H - 1, (py + sz) | 0);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - px, y - py);
      if (d > sz) continue;
      const f = a * (1 - d / sz);
      const i = idx(x, y);
      acc[i] = acc[i] * (1 - f) + col[0] * f;
      acc[i + 1] = acc[i + 1] * (1 - f) + col[1] * f;
      acc[i + 2] = acc[i + 2] * (1 - f) + col[2] * f;
    }
  }
}

// Fade the whole buffer back toward the panel — this is what leaves trails.
function fade(k) {
  for (let i = 0; i < acc.length; i += 4) {
    acc[i] = acc[i] * (1 - k) + panelPx[i] * k;
    acc[i + 1] = acc[i + 1] * (1 - k) + panelPx[i + 1] * k;
    acc[i + 2] = acc[i + 2] * (1 - k) + panelPx[i + 2] * k;
  }
}

const WHITE = [230, 237, 243];
const tint = [hex(t.accent), hex(t.accent2), [63, 185, 80], [163, 113, 247]];
let angle = 0, r = 10;
const RMAX = 150;
const grow = () => { r = r < RMAX ? r * 1.02 + 0.5 : 10; };

// One simulation step ~ one p5 draw(): three leaping, growing orbits.
function step(n) {
  fade(0.14);
  disc(cx + r * Math.cos(angle * DEG), cy + r * Math.sin(angle * DEG), 10, WHITE, 0.9);
  angle += 110.05; grow();
  disc(cx + r * Math.cos(angle * DEG), cy + r * Math.sin(angle * DEG), 6, tint[n % 4], 0.85);
  angle += 110.1; grow();
  disc(cx + r * Math.cos(angle * DEG), cy + r * Math.sin(angle * DEG), 4, tint[(n + 2) % 4], 0.8);
  angle += 110.2; grow();
}

// Warm up so the first captured frame already has trails.
for (let i = 0; i < 24; i++) step(i);

// Composite overlay (scrim + text) over a copy of acc → one output frame.
function compose() {
  const out = new Uint8ClampedArray(acc);
  for (let i = 0; i < out.length; i += 4) {
    const a = overPx[i + 3] / 255;
    if (a === 0) continue;
    out[i] = overPx[i] * a + out[i] * (1 - a);
    out[i + 1] = overPx[i + 1] * a + out[i + 1] * (1 - a);
    out[i + 2] = overPx[i + 2] * a + out[i + 2] * (1 - a);
    out[i + 3] = 255;
  }
  return out;
}

// ---- capture frames + encode ----------------------------------------------
const frames = [];
for (let f = 0; f < FRAMES; f++) { step(f + 24); frames.push(compose()); }

// Palette: quantize()'s median-cut collapses on this mostly-dark, low-variance
// image (and a hand-built palette isn't in the form applyPalette expects). So
// we quantize a SYNTHETIC swatch of the exact colors used — enough variance
// that median-cut can't collapse — and get a correctly-formatted palette.
const rampC = (a, b, n) => Array.from({ length: n }, (_, i) => {
  const u = i / (n - 1);
  return [0, 1, 2].map((c) => Math.round(a[c] + (b[c] - a[c]) * u));
});
const swatchColors = [
  ...rampC(bg, WHITE, 30),
  hex(t.panel), hex(t.line), hex(t.muted), hex(t.text),
  ...rampC(bg, hex(t.accent), 8),
  ...rampC(bg, hex(t.accent2), 8),
  ...rampC(bg, [63, 185, 80], 6),
  ...rampC(bg, [163, 113, 247], 6),
];
const PER = 48;
const swatch = new Uint8Array(swatchColors.length * PER * 4);
let so = 0;
for (const c of swatchColors) for (let k = 0; k < PER; k++) { swatch[so++] = c[0]; swatch[so++] = c[1]; swatch[so++] = c[2]; swatch[so++] = 255; }
const palette = quantize(swatch, 48, { format: "rgb565" });
const gif = GIFEncoder();
for (const fr of frames) gif.writeFrame(applyPalette(fr, palette, "rgb565"), W, H, { palette, delay: DELAY });
gif.finish();

const bytes = gif.bytes();
writeFileSync(join(ROOT, "generated/hero.gif"), bytes);
console.log(`rendered generated/hero.gif (s01 orbits, ${FRAMES} frames, ${(bytes.length / 1024).toFixed(0)} KB)`);
