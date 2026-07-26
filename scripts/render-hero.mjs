// Renders generated/hero.gif — the animated hero (this IS the "hero" module).
//
// Faithful port of the `s01` p5 sketch from the old `devfolio` Spotify
// visualizer. Per frame it draws three white circles that orbit a center,
// leaping ~110°/step (tempo=110), the inner one at radius r and the outer two
// at 2r, with r creeping outward each frame so the whole figure spirals and
// zooms OUT. A low-alpha background each frame leaves smoky trails.
//
// SMIL is frozen inside a README <img>, so the motion is baked into a GIF. The
// trail is an additive "glow" buffer that decays toward zero, so the capture
// runs exactly one cycle — birth at center → spiral zooms off-screen → trails
// decay to a clean frame — and loops seamlessly (clean end == clean start), the
// way s01 only cuts once the spiral is completely out of view.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import gifenc from "gifenc";
import { loadJSON, theme, esc, wrap, ROOT } from "./lib/svg.mjs";
const { GIFEncoder, quantize, applyPalette } = gifenc;

const W = 900, H = 340, DELAY = 55;
const t = theme();
const profile = loadJSON("config/profile.json");
const headline = "Fifteen years making things people rely on.";
const head = ["Fifteen years making", "things people rely on."];

const cx = 700, cy = H / 2; // orbit center (right side, clear of the text)
const DEG = Math.PI / 180;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// ---- static layers, rasterized once ---------------------------------------
const panelSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.panel}"/><stop offset="1" stop-color="${t.bg}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="${t.bg}"/>
  <rect width="${W}" height="${H}" rx="16" fill="url(#bg)" stroke="${t.line}"/></svg>`;
const panelPx = new Resvg(panelSVG, { fitTo: { mode: "width", value: W } }).render().pixels;

const overlaySVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.bg}" stop-opacity="0.96"/><stop offset="0.42" stop-color="${t.bg}" stop-opacity="0.82"/><stop offset="0.72" stop-color="${t.bg}" stop-opacity="0"/></linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.accent2}"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" rx="16" fill="url(#scrim)"/>
  <rect width="6" height="${H}" rx="3" fill="url(#edge)"/>
  <text x="40" y="70" fill="${t.accent}" font-family="monospace" font-size="15" letter-spacing="4" font-weight="700">JULIUS BAUTISTA</text>
  <text x="40" y="94" fill="${t.muted}" font-family="monospace" font-size="11" letter-spacing="2">SITE RELIABILITY ENGINEER · DESIGNER BY TRAINING</text>
  ${head.map((l, i) => `<text x="38" y="${150 + i * 46}" fill="${t.text}" font-family="Georgia,serif" font-size="40" font-weight="600">${esc(l)}</text>`).join("")}
  <text x="40" y="${H - 30}" fill="${t.accent}" font-family="monospace" font-size="13" font-weight="700">▶ enter the site</text>
  <text x="180" y="${H - 30}" fill="${t.muted}" font-family="monospace" font-size="13">${esc(profile.pagesUrl.replace(/^https?:\/\//, ""))} →</text></svg>`;
const overPx = new Resvg(overlaySVG, { fitTo: { mode: "width", value: W }, background: "rgba(0,0,0,0)" }).render().pixels;

// ---- additive glow buffer (the trail) -------------------------------------
const glow = new Float32Array(W * H * 3); // R,G,B light added over the panel
const XCLIP = 400; // don't paint left of this — protects the text side

function disc(px, py, sz, intensity) {
  const x0 = Math.max(XCLIP, (px - sz) | 0), x1 = Math.min(W - 1, (px + sz) | 0);
  const y0 = Math.max(0, (py - sz) | 0), y1 = Math.min(H - 1, (py + sz) | 0);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - px, y - py);
      if (d > sz) continue;
      const f = intensity * (1 - d / sz);
      const i = (y * W + x) * 3;
      glow[i] += 236 * f; glow[i + 1] += 240 * f; glow[i + 2] += 245 * f;
    }
  }
}
const decay = (k) => { for (let i = 0; i < glow.length; i++) glow[i] *= 1 - k; };

// s01 orbit state
let angle = 0, r = 4;
const GROW = 1.10;       // per-frame radius growth (zoom-out speed)
const DECAY = 0.15;      // trail decay per frame

// one s01 draw(): three leaping circles — inner at r, outer two at 2r
function drawStep() {
  disc(cx + r * Math.cos(angle * DEG), cy + r * Math.sin(angle * DEG), 20, 0.95);
  angle += 110.05;
  disc(cx + 2 * r * Math.cos(angle * DEG), cy + 2 * r * Math.sin(angle * DEG), 11, 0.9);
  angle += 110.1;
  disc(cx + 2 * r * Math.cos(angle * DEG), cy + 2 * r * Math.sin(angle * DEG), 6, 0.85);
  angle += 110.2;
  r *= GROW;
}

// 4x4 ordered-dither matrix breaks up gradient banding on the base layer (GIF
// is 256 colors with no built-in dithering).
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// env scales the glow; 0 at the first and last frame → both ends are a clean
// empty panel, so the loop is seamless no matter where the spiral is.
function compose(env) {
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0, p = 0, g = 0, q = 0; y < H; y++) {
    for (let x = 0; x < W; x++, p++, g += 3, q += 4) {
      const dit = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 6; // ±3
      let R = panelPx[q] + glow[g] * env + dit, G = panelPx[q + 1] + glow[g + 1] * env + dit, B = panelPx[q + 2] + glow[g + 2] * env + dit;
      const a = overPx[q + 3] / 255;
      if (a > 0) { R = overPx[q] * a + R * (1 - a); G = overPx[q + 1] * a + G * (1 - a); B = overPx[q + 2] * a + B * (1 - a); }
      out[q] = R; out[q + 1] = G; out[q + 2] = B; out[q + 3] = 255;
    }
  }
  return out;
}

// ---- capture one seamless cycle -------------------------------------------
// The spiral is born at center, zooms out for the whole clip, and the envelope
// fades it fully in at the start and fully out at the end so the cut is clean.
const N = 56;
const frames = [];
for (let f = 0; f < N; f++) {
  drawStep();                                   // keep spiraling outward
  decay(DECAY);                                 // trails fade
  const env = Math.max(0, Math.min(f / 5, (N - 1 - f) / 8, 1));
  frames.push(compose(env));
}

// palette from a synthetic swatch of the colors in play (quantize collapses on
// the real mostly-dark frames)
const rampC = (a, b, n) => Array.from({ length: n }, (_, i) => { const u = i / (n - 1); return [0, 1, 2].map((c) => Math.round(a[c] + (b[c] - a[c]) * u)); });
const bg = hex(t.bg);
const swatch = [];
const cols = [
  ...rampC(bg, hex(t.panel), 12),          // panel gradient (kills the banding)
  ...rampC(bg, [45, 49, 60], 16),          // dense near-black → dim grey (faint glow)
  ...rampC([45, 49, 60], [236, 240, 245], 22), // dim grey → white (bright glow)
  hex(t.line), hex(t.muted), hex(t.text),
  ...rampC(bg, hex(t.accent), 5), ...rampC(bg, hex(t.accent2), 5),
];
for (const c of cols) for (let k = 0; k < 40; k++) swatch.push(c[0], c[1], c[2], 255);
const palette = quantize(new Uint8Array(swatch), 64, { format: "rgb565" });

const gif = GIFEncoder();
for (const fr of frames) gif.writeFrame(applyPalette(fr, palette, "rgb565"), W, H, { palette, delay: DELAY });
gif.finish();

const bytes = gif.bytes();
writeFileSync(join(ROOT, "generated/hero.gif"), bytes);
console.log(`rendered generated/hero.gif (s01 orbits, ${frames.length} frames, ${(bytes.length / 1024).toFixed(0)} KB)`);

// MONTAGE=1 → stack sampled frames into a PNG for visual inspection (debug only)
if (process.env.MONTAGE) {
  const { deflateSync } = await import("node:zlib");
  const pick = [0, 6, 12, 18, 24, 30, 36, 42, 48, frames.length - 1];
  const MH = H * pick.length;
  const big = new Uint8ClampedArray(W * MH * 4);
  pick.forEach((fi, band) => big.set(frames[fi], band * W * H * 4));
  const crc32 = (b) => { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const ck = (type, data) => { const L = Buffer.alloc(4); L.writeUInt32BE(data.length); const T = Buffer.from(type); const C = Buffer.alloc(4); C.writeUInt32BE(crc32(Buffer.concat([T, data]))); return Buffer.concat([L, T, data, C]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(MH, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(MH * (W * 4 + 1));
  for (let y = 0; y < MH; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(big.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1); }
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ck("IHDR", ihdr), ck("IDAT", deflateSync(raw)), ck("IEND", Buffer.alloc(0))]);
  writeFileSync(join(ROOT, "generated/_montage.png"), png);
  console.log("wrote generated/_montage.png");
}
