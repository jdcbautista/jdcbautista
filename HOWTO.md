# How this profile works

`README.md` is **generated**. You never edit it by hand — you edit `config/*.json`
(and drop images), and GitHub Actions re-renders the SVGs and stitches the README.

## The pipeline

```
config/*.json ──> scripts/render-*.mjs ──> generated/*.svg ──> assemble-readme.mjs ──> README.md
                              ▲
                     .github/workflows/profile-update.yml (the switch) picks which modules run
```

Run it all locally with **`npm run build`** (zero dependencies, pure Node).

## Add a tool to the wall

1. Add an entry to `config/tools.json`:
   ```json
   { "name": "Rust", "image": "rust.svg", "category": "lang", "url": "https://rust-lang.org/" }
   ```
2. Drop the artwork at `assets/tools/rust.svg` (png/webp/svg all fine).
   No image yet? It renders a category-colored letter tile until you add one.
3. Commit. The `tool-wall` module regenerates on push.

## Post to the signal feed (the stack)

- Quick: `npm run push -- --tag ship --text "Shipped the new hero"`
  New items push to the top; when the file exceeds `keep` (12), the oldest pop
  into `archive/feed-archive.json`.
- With AI polish: run the **ai-feed** workflow (Actions tab → Run workflow),
  type a rough note, and a small Ollama model tightens it before it posts.

## Change the hero carousel

Edit the `frames` array in `config/hero.json` — each frame is one auto-rotating
panel. `secondsPerFrame` sets the dwell. The hero links out to the Pages site.

## The switch

`profile-update.yml` runs daily, on manual dispatch (pick one module or `all`),
and on push (only the modules whose config changed re-run). Add a module by
adding `render-<name>.mjs`, a `<name>` job in the dispatcher, and a marker in
`assemble-readme.mjs`.
