// The daily feed. For each category (track) in config/feeds.csv, fetches every
// enabled source and keeps the single FRESHEST item — so the feed is one strong
// signal per track, refreshed each run. Pure Node: regex RSS/Atom parsing.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadCSV, truthy, ROOT } from "./lib/svg.mjs";

const feedPath = join(ROOT, "config/feed.json");
const rows = loadCSV("config/feeds.csv").filter((r) => truthy(r.enabled));

const decode = (s) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#8217;|&#x27;/g, "'")
    .replace(/&#8211;|&#8212;/g, "–").replace(/&hellip;|&#8230;/g, "…")
    .replace(/\s+/g, " ").trim();
const grab = (b, re) => { const m = b.match(re); return m ? m[1] : ""; };

function latestItem(xml) {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  for (const b of blocks) {
    const title = decode(grab(b, /<title[^>]*>([\s\S]*?)<\/title>/i));
    const link = grab(b, /<link[^>]*href="([^"]+)"/i) || decode(grab(b, /<link[^>]*>([\s\S]*?)<\/link>/i));
    const dateRaw = grab(b, /<(?:pubDate|published|updated|dc:date)>([^<]+)</i);
    if (!title || !link) continue;
    const d = new Date(dateRaw);
    return { title, link, ts: isNaN(d) ? 0 : d.getTime() };
  }
  return null;
}

async function fetchLatest(src) {
  try {
    const res = await fetch(src.url, {
      headers: { "user-agent": "Mozilla/5.0 (feed reader)" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const item = latestItem(await res.text());
    return item ? { ...item, source: src.source, track: src.category } : null;
  } catch (err) {
    console.warn(`  ✗ ${src.source} (${src.category}): ${err.message}`);
    return null;
  }
}

// Preserve category order as first seen in the CSV.
const order = [];
for (const r of rows) if (!order.includes(r.category)) order.push(r.category);

const results = await Promise.all(rows.map(fetchLatest));
const items = [];
for (const track of order) {
  const pool = results.filter((r) => r && r.track === track);
  if (!pool.length) continue;
  const best = pool.reduce((a, b) => (b.ts > a.ts ? b : a));
  items.push({
    date: best.ts ? new Date(best.ts).toISOString().slice(0, 10) : "",
    track,
    source: best.source,
    text: best.title,
    link: best.link,
  });
  console.log(`  ✓ ${track}: ${best.source} — ${best.title.slice(0, 50)}`);
}

const feed = { title: "SIGNAL MACHINE", note: "One freshest item per track, from config/feeds.csv. Regenerated each run.", items };
writeFileSync(feedPath, JSON.stringify(feed, null, 2) + "\n");
console.log(`feed: ${items.length} tracks`);
