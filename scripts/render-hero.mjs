// Renders generated/hero.gif — the animated hero (this IS the "hero" module).
//
// Layers, composited each frame on a Canvas2D and baked to a GIF (GitHub can't
// run p5/canvas):
//   1. panel gradient
//   2. PARALLAX STARFIELD — 3 depth layers drifting at different speeds; each
//      wraps an integer number of times over the loop, so it's seamless.
//   3. the real `s01` spiral — solid orbiting ellipses (inner r, outer two 2r),
//      leaping ~110°/step; trails fade toward TRANSPARENT (so stars show
//      through). Each orbit's brightness fades in at birth and out at death
//      (envelope on the cycle phase) so the radius reset never pops.
//   4. fixed text overlay (rendered once with resvg).
// The whole thing is exactly periodic (angle repeats every 12 frames, r does
// one grow→reset cycle over N frames) → frame N == frame 0, no fade needed.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { createCanvas, ImageData } from "@napi-rs/canvas";
import gifenc from "gifenc";
import { loadJSON, theme, esc, wrap, ROOT } from "./lib/svg.mjs";
const { GIFEncoder, quantize, applyPalette } = gifenc;

const W = 900, H = 392, DELAY = 55, N = 48;
const t = theme();
const profile = loadJSON("config/profile.json");
const head = ["Build beautiful and", "meaningful things."];
const subLines = wrap(profile.heroSub || "", 42);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// ---- fixed text overlay (resvg → canvas) ----------------------------------
const overlaySVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.bg}" stop-opacity="0.94"/><stop offset="0.42" stop-color="${t.bg}" stop-opacity="0.78"/><stop offset="0.72" stop-color="${t.bg}" stop-opacity="0"/></linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.accent2}"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" rx="16" fill="url(#scrim)"/>
  <rect width="6" height="${H}" rx="3" fill="url(#edge)"/>
  <text x="40" y="70" fill="${t.accent}" font-family="monospace" font-size="15" letter-spacing="4" font-weight="700">JULIUS BAUTISTA</text>
  <text x="40" y="94" fill="${t.muted}" font-family="monospace" font-size="11" letter-spacing="2">SITE RELIABILITY ENGINEER · INSTRUCTOR · DESIGNER</text>
  ${head.map((l, i) => `<text x="38" y="${150 + i * 46}" fill="${t.text}" font-family="Georgia,serif" font-size="40" font-weight="600">${esc(l)}</text>`).join("")}
  ${subLines.map((l, i) => `<text x="40" y="${242 + i * 23}" fill="${t.muted}" font-family="Georgia,serif" font-size="15">${esc(l)}</text>`).join("")}
  </svg>`;
const overPx = new Resvg(overlaySVG, { fitTo: { mode: "width", value: W }, background: "rgba(0,0,0,0)" }).render().pixels;
const overlayCanvas = createCanvas(W, H);
overlayCanvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(overPx), W, H), 0, 0);

// ---- parallax starfield (seeded so it's stable across runs) ----------------
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
const rng = mulberry32(20260727);
const LAYERS = [
  { n: 110, wraps: 1, size: [0.5, 1.0], a: [0.10, 0.30] }, // far
  { n: 55, wraps: 2, size: [0.8, 1.4], a: [0.25, 0.5] },  // mid
  { n: 24, wraps: 3, size: [1.2, 2.1], a: [0.45, 0.8] },  // near
];
const stars = [];
for (const L of LAYERS) for (let i = 0; i < L.n; i++)
  stars.push({ x: rng() * W, y: rng() * H, s: L.size[0] + rng() * (L.size[1] - L.size[0]), a: L.a[0] + rng() * (L.a[1] - L.a[0]), vx: (W * L.wraps) / N });
function drawStars(ctx, f) {
  ctx.fillStyle = "#cbd6ea";
  for (const st of stars) {
    const x = ((st.x - st.vx * f) % W + W) % W;
    ctx.globalAlpha = st.a;
    ctx.beginPath(); ctx.arc(x, st.y, st.s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---- the s01 spiral on its own transparent layer --------------------------
const spiral = createCanvas(W, H);
const sx = spiral.getContext("2d");
const cx = 700, cy = Math.round(H * 0.46), DEG = Math.PI / 180, tempo = 110;
const RMIN = 6, RMAX = 176, GROW = Math.pow(RMAX / RMIN, 1 / N);
let angle = 0, r = RMIN, cyc = 0;

function orbit(x, y, d, env) {
  sx.beginPath();
  sx.ellipse(x, y, d / 2, d / 2, 0, 0, Math.PI * 2);
  sx.fillStyle = `rgba(236,240,246,${(0.95 * env).toFixed(3)})`;
  sx.fill();
  sx.lineWidth = 1; sx.strokeStyle = `rgba(10,12,16,${(0.4 * env).toFixed(3)})`; sx.stroke();
}
function step() {
  // fade existing trails toward TRANSPARENT (so the starfield shows through)
  sx.globalCompositeOperation = "destination-out";
  sx.fillStyle = "rgba(0,0,0,0.10)"; sx.fillRect(0, 0, W, H);
  sx.globalCompositeOperation = "source-over";
  const env = Math.sin(Math.PI * ((cyc % N) / N)); // 0 at birth/death → no reset pop
  orbit(cx + r * Math.cos(angle * DEG), cy + r * Math.sin(angle * DEG), 44, env); angle += tempo;
  orbit(cx + 2 * r * Math.cos(angle * DEG), cy + 2 * r * Math.sin(angle * DEG), 24, env); angle += tempo;
  orbit(cx + 2 * r * Math.cos(angle * DEG), cy + 2 * r * Math.sin(angle * DEG), 12, env); angle += tempo;
  r *= GROW; if (r >= RMAX) r = RMIN;
  cyc++;
}

// ---- compose each frame ----------------------------------------------------
const compose = createCanvas(W, H);
const cc = compose.getContext("2d");
const grad = cc.createLinearGradient(0, 0, W, H);
grad.addColorStop(0, t.panel); grad.addColorStop(1, t.bg);
function frameAt(f) {
  cc.globalCompositeOperation = "source-over";
  cc.fillStyle = grad; cc.fillRect(0, 0, W, H);
  drawStars(cc, f);
  cc.drawImage(spiral, 0, 0);
  cc.drawImage(overlayCanvas, 0, 0);
  return cc.getImageData(0, 0, W, H).data;
}

for (let i = 0; i < 2 * N; i++) step(); // settle onto the periodic attractor
const frames = [];
for (let f = 0; f < N; f++) { step(); frames.push(frameAt(f)); }

// ---- palette + encode ------------------------------------------------------
let palette;
try { palette = quantize(frames[Math.floor(N / 2)], 128, { format: "rgb565" }); }
catch {
  const bg = hex(t.bg);
  const ramp = (a, b, n) => Array.from({ length: n }, (_, i) => { const u = i / (n - 1); return [0, 1, 2].map((c) => Math.round(a[c] + (b[c] - a[c]) * u)); });
  const sw = [];
  for (const c of [...ramp(bg, [236, 240, 246], 48), ...ramp(bg, [90, 95, 108], 16), hex(t.accent), hex(t.accent2)]) for (let k = 0; k < 40; k++) sw.push(c[0], c[1], c[2], 255);
  palette = quantize(new Uint8Array(sw), 64, { format: "rgb565" });
}
const gif = GIFEncoder();
for (const fr of frames) gif.writeFrame(applyPalette(fr, palette, "rgb565"), W, H, { palette, delay: DELAY });
gif.finish();
const bytes = gif.bytes();
writeFileSync(join(ROOT, "generated/hero.gif"), bytes);
console.log(`rendered generated/hero.gif (s01 + parallax stars, ${N} frames, ${(bytes.length / 1024).toFixed(0)} KB)`);

// MONTAGE=1 → stack sampled frames into a PNG for inspection.
if (process.env.MONTAGE) {
  const { deflateSync } = await import("node:zlib");
  const pick = Array.from({ length: 10 }, (_, i) => Math.round((i * (N - 1)) / 9));
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
