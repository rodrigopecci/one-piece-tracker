# Grand Line Chart

A One Piece progress tracker whose primary interface is a **map**, not a list.
You mark episodes or chapters; your position, your wake, and your crew move
across the world of One Piece.

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
config.js                        Supabase URL + anon key (public-safe); optional
supabase/
  schema.sql                     run once in the Supabase SQL editor — one
                                 table: progress
.github/workflows/keepalive.yml  pings Supabase so the free tier doesn't pause
package.json                     just `npm run serve`
```

Keep it dependency-free and buildless — it deploys anywhere, loads instantly,
has no toolchain to rot. Splitting `app.js` out of `index.html` and adding a
Supabase backend (auth + sync only) were the two deliberate "real reasons not
to" stay a single file.

---

## The world model

The One Piece world is a sphere with two great circles crossing it. Flattened to
a 4000×2400 rectangle:

- The **Grand Line** runs horizontally across the middle — a *corridor* 210 units
  wide (`GL_TOP`..`GL_BOT`). It leaves the right edge and returns on the left,
  because it is a circle.
- The **Red Line** crosses it **twice**, so it appears as two vertical bars:
  Reverse Mountain (`RL_A`, x=1000) and the holy land (`RL_B`, x=3000).
- **Calm Belts** flank the Grand Line. Dead water. Only Amazon Lily and Impel
  Down live there.
- The four **Blues** are the four quadrants those two lines cut the world into.

Therefore: **Paradise** is between the two Red Line crossings, and the **New
World** is the wrap-around half — which puts Laugh Tale a stone's throw from
Reverse Mountain, where it belongs.

Because it's a cylinder, the map **pans around forever** — scroll off the New
World and Paradise comes back in. This is real, not faked: everything
positional is drawn at three tiles (`TILES = [-W, 0, W]`), the viewport wraps
`view.x` modulo `W` (`clampView`), and each route leg is drawn the short way
round. The ghost tiles are identical so the seam is invisible. Zoom-out is
capped at one world width (`MAX_W = W`) — seeing more than the full
circumference is redundant and keeps three tiles enough to cover the view.

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

No titles anywhere, anime or manga. There's no clean API for either (checked:
Jikan has episode titles but a binary filler flag that disagrees with the
4-way taxonomy the app shows; MangaDex lost nearly all English chapters to a
publisher takedown; AniList/Jikan don't track chapter titles). Numbers only,
both media. There's no filler/mixed concept on the manga side anyway — it's
the source material, 100% canon by definition.

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

**3. Nothing is connected to Laugh Tale.**

Nobody knows what comes after Elbaf. The route stops at Elbaf. Laugh Tale sits on
the map, unreached and unlinked. Do not draw a line there. When a user catches up,
the Log Pose reads "Nowhere left to sail" rather than inventing a heading.

---

## Deploy

**GitHub Pages**, served from `main` at root — the app is static, no build
step. Repo: `github.com/rodrigopecci/one-piece-tracker` (personal account,
public). Live at `https://rodrigopecci.github.io/one-piece-tracker/`. Every
push to `main` redeploys automatically. (Cloudflare Pages would also work and
was the original plan, but GitHub Pages keeps everything on one platform and
this app needs nothing Cloudflare-specific.)

The app uses relative asset paths, so it runs fine under the `/one-piece-tracker/`
subpath.

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

**Merge by union, not last-write-wins.** On sign-in, `pullAndMerge()` unions
local and remote `seen` sets — progress is additive, so this can never lose a
tick. Unticking is the rare exception: each side tracks recent removals as
`{unit: timestamp}` in `state.removed`, and `mergeSeen()` only lets a removal
win the tiebreak when it's newer than what it's competing with.

Offline-first: `localStorage` is the working copy, Supabase is the backup —
writes to it are debounced and best-effort (`pushRemote()`), never blocking.
Anonymous users get the full app with no login.

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
excluded from the average (`BULK = 25`). Otherwise importing 400 episodes on day
one would have the app claim they watch 400 a day. Needs 3 active days before it
will guess at all.

---

## Assets

No island images right now — the detail panel used to have an image frame
with a "No image yet" placeholder; both are gone. If images come back, they
ship with the chart (an `img` field on island data, curated), **never**
user-supplied — do not add an upload field.

No titles — episode or chapter — anywhere, and do not bulk-copy scraped
databases into the repo. See the Data section for why.

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
- [ ] Richer map (more) — deferred, needs a design pass. Must stay a
      **hydrographic chart**, not an illustrated map. Candidates: a wake trail
      on the sailed route, compass rose + graticule labels, current-flow lines.
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
illustrated look) was on the table. What that means concretely:

- **Sea** — depth gradient plus faint horizontal swell behind the grid.
- **Red Line** — a continent-tall mountain *wall*, not a bar: an irregular
  coastline down both sides (a deterministic function of `y`, so all three
  wrap-tiles match), a horizontal cliff→sunlit-crest→cliff gradient
  (`#redWall`), rock texture, and a jagged ridge spine.
- **Grand Line** — a luminous corridor (`#glGlow`) with flowing current
  streamlines threaded down the channel.
- **Islands** — still circles, but *charted* ones: a soft shadow pool
  (`#isleShadow`) lifting them off the sea, a light-from-top-left land dome
  (`#isleSheen`), a coastline stroke, sized by importance. The state colour
  (sailed red / here brass / filler yellow) stays the primary fill — beauty
  is layered around progress, never over it.

All of this is plain SVG (gradients, paths, one extra shadow+sheen element
per marker), kept light because the wrap renders everything three times.
Illustrated per-island landmasses were considered and **rejected** — they'd
mean fabricating coastlines Oda never drew, which is exactly the dishonesty
the circle abstraction avoids.

When the data and my assumptions disagree, **the data wins**. It has already
caught me twice.
