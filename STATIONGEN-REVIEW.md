# Layout review: station generation on `stationgen/staged`

Scope: how the generated stations actually look and read, wheel-first, at station and hub size. Test health and
performance are noted at the end and are not the subject.

Refs used: `origin/stationgen-staged` (1e8b1462), `origin/pr-234` (bf5ddfcb), `main` (8a619649).
Reproduce any sheet: `node tools/shipgen/cli.js station.trading --size station --layout stationWheel --from 1 --count 4 --views detail --scale 7 --out /tmp/w1`
and `--size hub`, or drop `--layout` to see the mixed grammar.

## 1. Where the branch got to

The staged wheel is a real improvement on #234 and the first station generator in this codebase that reads as a
designed place rather than procedural mush:

- **Silhouette.** An annulus with four radial spokes and a centre junction, dock collars at N/S, a defensive ring of
  gun bays inside the band. It reads instantly as "wheel station", and it is compact (0.51–0.68) rather than a
  circle drawn around empty space (#234: 0.485–0.62 with a third of the ring empty).
- **Departments cluster.** Secure/defence rooms land in a contiguous arc off one street (seed 2 and 4: refinery +
  shields + armoury + medbay as a cluster on the E side, guns along the ring beside it); freight gets a street or a
  ring stretch; the clinic gets the free spoke. That is the department-driven premise working.
- **Density where it lands.** Where blocks are placed they are packed tight, doors on the street, no wasted depth.

So: the structure is right. What is wrong is what fills the structure.

## 2. What still doesn't read as a station

Ordered by how much it hurts the picture.

### 2.1 Courts are mega-rooms (the biggest single problem)

Measured over the pinned seeds, trading station, wheel grammar:

| seed | rooms | deck tiles | courts (tiles) | largest room |
|---|---|---|---|---|
| station/1 | 78 | 2944 | 3 (511) | hall 292, plaza 266 |
| station/3 | 69 | 2854 | 3 (615 = 22 %) | plaza 297 |
| hub/1 | 123 | 4012 | 2 (411) | hall 465 |
| **hub/2** | 174 | 7327 | **5 (3167 = 43 %)** | **plaza 1452 (≈38×38), then 729, 668** |

A single room of 1452 tiles at hub size; courts are 43 % of the deck there and 22 % at station size. Visually it
is one amorphous brown blob with a few furniture clusters scattered in it — the "big room disease" the branch's own
research note calls out, and worse than most rooms in the game.

It is by construction, not luck: `src/sim/shipgen/stationCourts.ts:165` — *"the rest of the pocket: … everything
else is court (one piece; slivers wall)"*. The court is deliberately one piece, so the larger the pocket the larger
the void. This is the one change that would most improve every sheet.

What it wants: a court as a *hall* — colonnade or planter spine down the middle, two-to-three parallel halls with
frontage on both sides, a size cap per piece, and a cross-route so no walk through it is longer than ~15 tiles
without something to see. The pocket's own band/passage machinery already exists (`band()`, the four three-wide
"passages"); it just stops short of splitting what it leaves behind.

**Pass 1 does the size cap** (§5): hub courts now top out at ~445 tiles instead of 1611, and every hub wheel comes out
as three to six halls. The internal structure (colonnade, planter spine, cross-route) is still missing — the walls that
split a court are plain, and a 400-tile hall is still a lot of bare floor.

### 2.2 The wheel is only half used

At station size the mass sits in one or two quadrants and the other two are bare spokes over black void; at hub size
(seed 1) the whole N and E interior is empty for 40+ tiles while the SW quadrant carries everything. The wheel
promises four sectors; the output delivers one and a half.

Cause: interior placement only happens where a department job lands. `placeJob` in `src/sim/shipgen/stationWheel.ts`
places the rooms it is handed and nothing else — there is no job for "fill sector 3", so sector 3 stays space.
A wheel wants the four sectors treated as equal units of work (each one gets a court, or a frontage of blocks, even
a service one), with the department programme choosing *what* fills a sector rather than *whether* it exists.

### 2.3 The centre is a bare junction

Every wheel has a 3×3 grey box where the four spokes meet, and nothing in it. The topology string even reports
`atrium` / `atrium filled` (seed 1 vs 2), but the drawing shows the same small box in both. For a wheel station the
centre is the identity feature — rotunda, concourse, garden drum, vertical core — and right now it is the least
interesting tile on the sheet. `plannedWheel` builds `{b, ring}` and never furnishes a centre; the atrium parameter
is decorative.

### 2.4 The band has no depth and no identity

At R 61 the outer band is still exactly one room deep, wrapped in a continuous strip: quarters, farm, mess, shop,
quarters, farm … with no break and no service loop behind it. It reads as a crust. The branch's department work
(`secure`/`freight`/`quiet`) changes which streets get blocks *inside* the ring and leaves the band random.

A wheel's band is the cheapest place to get "districts": two rooms deep at hub size, a service corridor behind the
front room, and the band's composition following the sector it belongs to (a quiet arc, an industrial arc, a
habitation arc) so the circumference has chapters rather than a repeating pattern.

### 2.5 Blocks come out as slabs

Quarters appear as rows of identical 6×4 boxes sharing a wall, all doored to the same street — a dormitory wall.
It is legible but monotonous, and the second row sits behind the first with no frontage. The plan's department
chains and mixed frontage (shop in front, stores behind) are not in the output.

### 2.6 Variety is thin in the good grammar

Seeds 2 and 4 are near-identical (same 91×95 outline, same tan court, same pink medbay block); 1 and 3 are siblings.
The bench reports five distinct parameter combinations over 12 seeds but Hamming 0.23; the free parameters are only
court count, secure side and guns/freight placement, so the shapes collapse onto a handful of wheels.

Parameters that would widen it cheaply: number and depth of inner rings (0/1/2), the band's depth and composition,
centre type (rotunda / drum garden / open well), court count and role mix, whether the spokes are straight or
staggered, and one or two sector-filling motifs (a cross-dock, a radial market street).

### 2.7 The other grammars are much further behind — and they are 8 of 11

Trading stations pick the wheel with weight 3 of 11 (`src/content/stations.ts:25`), so most stations the player meets
are the old ones, and none of them is close to convincing:

- **cross** (seed 6): 44 rooms in a 128×128 hull, compactness 0.15 — a bare `+` of single-tile corridors with four
  small caps at the ends. Not a station. (Already like this on `main`: 33 rooms, 0.154. Not a branch regression, but
  it is the largest layout gap in the game.)
- **annex** (seed 5): the best of the rest — a welded cluster of pods with bridges. Silhouette works; interiors are
  the same mega-courts.
- **ring** (seed 8): a square annulus of rooms around one enormous empty plaza with a few furniture dots. Reads as an
  unfurnished warehouse floor.
- **concentric, arc, spine**: untested here beyond the sweep; the sweep only checks that they validate.

If the goal is convincing layouts, the wheel is the vehicle, and either the others get brought up to it or the mix
stops leaning on them.

## 3. What I would change next, in order

1. ~~**Split the court.**~~ Done in pass 1 (§5): the size cap is in, the internal structure is not (still worth a
   pass — colonnade, planters, a cross-route). Touches `stationCourts.ts` only and improves every grammar.
2. **Fill the four sectors.** Give each sector of the wheel its own job so no quadrant is left as void; let the
   department programme choose the contents.
3. **Build a centre.** A rotunda room at the junction with the spokes entering it, three or four options, replacing
   the 3×3 box.
4. **Give the band depth and chapters** at hub size (2 deep, service loop, composition by sector).
5. **Widen the wheel's parameter space** (inner rings, centre types, staggered spokes, sector motifs).
6. **Deal with the other grammars**: at minimum stop `cross` producing a corridor skeleton with no body.
7. Only then the cheap structural metrics that would catch these regressions — largest-room share, sector balance,
   band depth — so a change can be judged on a sheet instead of by eye. (§2.1's numbers took a 20-line probe; worth
   folding into the bench when the layouts stop moving.)

## 4. How the research report (`.harness/uploads/deep-research-report.md`) lines up

Its architecture is **not a new direction for this branch — it is a description of where the branch already got to**,
plus two pieces of debt it hasn't paid. That is worth knowing before anyone treats the report as a rewrite brief.

### 4.1 Already done here, and it is what produced the improvement

| Report says | Branch does |
|---|---|
| rooms stay rectangular; the ring is not a room-shaping primitive | `lineSide` (`stationWheel.ts:36`) puts blocks on axis-aligned street frontage with a mid-wall door — the street jobs |
| budget the envelope from the program, not from a radius | `fits()` computes the least ring radius the program needs; the candidate score then prefers smaller |
| search over legal structures, never penalties for broken ones | `choose` (`stationWheel.ts:136`) builds candidates and refuses a candidate whose job finds no slot |
| 24 fixed seeds, labelled A/B sheets, red-seed corpus | `stationWheelPin.slow.test.ts`, `labels.ts`, `benchStation.js … compare` |

The gain I measured (#234 → staged: attempts 4.0 → 1.0, generation median 3.9 s → 1.2 s, voids 0.453 → 0.374) comes
from exactly the moves the report recommends. Its post-mortem of the earlier failures reads like the code still in the
tree: `fitAlong` (`stationRings.ts:103`) is the "rooms forced to conform to a curved envelope" search.

### 4.2 Where it is still right about this branch

1. **Three of the four placements still conform rooms to the curve.** Only the `street` job is rectangular; `beside`,
   `diagonal` and `quads` (`stationWheel.ts:55-74`) still call `fitAlong`, the radial half-tile arc search that maps an
   angle to a room. The report's fix taken literally: make the circulation ring a **polygon of straight corridor runs**
   (chords, 8–16 sides instead of a circle) so every bay on it stands against a straight segment, and the silhouette is
   still round. That would also cut most of what `thinWalls` has to fold afterwards.
2. **Walls are still reconciled by a post-pass.** `thinWalls.ts` exists because — its own words — "rooms, blocks and hull
   fill each draw their own walls, so walls pile up where parts meet" (`generate.ts:329`). The report says that pass
   should not have to exist; a shared boundary graph before rasterisation gets rid of it. In fairness the branch keeps a
   strong invariant the report would approve of: outline tiles are never changed.
3. **Negative space has no vocabulary.** The report's `VoidKind` is the right frame for §2.2: the answer to an empty
   quadrant is not "fill everything", it is to name it — a view court, a dock clearance, a deliberate open sector, each
   with an edge — and to refuse layouts whose empty space is packing residue.

### 4.3 Where I would not follow it

- **It has nothing on the actual blocker.** The court as one 1452-tile room (§2.1) is the worst thing on every sheet, and
  the report's only bearing on it argues for the same fix: residual space should become "structure, service volume,
  machinery pockets, or intentional negative space" — not a walkable single room. That is a `stationCourts.ts` change.
- **CP-SAT/OR-Tools as an oracle, and the WFC warning: no cost, no value here.** WFC isn't used, and feasibility isn't
  the failure mode — the branch finds a legal wheel on the first seed for every seed I measured.
- **Its scoring list re-invents the bench.** `stationBenchMetrics`/`stationBenchFlow` already cover adjacency, walk
  depth, frontage, voids and entrance counts. Take the two it lacks — largest-room share and sector balance — and skip
  the rest.
- **The wall-graph rewrite is a big change with no visible payoff yet.** The polygon ring buys most of it for a fraction.

### 4.4 Order I'd actually run

1. Court split (`stationCourts.ts`): one file, every grammar, biggest visual win.
2. Polygon ring (chords) so `beside`/`diagonal`/`quads` stop arc-fitting.
3. Sector vocabulary (`VoidKind`-style) so empty sectors are chosen, not left over.
4. Centre rotunda, band depth, wider parameters — as in §3.

## 5. Pass 1: the court size cap (on this branch)

`src/sim/shipgen/stationCourts.ts`: a court above `COURT_MAX` (450 tiles) is cut on the most balanced line through the
middle half of its longer axis (`splitCourt()`). The pieces left on either side are flood-filled into connected parts,
each of which is stamped as a court of its own — its own letter, its own doors onto circulation and onto shops, its own
furniture. The cut wall is stamped before the courts go in and is given one door per dozen tiles of wall (at most two)
once both sides are floor, so no hall is sealed off. A hangar deck is never cut.

Measured on trading wheel, before → after (same seeds):

| | before | after |
|---|---|---|
| largest court, hub | 1611 / 1452 / 668 tiles | 399 / 374 / 445 (max) |
| largest court as share of deck, hub | up to 43 % | 8 % |
| courts per hub wheel | 1–2 | 3–6 |
| largest court, station | 412 | 412 (unchanged but seeds 10, 12: 451) |
| mean attempts, 32 seeds station+hub, wheel+concentric | 1.28 | 1.28 |
| problems / failed builds | 0 | 0 |
| wheel pin (24 station seeds) | — | 22 unchanged, 2 updated (10, 12) |

Why 450 and not less: with a cap of 300 the wheel's mean attempts went 1.28 → 1.53 (station seeds 2 and 4 split, and
the extra rooms shift the RNG the module pass draws from, so the dock airlock lands on attempt 2 — the
`stationRings` "airlock on the first attempt" test failed). 450 leaves a ~21×21 concourse whole, kills every real
void, and costs nothing. That dependence of the module pass on the shared RNG stream is worth fixing on its own: it
is what makes any layout change pay in retries.

What pass 1 does not do: the halls are still bare floor with a wall through them, and court area as a share of the
deck is unchanged (~28 % on hubs). The next pass is the one that makes a hall look like a hall — colonnade or planter
spine, a cross-route, frontage both sides.

## 6. Pass 2: colonnades in the halls (on this branch)

`stationCourts.ts`: a court of 150 tiles or more gets piers — single-tile walls on a six-tile lattice, placed before the
court is stamped (so they read as structure, not as a room split), never within three tiles of the hall's own walls and
never on the three-wide aisle down the middle of its longer axis. The piers survive the wall-thinning and thin-stub
passes (24–32 free-standing piers per hub) and cost nothing downstream: a seed's rooms, hull and doors are identical to
pass 1 — only the plaza floor changes — so mean attempts stay at 1.00 and the pin moves because the rows moved and
nothing else.

| | pass 1 | pass 2 |
|---|---|---|
| free-standing piers per hub | 0 | 24–32 |
| occupancy / rooms / mean attempts | 0.35 / 127 / 1.00 | 0.35 / 127 / 1.00 |

Also measured, and *not* done: the other hole in the picture is the wheel leaving quarters open to space — a hub drawn
with `courts 1` has three quarters of nothing in it, which is most of the black on the sheets. Raising the wheel's court
count to 2–4 fills them (hub court share 0.25 → 0.35, rooms 127 → 161, mean attempts 1.00 → 1.13), but that is more
concourse, not more station: those quarters want rooms (a habitat block, an industrial block), which is the
sector-vocabulary pass.

## 7. State and mechanics, briefly

- `stationgen/staged` = #234 + 15 commits (bench, docs, wheel refactor, wheel pin). #234 is closed, unmerged; nothing
  was lost, the branch is its descendant.
- The wheel refactor is a large reliability win: #234 needed 4.0 attempts and 3.9 s median per wheel, staged 1.0 and
  1.2 s, and the pin test holds 24 seeds.
- Costs the refactor paid, for the record: outline roughness 0.303 → 0.347, expectation pass 0.888 → 0.850.
- Not the subject now, but recorded: two of the branch's own tests fail (stationLife alarm, blackMarkets truce), the
  branch's stations cost ~1.8× to tick and ~2.9× to generate vs its base, ships are not on `main`'s behaviour despite
  the doc saying so, and merging `main` conflicts in 14 files. None of that blocks layout work; all of it blocks a PR.
