// Convenience: render every module + assemble the README. Used for local
// preview (`npm run build`) and as a fallback in CI.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const run = (f) => execFileSync(process.execPath, [join(HERE, f)], { stdio: "inherit" });

["render-hero.mjs", "render-tool-wall.mjs", "render-feed.mjs", "render-stats.mjs", "assemble-readme.mjs"].forEach(run);
