// Zero-dependency SVG helpers shared by every render module.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "..", "..");

export const loadJSON = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
export const theme = () => loadJSON("config/profile.json").theme;

export const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Embed a local image as a data URI so the SVG is self-contained in the README.
const MIME = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
export function dataUri(relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) return null;
  const mime = MIME[extname(abs).toLowerCase()] || "application/octet-stream";
  return `data:${mime};base64,${readFileSync(abs).toString("base64")}`;
}

// Wrap a long string into <=width lines (rough char-count wrap for SVG text).
export function wrap(text, width) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > width) { lines.push(line.trim()); line = w; }
    else line += " " + w;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}
