// Fetches official tool icons from the web into assets/tools/, so the tool wall
// uses real brand marks instead of lettered fallbacks. Sources: Simple Icons
// (cdn.simpleicons.org, colored), Devicon, VectorLogoZone. Re-run any time to
// refresh; it skips files that already exist unless FORCE=1.
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadJSON, ROOT } from "./lib/svg.mjs";

const dir = join(ROOT, "assets/tools");
mkdirSync(dir, { recursive: true });
const force = process.env.FORCE === "1";
const { tools } = loadJSON("config/tools.json");

let ok = 0, skip = 0, fail = 0;
for (const t of tools) {
  if (!t.iconUrl || !t.image) continue;
  const dest = join(dir, t.image);
  if (existsSync(dest) && !force) { skip++; continue; }
  try {
    const res = await fetch(t.iconUrl, {
      headers: { "user-agent": "Mozilla/5.0 (icon fetcher)" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let svg = await res.text();
    if (!svg.includes("<svg")) throw new Error("not an SVG");
    // Trim any XML prolog so it embeds cleanly.
    svg = svg.slice(svg.indexOf("<svg"));
    writeFileSync(dest, svg);
    ok++;
    console.log(`  ✓ ${t.name} -> ${t.image}`);
  } catch (err) {
    fail++;
    console.warn(`  ✗ ${t.name} (${t.iconUrl}): ${err.message} — will use lettered fallback`);
  }
}
console.log(`icons: ${ok} fetched, ${skip} cached, ${fail} failed`);
