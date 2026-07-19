# Updating titles & summaries

Chapter/episode titles and short summaries come from the **One Piece fandom
wiki**, scraped by `fetch-fandom.mjs` into `../data/chapters/` and
`../data/episodes/` (100 units per JSON block). This is a dev-time step only —
the deployed app just reads the JSON, never the wiki.

**Requirements:** Node 18+ (built-in `fetch`; no `npm install`, no dependencies).

## The weekly update

When new episodes or chapters have released, from the project root:

```bash
npm run fetch:episodes     # anime
npm run fetch:chapters     # manga
```

Each command **auto-detects the newest unit you already have** and fetches
forward until the wiki runs out. Running it when nothing new has aired is a safe
no-op. It prints `✓ contiguous 1.. no gaps` when the data is complete.

Then commit the changed files and push — GitHub Pages redeploys and the new
titles appear:

```bash
git add data/ && git commit -m "Update titles & summaries" && git push
```

> If a number just aired but isn't showing in the Log Book, the arc data caps it:
> bump that arc's `ep`/`ch` range in the `ARCS` array in `app.js` too (and, since
> that touches `app.js`, bump `app.js?v=` in `index.html`).

## Other options

```bash
# fetch a specific range
node scripts/fetch-fandom.mjs --kind episode --from 1171 --to 1175

# rebuild everything from #1 (keeps existing entries)
node scripts/fetch-fandom.mjs --kind chapter --all

# overwrite units you already have (e.g. after the wiki fixes a typo)
node scripts/fetch-fandom.mjs --kind chapter --refetch --from 1044 --to 1044
```

## Good to know

- **Titles:** manga uses the Viz `title`; anime uses the `Translation` field (the
  one the wiki's Episode Guide displays). Summaries come from each page's
  `Short Summary` section, with wiki markup stripped.
- **Self-healing:** it batches 50 pages per request; if the API's content cap
  drops a page from a big batch, a repair pass re-fetches it, so a finished run
  is always contiguous.
- **Title-only entries:** a unit that has a title but only an empty-placeholder
  summary (older filler, or a just-listed upcoming one) is stored title-only —
  the app shows "No summary written yet."
- **Don't hand-edit** the JSON in `data/` — re-run the scraper instead.
