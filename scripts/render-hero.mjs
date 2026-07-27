// Renders generated/hero.gif — the animated hero (this IS the "hero" module).
//
// The spiral is the ACTUAL `s01` drawing from the old `devfolio` Spotify
// visualizer, rendered on a real Canvas2D (@napi-rs/canvas) — the same 2D
// backend p5 uses — not an approximation. Each frame lays down s01's three
// translucent background washes (which leave the smoky trails) and its three
// solid orbiting ellipses (inner at r, outer two at 2r), leaping ~110°/step
// (tempo), with r growing so the figure spirals outward. We warm the canvas up
// so the fog reaches steady state, capture one loop, composite the fixed text
// over it, and bake it to a GIF (GitHub READMEs can't run p5/canvas).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { createCanvas } from "@napi-rs/canvas";
import gifenc from "gifenc";
import { loadJSON, theme, esc, wrap, ROOT } from "./lib/svg.mjs";
const { GIFEncoder, quantize, applyPalette } = gifenc;

const W = 900, H = 392, DELAY = 55;
const t = theme();
const profile = loadJSON("config/profile.json");
const head = ["Build beautiful and", "meaningful things."];
const subLines = wrap(profile.heroSub || "", 42);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// ---- static layers, rasterized once with resvg ----------------------------
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
  <text x="40" y="94" fill="${t.muted}" font-family="monospace" font-size="11" letter-spacing="2">SITE RELIABILITY ENGINEER · INSTRUCTOR · DESIGNER</text>
  ${head.map((l, i) => `<text x="38" y="${150 + i * 46}" fill="${t.text}" font-family="Georgia,serif" font-size="40" font-weight="600">${esc(l)}</text>`).join("")}
  ${subLines.map((l, i) => `<text x="40" y="${242 + i * 23}" fill="${t.muted}" font-family="Georgia,serif" font-size="15">${esc(l)}</text>`).join("")}
  </svg>`;
const overPx = new Resvg(overlaySVG, { fitTo: { mode: "width", value: W }, background: "rgba(0,0,0,0)" }).render().pixels;

// ---- the real s01 sketch, on a Canvas2D ------------------------------------
const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");
const grad = ctx.createLinearGradient(0, 0, W, H);
grad.addColorStop(0, t.panel); grad.addColorStop(1, t.bg);
ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

const cx = 700, cy = Math.round(H * 0.46); // orbit center, right side
const DEG = Math.PI / 180, tempo = 110;
// Exact periodicity → seamless loop with NO fade. The angle advances exactly
// 330°/frame (3×110), which repeats every 12 frames, and r completes exactly
// one grow→reset cycle over N frames — so frame N is identical to frame 0.
const N = 48, RMIN = 6, RMAX = 176;
const GROW = Math.pow(RMAX / RMIN, 1 / N);
let angle = 0, r = RMIN;

function ellipse(x, y, d) {
  ctx.beginPath();
  ctx.ellipse(x, y, d / 2, d / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(236,240,246,0.92)";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(10,12,16,0.45)";
  ctx.stroke();
}

// One s01 draw(): three translucent washes (trails) + three orbiting ellipses.
function step() {
  ctx.fillStyle = "rgba(18,20,26,0.085)"; ctx.fillRect(0, 0, W, H); // dark trail
  ctx.fillStyle = "rgba(210,216,226,0.020)"; ctx.fillRect(0, 0, W, H); // light wash (fog)
  ctx.fillStyle = "rgba(120,60,60,0.013)"; ctx.fillRect(0, 0, W, H); // faint warmth
  ellipse(cx + r * Math.cos(angle * DEG), cy + r * Math.sin(angle * DEG), 44);
  angle += tempo;
  ellipse(cx + 2 * r * Math.cos(angle * DEG), cy + 2 * r * Math.sin(angle * DEG), 24);
  angle += tempo;
  ellipse(cx + 2 * r * Math.cos(angle * DEG), cy + 2 * r * Math.sin(angle * DEG), 12);
  angle += tempo;
  r *= GROW; if (r >= RMAX) r = RMIN;
}

for (let i = 0; i < 2 * N; i++) step(); // settle onto the periodic attractor
const spiralFrames = [];
for (let f = 0; f < N; f++) { step(); spiralFrames.push(ctx.getImageData(0, 0, W, H).data); }

// ---- composite: s01 canvas + fixed text overlay (no fade) -----------------
function compose(spiral) {
  const out = new Uint8ClampedArray(W * H * 4);
  for (let q = 0; q < out.length; q += 4) {
    let R = spiral[q], G = spiral[q + 1], B = spiral[q + 2];
    const a = overPx[q + 3] / 255;
    if (a > 0) { R = overPx[q] * a + R * (1 - a); G = overPx[q + 1] * a + G * (1 - a); B = overPx[q + 2] * a + B * (1 - a); }
    out[q] = R; out[q + 1] = G; out[q + 2] = B; out[q + 3] = 255;
  }
  return out;
}
const frames = spiralFrames.map(compose);

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
console.log(`rendered generated/hero.gif (real s01 canvas, ${N} frames, ${(bytes.length / 1024).toFixed(0)} KB)`);

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
