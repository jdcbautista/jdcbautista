// The daily feed. Pulls the latest post from each site in config/feeds.json and
// prepends the new ones onto the SIGNAL stack (config/feed.json); overflow past
// `keep` pops into archive/feed-archive.json. Dedupes by link, so re-running is
// safe. Pure Node — regex RSS/Atom parsing, no dependencies.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib/svg.mjs";

const feedsPath = join(ROOT, "config/feeds.json");
const feedPath = join(ROOT, "config/feed.json");
const archivePath = join(ROOT, "archive/feed-archive.json");

const feeds = JSON.parse(readFileSync(feedsPath, "utf8"));
const feed = JSON.parse(readFileSync(feedPath, "utf8"));
const perSource = feeds.perSource || 1;

const decode = (s) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#8217;/g, "'")
    .replace(/\s+/g, " ").trim();

const firstMatch = (block, re) => { const m = block.match(re); return m ? m[1] : ""; };

function parse(xml, max) {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  const out = [];
  for (const b of blocks.slice(0, max * 2)) {
    const title = decode(firstMatch(b, /<title[^>]*>([\s\S]*?)<\/title>/i));
    const link =
      firstMatch(b, /<link[^>]*href="([^"]+)"/i) ||
      decode(firstMatch(b, /<link[^>]*>([\s\S]*?)<\/link>/i));
    const dateRaw = firstMatch(b, /<(?:pubDate|published|updated|dc:date)>([^<]+)</i);
    if (!title || !link) continue;
    let date;
    const d = new Date(dateRaw);
    date = isNaN(d) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
    out.push({ title, link, date });
    if (out.length >= max) break;
  }
  return out;
}

const fetched = [];
for (const src of feeds.sources) {
  try {
    const res = await fetch(src.url, {
      headers: { "user-agent": "Mozilla/5.0 (feed reader)" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    for (const it of parse(xml, perSource)) {
      fetched.push({ date: it.date, tag: src.tag, text: it.title, color: src.color, link: it.link });
    }
    console.log(`  ✓ ${src.tag}: ${parse(xml, perSource).length} item(s)`);
  } catch (err) {
    console.warn(`  ✗ ${src.tag} (${src.url}): ${err.message}`);
  }
}

// Newest first; prepend only links we don't already have.
fetched.sort((a, b) => (a.date < b.date ? 1 : -1));
const have = new Set(feed.items.map((i) => i.link).filter(Boolean));
const fresh = fetched.filter((i) => !have.has(i.link));
feed.items = [...fresh, ...feed.items];

const keep = feed.keep || 16;
if (feed.items.length > keep) {
  const overflow = feed.items.splice(keep);
  const archive = existsSync(archivePath)
    ? JSON.parse(readFileSync(archivePath, "utf8"))
    : { items: [] };
  archive.items.unshift(...overflow);
  writeFileSync(archivePath, JSON.stringify(archive, null, 2) + "\n");
  console.log(`archived ${overflow.length} older item(s)`);
}

writeFileSync(feedPath, JSON.stringify(feed, null, 2) + "\n");
console.log(`feed: +${fresh.length} new, ${feed.items.length} in stack`);
