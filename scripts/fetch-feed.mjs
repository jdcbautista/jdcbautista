// The daily feed. For each category (track) in config/feeds.csv, fetches every
// enabled source and RANDOMLY picks one recent article — so the feed rotates
// each run. Pure Node: regex RSS/Atom parsing.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadCSV, truthy, ROOT } from "./lib/svg.mjs";

const feedPath = join(ROOT, "config/feed.json");
const rows = loadCSV("config/feeds.csv").filter((r) => truthy(r.enabled));
const PER_SOURCE = 5; // pull this many recent items per source into the pool

const decode = (s) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&hellip;/g, "…").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/\s+/g, " ").trim();
const grab = (b, re) => { const m = b.match(re); return m ? m[1] : ""; };

function parse(xml, max) {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  const out = [];
  for (const b of blocks.slice(0, max)) {
    const title = decode(grab(b, /<title[^>]*>([\s\S]*?)<\/title>/i));
    const link = grab(b, /<link[^>]*href="([^"]+)"/i) || decode(grab(b, /<link[^>]*>([\s\S]*?)<\/link>/i));
    const dateRaw = grab(b, /<(?:pubDate|published|updated|dc:date)>([^<]+)</i);
    if (!title || !link) continue;
    const d = new Date(dateRaw);
    out.push({ title, link, ts: isNaN(d) ? 0 : d.getTime() });
  }
  return out;
}

async function fetchSource(src) {
  try {
    const res = await fetch(src.url, {
      headers: { "user-agent": "Mozilla/5.0 (feed reader)" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parse(await res.text(), PER_SOURCE).map((it) => ({ ...it, source: src.source, track: src.category }));
  } catch (err) {
    console.warn(`  ✗ ${src.source} (${src.category}): ${err.message}`);
    return [];
  }
}

// Preserve category order as first seen in the CSV.
const order = [];
for (const r of rows) if (!order.includes(r.category)) order.push(r.category);

const results = (await Promise.all(rows.map(fetchSource))).flat();
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const items = [];
for (const track of order) {
  const pool = results.filter((r) => r.track === track);
  if (!pool.length) continue;
  const chosen = pick(pool); // random article from this track's pool
  items.push({
    date: chosen.ts ? new Date(chosen.ts).toISOString().slice(0, 10) : "",
    track,
    source: chosen.source,
    text: chosen.title,
    link: chosen.link,
  });
  console.log(`  ✓ ${track}: ${chosen.source} — ${chosen.title.slice(0, 50)}`);
}

const feed = { title: "Feed", note: "One random recent article per track, from config/feeds.csv. Regenerated each run.", items };
writeFileSync(feedPath, JSON.stringify(feed, null, 2) + "\n");
console.log(`feed: ${items.length} tracks`);
