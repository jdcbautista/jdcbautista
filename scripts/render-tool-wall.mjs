// Renders generated/tool-wall.svg — a config-driven grid of tools.
// Each tool's image (assets/tools/<image>) is embedded as a data URI so the
// SVG is self-contained. Missing images fall back to a lettered tile, so the
// wall always renders even before you've dropped the artwork in.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadJSON, theme, esc, dataUri, ROOT } from "./lib/svg.mjs";

const t = theme();
const cfg = loadJSON("config/tools.json");
const tools = cfg.tools;
const cols = cfg.columns || 6;
const rows = Math.ceil(tools.length / cols);

// Category palette for the lettered fallback tiles (used until you drop a
// real icon into assets/tools/). Keeps the wall looking designed, not broken.
const CAT = {
  infra: "#4c8bf5", cloud: "#d29922", obs: "#39c5cf",
  ci: "#f778ba", lang: "#e0533d", ai: "#a371f7",
  frontend: "#4c8bf5", runtime: "#3fb950", data: "#39c5cf",
};

const PAD = 24, GAP = 16, CELL = 118, ICON = 56, HEAD = 64;
const W = PAD * 2 + cols * CELL + (cols - 1) * GAP;
const H = HEAD + PAD + rows * CELL + (rows - 1) * GAP + PAD;

function cell(tool, idx) {
  const r = Math.floor(idx / cols), c = idx % cols;
  const x = PAD + c * (CELL + GAP);
  const y = HEAD + PAD + r * (CELL + GAP);
  const uri = tool.image ? dataUri(`assets/tools/${tool.image}`) : null;
  const iconX = x + (CELL - ICON) / 2;
  const col = CAT[tool.category] || t.muted;
  const art = uri
    ? `<image x="${iconX}" y="${y + 16}" width="${ICON}" height="${ICON}" href="${uri}" preserveAspectRatio="xMidYMid meet"/>`
    : `<rect x="${iconX}" y="${y + 16}" width="${ICON}" height="${ICON}" rx="12" fill="${col}" opacity="0.18"/>
       <rect x="${iconX}" y="${y + 16}" width="${ICON}" height="${ICON}" rx="12" fill="none" stroke="${col}" stroke-opacity="0.5"/>
       <text x="${x + CELL / 2}" y="${y + 16 + ICON / 2 + 9}" text-anchor="middle" fill="${col}" font-family="Georgia,serif" font-size="26" font-weight="700">${esc(tool.name[0])}</text>`;
  return `
  <g>
    <rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="14" fill="${t.panel}" stroke="${t.line}"/>
    ${art}
    <text x="${x + CELL / 2}" y="${y + CELL - 16}" text-anchor="middle" fill="${t.muted}"
          font-family="'JetBrains Mono',monospace" font-size="11">${esc(tool.name)}</text>
  </g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tool wall">
  <rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="${t.bg}" stroke="${t.line}"/>
  <text x="${PAD}" y="42" fill="${t.text}" font-family="'JetBrains Mono',monospace" font-size="20" letter-spacing="6" font-weight="700">${esc(cfg.title || "TOOL WALL")}</text>
  <text x="${W - PAD}" y="42" text-anchor="end" fill="${t.accent}" font-family="'JetBrains Mono',monospace" font-size="12">${tools.length} tools</text>
  <line x1="${PAD}" y1="${HEAD - 8}" x2="${W - PAD}" y2="${HEAD - 8}" stroke="${t.line}"/>
  ${tools.map(cell).join("")}
</svg>`;

writeFileSync(join(ROOT, "generated/tool-wall.svg"), svg);
console.log("rendered generated/tool-wall.svg", `(${tools.length} tools, ${cols}x${rows})`);
