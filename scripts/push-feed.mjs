// The stack. Prepends a new item to config/feed.json; when the list grows past
// maxVisible, the oldest items pop off the bottom into archive/feed-archive.json.
//
// Usage:
//   node scripts/push-feed.mjs --tag build --text "Shipped the new hero carousel"
//   node scripts/push-feed.mjs --tag ship --text "..." --date 2026-07-26
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib/svg.mjs";

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };

const tag = get("--tag") || "note";
const text = get("--text");
const date = get("--date") || new Date().toISOString().slice(0, 10);
if (!text) { console.error("push-feed: --text is required"); process.exit(1); }

const feedPath = join(ROOT, "config/feed.json");
const archivePath = join(ROOT, "archive/feed-archive.json");

const feed = JSON.parse(readFileSync(feedPath, "utf8"));
const keep = feed.keep || 12; // how many items to retain in the live file
feed.items.unshift({ date, tag, text }); // push onto the stack

if (feed.items.length > keep) {
  const overflow = feed.items.splice(keep); // pop the oldest
  const archive = existsSync(archivePath)
    ? JSON.parse(readFileSync(archivePath, "utf8"))
    : { items: [] };
  archive.items.unshift(...overflow);
  writeFileSync(archivePath, JSON.stringify(archive, null, 2) + "\n");
  console.log(`archived ${overflow.length} item(s) -> archive/feed-archive.json`);
}

writeFileSync(feedPath, JSON.stringify(feed, null, 2) + "\n");
console.log(`pushed [${tag}] ${text}`);
