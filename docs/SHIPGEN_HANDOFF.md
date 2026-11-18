# Ship generator handoff: navy, drones, scrappers

Start from `main` and check [project status](STATUS.md) for active work. Use [SHIPGEN.md](SHIPGEN.md) for faction
design and iteration history and [STATION_ASSEMBLY.md](STATION_ASSEMBLY.md) for station and outpost layouts.

## Scope and rules

- **In scope:** generator code (`src/sim/shipgen/`), faction layout data (`src/content/factions/*.ts`: hull
  families, grammars, weights, transition style), validation and metrics, the sheet tools (`tools/shipgen/`), and
  the generator tests (`src/content/factions/shipgen.test.ts`).
- **Out of scope:** sim systems, render, ui and app. Don't add sim concepts; log them as follow-ups in SHIPGEN.md.
- **Hard rules (from CLAUDE.md) that matter here:**
  - `src/sim` is pure TypeScript: no three, svelte or DOM, no `Math.random`, no `Date`. Lint enforces it.
  - All randomness comes from the seeded `Rng` passed down (`c.rng`). The same seed and depth must give the same
    ship (a test checks this).
  - Content imports only types from sim, and uses `satisfies FactionDef`.
  - Soft limit of about 400 lines per file. Split files rather than grow them.
  - Tests sit next to their code as `*.test.ts`. No test or demo code in `src/` otherwise.
  - Run `npm run check:fast` before committing and `npm run check:push` before pushing. See
    [Test tiers](ARCHITECTURE.md#test-tiers) for full runs and seed sweeps.

## Pipeline

`generateShip` (`generate.ts`) runs one attempt per reseed, up to 24:

1. **Plan** (`plan.ts`): the faction budget at this depth becomes `RoomSpec`s (guns, crew, stores, hangars),
   engine and reactor counts.
2. **Arrange** (`navyLayouts.ts` `arrangeHull`):
   - Pick a hull family, draw its grammar once, and run 6 candidate arrangements. The family is the seed's: every attempt
     builds the family of attempt 0 (`hullOf`), so `previewHull` is what the ship becomes (the roster relies on it, #577).
   - Score them on aspect against the family target, compactness and enclosed holes, and keep the best.
   - `Ctx.variant` is drawn once per ship, so every candidate shares architecture choices such as the drone
     topology.
3. **Grammar** (`navyGrammars.ts`, `components.ts`, `droneGrammars.ts`, `scrapGrammars.ts`): builds BLOCKS (an
   assembly drawn on a local Builder and frozen with typed ports) and joins them on the shared 2D **Arranger**
   (`arranger.ts`: ports, attach, mirrored attach, feasibility).
   - Structural helpers: `profile.ts` (depth or strut length along a run), sockets (hull spine sockets in
     `components.ts`; truss sockets in `droneGrammars.ts`), sponson mounts (`navyMounts.ts`).
4. **Hull fill** (`hullFill.ts`): tapered transitions in the faction's style, seam plates and enclosed-pocket fill.
   These only add wall on space and never touch reserved cells (gun and airlock faces, engine exhaust).
5. **Stamp and fit out** (`fitOut.ts`, `fit.ts`, `layout.ts`): place modules in rooms, then lights, then extra
   reactors. Equipment its own room has no space for tries a room where it still belongs (`ELSEWHERE`: a shield
   generator in engineering, a shield console in the core).
6. **Validate** (`validate.ts`): modules on floor or hull, reachability, power, helm or AI core, engines on the +x
   hull; `fitShell` also checks for engines enough for the hull's size (`templateHullLoad`, the player's engine capacity rule). Then **metrics**
   (`metrics.ts`) and the faction's metric bands. The plan's equipment is required (`equipment.ts`, #577): a ship short of
   the guns, point defence, shield generators and consoles, drone or shuttle bays `plannedEquipment` counted is a problem.
   Any problem triggers a reseed.

**Engine top-up** (`generateAttempt`, #129, #571): `planShip` first books the engines a hull will need from its rooms: the family's
`hullPerRoomTile` (hull tiles per room tile, measured over generated ships) times the planned room area, against `hullCapacity`; the
reactor cap grows with them, so they cost no guns. A family without the field books none. The safety net: a ship that fails only on
its engines after the fit-out is built again from the same attempt seed with the engines it lacks added (`extraEngines`), up to 3 times,
before that check reseeds it. Re-measure a family's number when its grammars or budgets change a lot: too low costs rebuilds, too high
costs an unneeded engine.

**Engine tier** (`engineFor` in `plan.ts`, #580): a ship carries one tier of engine, the highest whose blueprint `minDanger` the generation depth reaches (Mk II from 3, Mk III from 6; a faction's `maxEngineTier` caps it, drones stay Mk I for their sealed pods). `ShipPlan.engine` names it, `engineSpec` sizes the room to its footprint, and the budget's engine count (in Mk I) is divided by the tier's evasion ratio. `hullEngines` uses the tier's `hullCapacity`.

## File map

`src/sim/shipgen/`:

| file | what it holds |
|---|---|
| `types.ts` | FactionDef, HullFamilyDef, grammar ids, DonorKind, TransitionStyle, GenResult and debug records |
| `plan.ts` | budget → ShipPlan and RoomSpecs, `weaponSpec`, `cargoSpec`, `pickWeighted`, `shuffle` |
| `generate.ts` | the attempt/reseed loop, the seed's hull family, template, metrics |
| `fitOut.ts`, `fitted.ts` | the fit-out (modules into rooms, lights, extra reactors); the fitted layout and its template |
| `equipment.ts` | the plan's required equipment: `plannedEquipment`, `equipmentShort` |
| `arranger.ts` | the 2D arranger: Block, ports, attach, attachMirrored, `mirrorBlock`, `mirrorX`, `cell` / `reserved` / `box` |
| `hullFill.ts` | after-arrangement plating: `taper`, `plate`, `holes`, `fillHoles` |
| `blocks.ts` | `blockFrom` (freeze a local Builder into a Block), `localBuilder`, `hallBlock` |
| `builder.ts`, `canvas.ts` | the tile drawing surface: rooms, strips, doors, stamping, crop |
| `profile.ts` | `Profile`, `depthAt`, `rollProfile`: one outline curve per run |
| `navyLayouts.ts` | `arrangeHull`: grammar draw, candidates, scoring, transitions; shared by all factions |
| `navyKit.ts` | Ctx, `jobs`, `bands`, `section`, `chain`, `deckPair` (span, xMin, profile), `evenDepth`, `spanOf`, `propulsion`, `twinDrives` |
| `navyBlocks.ts` | navy blocks: band, enclosed (citadel and hangar), deck, nose, bank, cluster, pods, dock |
| `components.ts` | profiled hull spine with flush gun sections, sockets; corvette, frigate and battleship grammars |
| `navyMounts.ts` | sponson `mountBlock`, `mountGuns` (spread / fore / mid / aft, paired or staggered) |
| `navyGrammars.ts` | the other navy grammars (decks, wings, citadel, twin hull, carrier island, flight deck) and the GRAMMARS table |
| `droneBlocks.ts` | sealed pods, crawls, the core room, beams, stores |
| `droneGrammars.ts` | sockets, `frame` topologies (single, fork, twin, h, collar, ring, brace), drives, picket, lancer and swarm |
| `civilBlocks.ts` | civil builders shared by the civilian generator and scrapper donors (freighter, habitat, liner, station, barge, pods, tug, containers, cockpit, drive, cabins, lounge, cross hub) |
| `civilGrammars.ts` | civilian topologies: freighter, liner, mining, station |
| `civilFrames.ts` | civil frames: container frames, ore cages, truss bridges, rig booms, the liner's 2D hull |
| `civilStations.ts` | ring and lattice stations (the civilian station hull) |
| `stationTypes.ts`, `stationCrew.ts`, `stationBuild.ts`, `assembly/` | stations: kinds and tiers, crew posts, `buildStation` and the station assembly (`docs/STATION_ASSEMBLY.md`) |
| `civilKit.ts` | civil joins, drive, `beside`, variant picks |
| `civilShips.ts` | civil freighters, mining ships, crew bodies |
| `scrapDonors.ts` | the donor registry and job pool; navy and drone donors cut from their own generators |
| `scrapGrammars.ts` | salvage composition (heap, raft, chain), welding, improvised extras |
| `salvage.ts` | cuts at seams, corner damage, outline ports, `freeze` |
| `fit.ts`, `layout.ts`, `validate.ts`, `metrics.ts` | module placement, the layout model, validation, metrics |
| `topoNavy.ts`, `topoDrone.ts`, `topoParts.ts`, `topoSalvage.ts` | the older v2 topologies. Only factions without hull families use them; `topoNavy` still supplies `pickNose`, `pairUp` and `nose` |

`tools/shipgen/`:
- `cli.js`: renders contact sheets as PNG, plus a `.txt` summary with ASCII dumps.
- `draw.ts`: sheet layout, the detail view, diversity metrics, and the `faction:family` filter.
- `views.ts`: the silhouette, assembly and structure views.
- `live.ts`, `index.html`: the browser viewer.
- `templates.ts`: sheets of hand-drawn templates (starter ships and their variants), the iso view and the board.
- `templateDraw.py`: a drawing aid for hand-drawn templates (rooms, outlines, doors, beams, containers, modules).
- `starters/`: the starter ship variants (#241): `<ship>.py` draws the current round, `<ship>.ts` is the generated variant
  file the CLI reads, `<ship>R3.*`, `<ship>R4.*` and `<ship>R5.*` keep earlier rounds for reference (not tested), `picks.ts` lists the shipped
  starters, `kits.ts` and `variants*.test.ts` keep every current variant playable.

## How to iterate

Run all commands from the repository root.

```sh
# One faction, one depth, seeds 1..12, every view, into a folder of your choice
node tools/shipgen/cli.js faction.navy --depth 9 --count 12 --views all --out /tmp/sheets/after
# Views: detail | silhouette | assembly | structure (comma list) or all. Seeds: --from 13 --count 24
# One hull family only:
node tools/shipgen/cli.js faction.drones:picket --depth 9 --count 12 --views structure,silhouette --out /tmp/sheets/after
# Every room named and every piece of furniture coded, one PNG per seed (<base>-labels-s<seed>.png): use this
# to show a layout to the user, since silhouette and structure views are hard to judge rooms from
node tools/shipgen/cli.js faction.navy:cruiser --depth 9 --count 3 --views labels --out /tmp/sheets/labels
# Live viewer: npm run dev, then open /tools/shipgen/
```

- **Output:** `<faction>-d<depth>.png` (detail), `-silhouette.png`, `-assembly.png`, `-structure.png`, plus
  `<faction>-d<depth>.txt`.

### Hand-drawn templates (starter ships)

The same sheets work for hand-made templates, so a layout can be iterated without starting the game. The generator and
its grammars play no part: every room, door and module is placed by hand.

```sh
# A board: one PNG, a column per variant, rows iso / silhouette / structure / detail, a label under each cell
node tools/shipgen/cli.js --templates tools/shipgen/starters/lancer.ts --board --out /tmp/sheets/starters
# Or one PNG per view (--views detail,structure,silhouette,iso; --scale sets px per tile)
node tools/shipgen/cli.js --templates tools/shipgen/starters/picks.ts --views iso,detail --out /tmp/sheets/starters
```

- **Variant files** export `variants: { name, kind?, note?, template }[]` (`kind`: favourite, riff, new or shipped,
  shown in the label). The CLI prints each variant's size and tile count, and every `validateTemplate` problem, with the
  coordinates of unreachable tiles when there are any.
- **Iso view:** an approximation of the in-game camera (x runs down-right, y down-left, so the engines on the east hull
  face the viewer): the hull slab, floors, walls, and modules as blocks of their rough height and colour (engines orange,
  reactors yellow, weapons pink, shields cyan, airlocks white, containers orange, consoles blue). Use it to judge a
  silhouette from the game's angle; the in-game screenshot is still the final check.
- **Drawing:** `tools/shipgen/starters/<ship>.py` builds the variants with `tools/shipgen/templateDraw.py`
  (`Ship.room`, `hull` from column extents for stepped or tapered outlines, `vline` / `hline` interior walls, `door`,
  `beam`, `box` for a clamped container, `Shift` to place a block at an offset, `section` to head a group of modules
  with a comment, `show` to print the grid with a coordinate ruler). `starters/common.py` adds `room(s, name, x0, y0, x1, y1)`:
  a walled room (walls forced even inside an outline) with `row()` to line furniture along its north or south wall. `python3 tools/shipgen/starters/<ship>.py`
  rewrites `<ship>.ts`; then render the board. Edit the `.py`, not the generated `.ts`.
- **Playability:** `tools/shipgen/starters/variants.test.ts` checks every variant against the starter ships' rules
  (valid template, the ship's kit, beds, galley, helm, life support, airlock, hull load under 0.85);
  `variants.slow.test.ts` runs each for a minute (crew alive, everything powered, every room lit and breathable).
- **Shipping a variant:** copy its template into `src/content/ships/<ship>.ts` (the starter files there are plain,
  hand-written templates; `starterShips.test.ts` covers them).
  - The `.txt` has one line per seed: grammar profile, size, metrics, attempts, OK or problems, and rejected
    attempts.
  - It also has a `diversity:` header line.
  - The CLI prints the per-seed lines too: `grep -c ', OK'` should give 12, and `attempts 1` is the healthy norm.
- **Before and after:** render "before" from a clean tree into one folder, apply your change, then render "after"
  into another. To compare against a file you've changed, stash it: `git stash -- <file>`, render, then
  `git stash pop`.
- **Same ships:** changes that touch only the hull-fill passes keep the same ships. Changes to blocks, grammars or
  rng use shift compositions, so compare overall style rather than ship by ship.
- **Regression sweep:** run the CLI for `navy`, `drones` and `scrapper` at depths 1, 4 and 9. Each must be 12/12
  OK. Scrappers build navy and drone donors with those generators, so any change there must be checked against
  scrappers too.

### Metrics (per ship in the `.txt`; averages are worth comparing)

| metric | meaning | healthy |
|---|---|---|
| compactness | filled tiles / bounding box | navy 0.55–0.75, drones 0.33–0.45, scrappers 0.40–0.55 |
| occupancy | module tiles / room floor | navy 0.30–0.40, drones 0.70–0.90 (sealed pods), scrappers 0.35–0.45 |
| corridorRatio | corridor tiles / floor | navy 0.24–0.30, drones under 0.10, scrappers about 0.25 |
| narrowLinks | share of 1-wide corridor tiles | navy under 0.1 (2-wide halls), drones 0.3–0.9 (crawlways) |
| aspect | length / beam | corvette and frigate 3–4, cruiser 2.5–3.5, carrier 2.8–3.6 (soft targets in content); drones 1.5–2.2 |
| beamShare | beam tiles / filled | drones 0.15–0.20, others 0 |

Diversity (the sheet header; higher is more different):
- `shape`: silhouette distance.
- `sections`: grammar-profile edit distance.
- `adjacency`: join-pattern distance, broken down within and across family, and within and across grammar.

Healthy at depth 9:
- navy: adjacency about 0.66 (within family about 0.5);
- drones: adjacency about 0.47, across families about 0.6;
- scrappers: adjacency about 0.76.

Within-grammar adjacency is naturally low (0.2–0.3), because it counts join tokens, not geometry. Judge variety on
the structure and silhouette sheets.

## Design direction (hard constraints)

- **Assembly-driven, one shared arranger.** No faction-specific generators, no rigid full-ship templates. Factions
  differ through content data (families, grammars, weights, transition style) and reusable blocks.
- **Reuse structural helpers** (profile, sockets, mounts, frame topologies, hull fill) instead of adding special
  cases. A new helper must be generic and parametric.
- **Warships are long, like naval vessels, but not shoeboxes.** A slim spine with sponsons and tapers. Decks hug
  the hull lengthways; beam grows slowly with depth.
- **Three drone philosophies:** compact framed pickets (collar or ring chassis), exposed structural lancers (single,
  fork, twin, H trusses), distributed swarms (a 2D lattice with no spine).
- **Scrappers are anchored salvage compositions:** donors of several origins welded at seams, keeping their own
  geometry. Navy and drone donors come from those generators.
- **Early, rapid previews over polish.** Show sheets often; don't tune beauty shots.

## Backlog (in priority order)

**Before regenerating a starter:** since #366 (food), the hydroponics beds, meals and greens in the shipped starters
(`src/content/ships/{wayfarer,prospector,lancer}.ts`) are hand-edited. The python generators under `tools/shipgen/starters`
are stale against them (and were already behind the shipped stock lists), so running `ship.py` would erase the edits: port
them into the generators first.

Done in the #119 pass:
- **Navy drive-bank notch:** `hullFill.driveSeams` plates a slot of up to four tiles along x whose aft side is a drive block.
- **Navy carrier length:** island carriers take the navy nose; aspect about 2.2 -> 2.5-2.8 (still a little under the 2.8 floor).
- **Scrapper size scaling:** small budgets lean on multi-job donors and take no extras; depth-1 mean area 1729 -> 1470 tiles
  (depth 9: 3280).
- **Drone swarm lines and prong crowding:** no lattice row of three nodes; one prong's inner face only. The user plans to
  rework the drones later, so these are holding fixes.

Still open, renumbered:

1. **Scrapper grey slabs.**
   - Symptom: patched reactors and strapped engines read as plain slabs.
   - Cause: `civilBlocks.ts` `reactorRoom`, and `podBlock` used for strapped engines.
   - Done: those pieces have a recognisable shape.
2. **Scrapper blobs.**
   - Symptom: heaps of four or more donors merge into one blob.
   - Cause: welding onto any host on any face (`scrapGrammars.ts` `compose`).
   - Done: donors are still distinguishable on the structure sheet.
3. **Taper plating draws as solid grey walls** in the detail view.
   - This is a tools concern (`tools/shipgen/draw.ts`), not sim. Optionally draw `plate` blocks as a lighter
     armour tone.
4. **Smaller weak spots:**
   - Battleships still bulge slightly at the turret pairs.
   - Within-grammar variety in the navy is low.
   - Ring pickets have long struts on the outer staggered row.
   - About 10% of first scrapper attempts fail fit-out; reseeding covers it.

## Acceptance for any change

- For each faction (navy, drones, scrappers and civilians), verify 12 of 12 seeds at depths 1, 4 and 9.
- No metric average regressing beyond its healthy range; first-attempt success not worse.
- Before and after sheets (silhouette plus the relevant detail or structure view) attached to the change.
- Run the relevant generator tests and the [branch check](ARCHITECTURE.md#test-tiers).

## Historical coordination with the civilian work

> These notes record the split of work on the old `shipgen` branch. The civilian generator is now on `main`.

- **It owns:**
  - `src/sim/shipgen/civil*.ts` (new files);
  - `src/content/factions/civilian.ts`;
  - the civilian part of `shipgen.test.ts`;
  - the civilian entries in content and the faction registry.
- **Shared files that need small, additive, merge-friendly edits:**
  - `arranger.ts`, `blocks.ts`, `hullFill.ts`, `profile.ts`, `navyLayouts.ts` (the GRAMMARS table);
  - `types.ts` (union additions, such as a civil grammar id);
  - `scrapBlocks.ts` (the civil donor builders: the civilian work may move them into shared civil block files
    and re-export them, so scrapper donors keep working).
- In shared files, add rather than rewrite, and keep exports stable.
