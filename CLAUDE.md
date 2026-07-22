# Grand Line Chart

A One Piece progress tracker whose primary interface is a **rotatable 3D globe**,
not a list. You mark episodes or chapters; your position, your wake, and your crew
move across the world of One Piece.

Personal hobby project. Free hosting only. No budget.

---

## Run it

No build step. `index.html` + `app.js`, served as static files. The whole
map, Log Book, and local progress work with zero backend — Supabase is only
for sign-in and cross-device sync (see Storage), and the app degrades
cleanly to localStorage-only without it.

```bash
python3 -m http.server 8000    # then open localhost:8000
```

There is no npm dependency and no toolchain. `package.json` exists only to
give `npm run serve` as a shortcut. Supabase is loaded via a CDN `import` in
`app.js`, not bundled.

## Layout

```
index.html                       markup + styles
app.js                           all client-side logic (module script),
                                 including the ARCS array — the single source
                                 of truth for episodes/chapters
three-world.js                   production Three.js globe renderer
sync-progress.js                 pure cross-device reconciliation helpers
map-art-lab.html +
  map-art-lab.js +
  map-island-designs.js          isolated richer-cartography prototype and its
                                 lore-driven island silhouette catalog; not
                                 loaded by the production tracker
config.js                        Supabase URL + anon key (public-safe); optional
flat.html + app-flat.js          frozen backup of the old 2D SVG map; deployed
                                 at /flat.html for a one-step revert if needed
legacy/pre-three-globe/          byte-for-byte backup of the previous renderer
data/
  chapters/<block>.json          scraped chapter titles + short summaries,
  episodes/<block>.json          100 units per block (block = n/100). Lazy-
                                 loaded per arc; reference data, in git.
scripts/
  fetch-fandom.mjs               scrapes titles+summaries from the fandom
                                 MediaWiki API into data/ (re-run to update)
supabase/
  schema.sql                     run once in the Supabase SQL editor — one
                                 table: progress
.github/workflows/keepalive.yml  pings Supabase so the free tier doesn't pause
package.json                     `serve`, `fetch:chapters`, `fetch:episodes`
```

Keep it dependency-free and buildless — it deploys anywhere, loads instantly,
has no toolchain to rot. Splitting `app.js` out of `index.html` and adding a
Supabase backend (auth + sync only) were the two deliberate "real reasons not
to" stay a single file.

---

## The world model

The One Piece world is a sphere with two great circles crossing it, and the app
renders it as a **real orthographic Three.js globe** (`three-world.js`). You drag
to rotate; there is no flat map anymore.

Island coordinates live in a 4000×2400 space (`x`,`y` on `CANON_ISLANDS`) mapped
to the sphere by `lonlat(x,y)`: **x → longitude, y → latitude, the Grand Line =
the equator.**

- The **Grand Line** is the equator — a luminous band across the sphere's middle.
- The **Red Line** is one great circle perpendicular to it, so its two crossings —
  Reverse Mountain (lon 90°, `RL_A`=1000) and the holy land (lon 270°, `RL_B`=3000)
  — are genuinely **antipodal**. It renders as a continuous constant-width **wall**
  (`redWall()`) that passes over both poles. No wrap trick: the loop is real
  geometry. The bands (`latBand()`) are filled between two latitude circles so they
  foreshorten with the sphere instead of staying fixed-width.
- **Calm Belts** flank the Grand Line (dark bands). Dead water. Only Amazon Lily
  and Impel Down live there.
- The four **Blues** are the quadrants the two lines cut the world into. In the
  default view (centred on Reverse Mountain, the Red Line dividing left from right)
  they sit like every One Piece map: **North top-left, East top-right, West
  bottom-left, South bottom-right.**

**Paradise** is the equatorial half between the two Red Line crossings; the **New
World** is the other half — which puts Elbaf, the frontier of the route, back
around near Reverse Mountain where the voyage began.

The globe only shows one hemisphere at a time, so island positions are
**compressed** from the flat op-maps layout to stay readable in a single view —
order and relative arrangement match op-maps, absolute spacing is squeezed. The
old flat SVG map (infinite cylinder pan, `TILES`, `clampView`) is gone; it
survives as a one-step backup at **`flat.html`** / **`app-flat.js`** (see Deploy).

The additive **cartography lab** currently gives twenty-five major route
landmarks distinct procedural silhouettes derived from the lore already stored
in `CANON_ISLANDS`. Its metadata lives in `map-island-designs.js`; reusable
terrain, climate, architecture, vegetation, cloud, and landmark primitives live
in `map-art-lab.js`. Reverse Mountain's rivers are cut into the terrain, then
widen, fade, and submerge as they meet the four Blues and the Grand Line.

Island coordinates are an editorial reading. Oda never published them, fan maps
disagree, and that is fine — but the *skeleton* above is not negotiable, and
`zoneFor()` enforces it. **Nothing is ever placed in a Calm Belt or inside the
Red Line.** Filler islands are positioned procedurally and must pass that test.

---

## Data: the ARCS array

Everything the app charts — episodes, chapters, classification, arc grouping,
which islands an arc lands at — is one `ARCS` array in `app.js` (plus
`CANON_ISLANDS` for the cartography). This is **reference data**: once an
episode or chapter airs, its number, kind, and arc never change. So it lives
in code — in git, reviewable, deployed atomically — not in a database. The
database holds only users and their progress.

Titles + short summaries now come from the **One Piece fandom wiki's MediaWiki
API** (`onepiece.fandom.com/api.php`) — the clean, reliable source the earlier
"no clean API" verdict was missing (Jikan's filler flag disagreed with our
4-way taxonomy; MangaDex lost its English chapters; neither tracks summaries).
`scripts/fetch-fandom.mjs` scrapes the `{{Chapter Box}}`/`{{Episode Box}}` title
and the `==Short Summary==` section, batched 50 pages/request, into
`data/<kind>/<block>.json` (100 units per block). This stays **reference data in
git**, lazy-loaded per arc — *not* the database, which still holds only user
progress. The classification taxonomy is unaffected: it's still the `ARCS` data,
never the wiki's flags. There's no filler/mixed concept on the manga side — it's
the source material, 100% canon by definition.

Titles/summaries are **spoilers**: the Log Book and panel show a unit's title
only for units you've reached or with the spoiler shield off, same rule as
`isShielded`. Clicking a unit's title opens its full summary (behind a reveal
veil when it's ahead of you).

### Updating it — see the block comment above `ARCS`

Each arc carries its own episode range (`ep`), chapter range (`ch`), island
`stops`, and — co-located — its classification exceptions. Manga-canon is the
silent default; only filler/mixed/anime-canon episodes get listed, per arc,
as `filler`/`mixed`/`anime` (a single number `54` or an inclusive range
`[54,60]`). `EP_TYPE` is derived from this at load. The weekly maintenance is
tiny and local:

- **new episode, current arc** → bump that arc's `ep` end by one (and add its
  number to `filler`/`mixed`/`anime` if it isn't manga-canon);
- **new chapter** → bump that arc's `ch` end by one;
- **a new arc begins** → append an arc object; a 100%-filler arc between two
  canon arcs is a `detour:true` island instead.

### The guardrails do the enforcing (kept from every prior version)

Asserted at load, in the IIFE right after `ARCS`: episode and chapter ranges
must each **tile 1..LAST with no gaps or overlaps**, and every classification
exception must fall **inside its own arc's `ep` range**. A typo throws
immediately with a specific message rather than silently mislabelling the
episode a user is on. When the data and your assumptions disagree, the assert
is how the data wins.

---

## The three rules that matter

**1. Filler is a property of an EPISODE, not of an arc.**

This was wrong for several versions and the real data caught it. Only 64 filler
episodes sit *between* arcs; **30 sit inside canon arcs** — Alabasta contains 3,
Enies Lobby 8, Wano 6.

- An arc that is **100% filler AND sits between two canon arcs** gets
  `detour: true`. It becomes a yellow island hanging off the route — a place the
  anime went and the manga never did. There are exactly **10**.
- Filler episodes *inside* a canon arc are just yellow episodes in the Log Book.
  **They do not create an island.**

Asserted at load. Keep it that way.

**2. Do not police the user.**

Skipping a canon arc is allowed. Never block it. But the map tells the truth: a
leg only turns red once you have reached the island it leads to, so a skipped arc
leaves a **visible grey hole in your wake**, tagged "Skipped" in the Log Book with
a count badge. The Log Pose only ever points *forward*; unfinished business behind
you nags separately rather than hijacking the compass.

"Where you are" is the **furthest** island you have reached — not the furthest
unbroken one. Skip Little Garden and you are still at Drum.

**3. The map charts only what the story has reached. It ends at Elbaf.**

Nobody knows what comes after Elbaf, so nothing after it is drawn — not Laugh
Tale, not Lodestar Island, not a line into the unknown. Only confirmed, reached
places are on the chart. (Laugh Tale and Lodestar were briefly added and then
removed for exactly this reason: the crew hasn't been there, so neither has the
map.) When a user catches up, the Log Pose reads "Nowhere left to sail" —
`here.n` resolves to Elbaf, the furthest stop — rather than inventing a heading.

---

## Deploy

**GitHub Pages**, served from `main` at root — the app is static, no build
step. Repo: `github.com/rodrigopecci/one-piece-tracker` (personal account,
public). Live at `https://rodrigopecci.github.io/one-piece-tracker/`. Every
push to `main` redeploys automatically. (Cloudflare Pages would also work and
was the original plan, but GitHub Pages keeps everything on one platform and
this app needs nothing Cloudflare-specific.)

**Flat-map backup:** the pre-globe 2D map is frozen at `flat.html` + `app-flat.js`
and deployed at `/flat.html`. If the globe ever needs pulling, that page still
works standalone, and `cp flat.html index.html && cp app-flat.js app.js` reverts
the live app in one step (both read the same `config.js`).

The app uses relative asset paths, so it runs fine under the `/one-piece-tracker/`
subpath.

**Cache-busting (important):** GitHub Pages serves assets with a ~10-minute
cache. `index.html` loads `app.js?v=N` — **bump that `N` in `index.html`
whenever you change `app.js`.** Without it, a browser can pick up a fresh
`index.html` but a stale cached `app.js` (or vice-versa), and the two disagree
about the DOM — e.g. an old `app.js` calling `getElementById` for an element a
new `index.html` renamed. Versioning the query means you always get a matched
pair: all-new or all-old, never mixed. (If `config.js` ever changes, bump its
import query in `app.js` the same way.)

### Storage — Supabase, localStorage as the offline cache

`window.storage` (Claude-artifact-only) is gone. `persist()`/`restore()` in
`app.js` write to `localStorage` first, always — that's what actually renders,
so a dead network never blocks using the app. Supabase is layered on top as
the backup + cross-device sync, only active once a project is configured.

**One-time setup (needs your Supabase dashboard — that's the only account
required now):**
1. Create a free project at supabase.com. Run `supabase/schema.sql` in its
   SQL editor — it creates one table, `progress`.
2. Authentication → Providers: **Email** is enabled by default — that's all
   we use. (Optionally toggle off "Confirm email" for instant signup.)
3. Put the Project URL + anon key in `config.js` (both are public-safe) and
   push — Pages redeploys.

All of this is **optional**. Without it, the whole app works on
localStorage alone — the map, Log Book, and progress all render; only sign-in
and cross-device sync are off, and the sign-in form shows a graceful
"not configured" note. There is no service_role key and no server-side script
anywhere: the database never holds reference data, only user progress.

### Sync design (implemented)

Progress is a **set of integers**, stored as ranges:

```json
{ "anime": [[1,437],[450,460]], "manga": [[1,1055]] }
```

`toRanges()`/`fromRanges()` in `app.js` convert to/from the `seen` Sets. A few
hundred bytes even for a finished voyage; skipped arcs are literal gaps.

**Merge by union, with per-unit conflict timestamps.** On sign-in,
`pullAndMerge()` unions local and remote `seen` sets, then
`mergeProgressState()` resolves edits to the same episode/chapter using recent
`added` and `removed` timestamps. The newest explicit action wins, so a stale
mobile cache cannot resurrect an intentional uncheck and an old removal cannot
erase a later re-check. Both maps travel inside the existing `removed` JSONB
payload, so this remains compatible with the original Supabase schema.

Offline-first: `localStorage` is the working copy, Supabase is the backup —
writes to it are debounced and best-effort (`pushRemote()`), never blocking.
Anonymous users get the full app with no login.

The header and Settings expose the current cloud state, the last successful
synchronization on this device, and a manual **Sync now** action. The status is
informational only: a failed or offline cloud save never blocks the local copy.

Auth: **email + password** via Supabase Auth (`signUp` /
`signInWithPassword` / `signOut`). Our own form (`#authForm` in the sign-in
modal, wired in `app.js`); Supabase owns the actual credentials — hashing,
sessions, resets — we never store or hash passwords ourselves. No OAuth,
no Google/Meta apps (deliberately dropped for simplicity). The form degrades
to a disabled "not configured" state when `config.js` still has placeholders.
Supabase's free tier **pauses after 7 days of inactivity**, so
`.github/workflows/keepalive.yml` pings it every 3 days — activates once
`SUPABASE_URL`/`SUPABASE_ANON_KEY` are set as GitHub repo variables.

---

## Gamification: built, and deliberately not built

Built: **crew roster** (10 seats — finish an arc, gain the shipmate),
**pace + ETA**, **sailors at your island** (mocked), and the **quick-log**
card (`#qlog`, `renderQuickLog`) — a "Next up" tile above the Log Pose that
marks the next unwatched episode/chapter in one click and lets you jump to a
number, so a newcomer can log progress and watch the map fill in without ever
opening the Log Book. "Next up" is the lowest-numbered unmarked unit; the
jump box is additive (never unmarks). It reveals the arc/island only when the
spoiler shield would allow it, same rule as the Log Pose.

Rejected on purpose:

- **Leaderboards, PvP, rankings, anything competitive.** Progress is
  self-reported and **unverifiable** — anyone can tick 1168 episodes in four
  clicks. Fine for a tracker (you are only lying to yourself). Fatal for a ladder.
  Keep it single-player, cooperative, or cosmetic.
- **Daily streaks.** They punish a week off and reward skimming a show that
  rewards the opposite. The pace/ETA readout does the motivating job without the
  cruelty.

**Bounty** (progress as an escalating Berry bounty, profile as a wanted poster)
is the strongest unbuilt idea. Still on the table.

---

## Pace: the one non-obvious algorithm

A day where the user ticked a huge block is **data entry, not viewing**, and is
excluded from the average (`BULK = 40` — a heavy-but-real binge still counts; a
hundreds-strong import doesn't). Otherwise importing 400 episodes on day one
would have the app claim they watch 400 a day. Needs **2 active days** before it
estimates a pace.

When there isn't a pace yet (fresh, or only big catch-up days), the card doesn't
dead-end — it shows the **remaining count** ("1,068 episodes to go") and invites
a couple of real viewing days. This matters because a pure bulk-marker genuinely
has no *viewing* pace to measure, so "X to go" is the honest, useful thing to
show instead of "not enough".

---

## Assets

No island images right now — the detail panel used to have an image frame
with a "No image yet" placeholder; both are gone. If images come back, they
ship with the chart (an `img` field on island data, curated), **never**
user-supplied — do not add an upload field.

Titles + short summaries live in `data/<kind>/<block>.json`, scraped from the
fandom MediaWiki API by `scripts/fetch-fandom.mjs` (see the Data section). Weekly
update is just `npm run fetch:chapters` / `npm run fetch:episodes` — the script
auto-detects the newest stored unit and fetches onward. Do not hand-edit those
files or bulk-copy other scraped databases into the repo.

---

## Backlog

- [x] Swap `window.storage` → `localStorage` + Supabase (sync layer)
- [x] Episode/chapter/arc data as the `ARCS` constant in `app.js`, updated by
      hand as episodes/chapters release (guardrails assert it at load)
- [x] Auth + sync (email/password via Supabase, merge-by-union) — code done;
      needs you to create the Supabase project + fill `config.js` (see Storage)
- [x] Quick-log "Next up" card — one-click marking without opening anything
- [x] Infinite wrap-around pan (the cylinder actually pans round now)
- [x] Map beautification within the chart identity (Red Line mountain wall,
      glowing Grand Line, domed islands) — see Style
- [x] `git init` + push to GitHub, GitHub Pages enabled (serves main/root)
- [ ] Fill `config.js` with real Supabase URL + anon key to turn on auth/sync
- [ ] Set `SUPABASE_URL`/`SUPABASE_ANON_KEY` as repo variables for the keep-alive cron
- [ ] Promote the richer map study after review. `map-art-lab.html` currently
      prototypes original layered Red Line terrain, recessed Reverse Mountain
      channels, painterly water, dense minor islets, and representative biome
      islands without changing the production renderer.
- [ ] Titles — deliberately out for now (owner's call)
- [ ] Curated island images (frame was removed; add back with real assets)
- [ ] Bounty

---

## Style

Design language is a **working hydrographic chart**, not a pirate treasure map.
Ink-teal sea, bone landmasses, brass instrumentation, red lacquer for the Red
Line. Islands are circles because Oda never gave us shapes — the abstraction is
honest, not lazy. The **Log Pose** is the signature element: it does what a Log
Pose actually does, which is record where you are and point at what comes next.

The chart is *rendered richly within that identity*, not flattened to bare
strokes — a deliberate line we held when the alternative (op-maps.com's
illustrated look) was on the table. It is now a **canvas orthographic globe**
(the flat SVG chart it grew out of is backed up in `flat.html`). Concretely:

- **Sea** — a radial depth gradient forming the lit sphere, faint graticule.
- **Red Line** — a continent-tall constant-width **wall** (`redWall()`) running
  pole to pole through both antipodal crossings; "RED LINE" set vertically on it.
- **Grand Line** — a luminous equatorial band (`latBand()`), the two Calm Belts
  as darker bands flanking it; all filled between latitude circles so they
  foreshorten with the sphere. Region labels (Paradise/New World, the four Blues,
  CALM BELT) are pinned to lon/lat and hidden on the far side.
- **Islands** — circles (landmarks are diamonds), a soft shadow, sized by
  importance, with a progress arc for partly-seen stops and an up-arrow for sky
  islands. The state colour (sailed red / here brass / next brass-lite / filler
  yellow) stays the primary fill — beauty is layered around progress, never over
  it. The **sailed wake** is red per-leg where `stopReached`, faint dashed ahead
  (a skipped island leaves a visible grey hole); anime detours branch off in
  yellow dotted lines. Names are spoiler-gated to `???` via `isShielded`.

The production globe is Three.js/WebGL and reads the same progress state the
flat map did — swapping the renderer, not the model. The cartography lab explores
original procedural landforms and landmark miniatures while keeping coastlines
editorial and abstract rather than copying another fan map's artwork.

When the data and my assumptions disagree, **the data wins**. It has already
caught me twice.
