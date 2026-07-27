// Renders generated/hero.gif — the animated hero (this IS the "hero" module).
//
// TWO side-by-side canvas animations, composited each frame and baked to a GIF
// (GitHub can't run canvas):
//   LEFT panel  — a parallax STARFIELD drifting UP (3 depth layers). The text
//                 sits over it.
//   RIGHT panel — the real `s01` spiral (solid orbiting ellipses, trails).
// Both are made exactly periodic so frame N == frame 0 (seamless, no fade):
//   • stars: each layer drifts up an integer number of screen-heights over N.
//   • spiral: a SELF-SIMILAR log spiral — every frame the whole thing advances
//     by K/N of a generation; over the loop it advances by exactly K (integer)
//     generations, so frame N's circles are identical to frame 0's (just
//     re-indexed). Circles grow as they spiral out and drift fully off the
//     edge — no brightness fade, no gap, no half-cropped circle at the wrap.
// Run with DIFF=1 to print consecutive-frame diffs (the wrap diff should match
// its neighbors — that's how we verify the loop, not by eyeballing a montage).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { createCanvas, ImageData } from "@napi-rs/canvas";
import gifenc from "gifenc";
import { loadJSON, theme, esc, wrap, ROOT } from "./lib/svg.mjs";
const { GIFEncoder, quantize, applyPalette } = gifenc;

const W = 900, H = 392, DELAY = 55, N = 48, SPLIT = 452;
const t = theme();
const profile = loadJSON("config/profile.json");
const head = ["Build beautiful and", "meaningful things."];
const subLines = wrap(profile.heroSub || "", 42);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// ---- fixed text overlay (resvg → canvas) ----------------------------------
const overlaySVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.bg}" stop-opacity="0.78"/><stop offset="0.5" stop-color="${t.bg}" stop-opacity="0.55"/><stop offset="0.62" stop-color="${t.bg}" stop-opacity="0"/></linearGradient>
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

// ---- LEFT: parallax starfield drifting UP (confined to x < SPLIT) ----------
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
const rng = mulberry32(20260727);
const LAYERS = [
  { n: 70, wraps: 1, size: [0.5, 1.0], a: [0.12, 0.32] }, // far, slow
  { n: 40, wraps: 2, size: [0.8, 1.4], a: [0.28, 0.55] }, // mid
  { n: 18, wraps: 3, size: [1.2, 2.1], a: [0.5, 0.85] },  // near, fast
];
const stars = [];
for (const L of LAYERS) for (let i = 0; i < L.n; i++)
  stars.push({ x: rng() * SPLIT, y: rng() * H, s: L.size[0] + rng() * (L.size[1] - L.size[0]), a: L.a[0] + rng() * (L.a[1] - L.a[0]), vy: (H * L.wraps) / N });
function drawStars(ctx, f) {
  ctx.fillStyle = "#cbd6ea";
  for (const st of stars) {
    const y = ((st.y - st.vy * f) % H + H) % H; // moving UP, wraps
    ctx.globalAlpha = st.a;
    ctx.beginPath(); ctx.arc(st.x, y, st.s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---- RIGHT: the s01 spiral (confined to x >= SPLIT) -----------------------
// Circle i sits at radius R0·G^t, angle t·TURN, with t = i + K·(f/N). Because t
// advances by exactly K (integer) generations per loop, frame N's set of
// circles == frame 0's, re-indexed. SIZE and OPACITY are pure functions of the
// radius, so the circle occupying any given radius is identical at frame 0 and
// frame N → the loop is pixel-identical (seamless) with NO fade hack. Circles
// fade IN near the center (birth) and drift fully off the panel edge (clipped)
// — small delicate dots, bright dense core, no gap, no half-cropped circle.
const spiral = createCanvas(W, H);
const sx = spiral.getContext("2d");
const cx = Math.round((SPLIT + W) / 2), cy = Math.round(H * 0.5), DEG = Math.PI / 180;
const G = 1.055;              // radius ratio between adjacent circles (smaller = denser)
const TURN = 137.5 * DEG;     // angle between adjacent circles (golden angle → organic fill)
const K = 6;                  // generations advanced per loop (outward speed; MUST be integer)
const R0 = 2;                 // radius of generation t=0 (px)
const RAD = 9;                // circle radius (px, constant → delicate uniform dots)
const FADE_IN = [2, 9];       // fade opacity 0→full as radius crosses this band (birth)
const I_MIN = -10, I_MAX = 100; // integer band: center (opacity 0) → off-panel, padded by K

function drawSpiral(f) {
  sx.clearRect(0, 0, W, H);
  sx.save();
  sx.beginPath(); sx.rect(SPLIT, 0, W - SPLIT, H); sx.clip(); // keep the spiral in the right panel
  const adv = K * (f / N);
  for (let i = I_MIN; i <= I_MAX; i++) {
    const t = i + adv;
    const r = R0 * Math.pow(G, t);
    const op = Math.min(1, Math.max(0, (r - FADE_IN[0]) / (FADE_IN[1] - FADE_IN[0]))) * 0.55;
    if (op <= 0.003) continue;                                   // faded-out center → invisible
    const ang = t * TURN;
    const x = cx + r * Math.cos(ang), y = cy + r * Math.sin(ang);
    if (x + RAD < SPLIT || x - RAD > W || y + RAD < 0 || y - RAD > H) continue; // fully off-panel
    sx.beginPath();
    sx.ellipse(x, y, RAD, RAD, 0, 0, Math.PI * 2);
    sx.fillStyle = `rgba(236,240,246,${op.toFixed(3)})`;
    sx.fill();
    sx.lineWidth = 1; sx.strokeStyle = `rgba(10,12,16,${(op * 0.35).toFixed(3)})`; sx.stroke();
  }
  sx.restore();
}

// ---- compose each frame: bg → stars(left) → spiral(right) → divider → text -
const compose = createCanvas(W, H);
const cc = compose.getContext("2d");
const grad = cc.createLinearGradient(0, 0, W, H);
grad.addColorStop(0, t.panel); grad.addColorStop(1, t.bg);
function frameAt(f) {
  cc.globalCompositeOperation = "source-over";
  cc.fillStyle = grad; cc.fillRect(0, 0, W, H);
  drawStars(cc, f);
  drawSpiral(f);
  cc.drawImage(spiral, 0, 0);
  cc.strokeStyle = t.line; cc.globalAlpha = 0.7;
  cc.beginPath(); cc.moveTo(SPLIT, 18); cc.lineTo(SPLIT, H - 18); cc.stroke(); cc.globalAlpha = 1;
  cc.drawImage(overlayCanvas, 0, 0);
  return cc.getImageData(0, 0, W, H).data;
}

const frames = [];
for (let f = 0; f < N; f++) frames.push(frameAt(f)); // spiral is a pure function of f — no warmup

// ---- verify the loop numerically (DIFF=1) ---------------------------------
if (process.env.DIFF) {
  const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return s / (a.length / 4); };
  const ds = []; for (let f = 0; f < N; f++) ds.push(diff(frames[f], frames[(f + 1) % N]));
  const sorted = ds.slice().sort((a, b) => a - b), med = sorted[N >> 1];
  console.log("wrap diff (47→0):", ds[N - 1].toFixed(2), "| median:", med.toFixed(2), "| max:", Math.max(...ds).toFixed(2), "@frame", ds.indexOf(Math.max(...ds)));
}

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
console.log(`rendered generated/hero.gif (stars↑ | spiral, ${N} frames, ${(bytes.length / 1024).toFixed(0)} KB)`);

if (process.env.MONTAGE) {
  const { deflateSync } = await import("node:zlib");
  const pick = Array.from({ length: 10 }, (_, i) => Math.round((i * (N - 1)) / 9));
  const MH = H * pick.length;
  const big = new Uint8ClampedArray(W * MH * 4);
  pick.forEach((fi, band) => big.set(frames[fi], band * W * H * 4));
  const crc32 = (b) => { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const ck = (ty, d) => { const L = Buffer.alloc(4); L.writeUInt32BE(d.length); const T = Buffer.from(ty); const C = Buffer.alloc(4); C.writeUInt32BE(crc32(Buffer.concat([T, d]))); return Buffer.concat([L, T, d, C]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(MH, 4); ih[8] = 8; ih[9] = 6;
  const raw = Buffer.alloc(MH * (W * 4 + 1));
  for (let y = 0; y < MH; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(big.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1); }
  writeFileSync(join(ROOT, "generated/_montage.png"), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ck("IHDR", ih), ck("IDAT", deflateSync(raw)), ck("IEND", Buffer.alloc(0))]));
  console.log("wrote generated/_montage.png");
}
