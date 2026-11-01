# Station and room generation: what was done, what was tried, what next

The station and room generator rework on branch `shipgen-stations-1` (issue #193, part of #107), October 2026. It covers
what the generator does now, the research behind it, what was tried and dropped, and where to go next. The generator
itself is in `src/sim/shipgen/`; see [SHIPGEN.md](SHIPGEN.md) for ships and [SHIPGEN_HANDOFF.md](SHIPGEN_HANDOFF.md)
for the file map and sheet tools. [LAYOUT_RESEARCH.md](LAYOUT_RESEARCH.md) has the original literature notes.

## The goal

The user asked for generators "as good as they can be", with the station generator and the room generator working
together. Two requirements shaped the work:

- **Rooms read as designed, not filled.** A reactor room should look like someone drew it, not like pieces were dropped
  wherever they fitted.
- **Rooms are not always cramped.** Spaciousness varies by station kind: trading hubs are airy, navy and pirate
  stations are tight.

## How it works now

A station is generated in five stages. Each stage scores its own output, and the stages pass information both ways.

### 1. Structure

The grammars (ring, lattice, hub, welded, annexed, wheel, tree) draw the hull, the corridors and the room cells.

- **Big courts** are lined with a band of rooms grown as rectangles first, then L shapes (Lopes et al.'s constrained
  growth).
- **Ring stations** keep one court; their other pockets stay open to space.
- **Wheels** have four spokes, with up to two quarters filled as courts.
- **Spaciousness:** each station kind has a `space` range (`content/stations.ts`), rolled per station:

  | Kind | `space` range |
  |---|---|
  | Trading | 1.1–1.6 |
  | Research | 1.0–1.5 |
  | Agri | 1.0–1.4 |
  | Mining | 0.8–1.2 |
  | Navy | 0.6–0.9 |
  | Pirate | 0.5–1.1 |

  Room sizes and the reactor room's margin scale with it.
- **Rooms state their size.** Where the station is roomy (`space` ≥ 0.95), gun bays, shield rooms and the AI core are
  sized for their design (`designSize` in `rooms/designs.ts`; `sized()` in `stationPlan.ts`).

### 2. Room order and role swaps (station level)

- **Districts.** Rooms are ordered by a hill climb over an affinity table (`zoned()` in `stationKit.ts`), so related
  rooms cluster: habitation, logistics by the docks, a secure core, an industrial wing.
- **Role swaps.** After the structure is drawn, rooms that can stand in for each other trade roles wherever that raises
  the station's score (`roleSwap.ts`). Soft rooms swap with soft rooms (quarters, cargo, support, armoury), and core
  systems with core systems (reactor, shields, core). The floor areas of a swapped pair must be within 1.35× of each
  other. This is Merrell et al. 2010's order: the shape is fixed first, then each role goes where its neighbours suit
  it.
- **Station score** (`stationQuality.ts`):
  - adjacency: the share of wanted neighbour pairs within 12 tiles of walking distance (the `ADJACENCY` table);
  - clustering: how tightly each district holds together.

### 3. Room plans (room level)

A room's recipe can lay it out whole instead of placing piece by piece:

- **Berths:** quarters as barracks rows or one-bed cabins off a hallway.
- **Aisles:** holds and farms as back-to-back rows.
- **Designs** (`rooms/designs.ts`): machine rooms drawn as an architect would.
  - Each design is written once in a room frame (`rooms/frame.ts`): u along the back wall, v into the room. It is then
    set in each of the room's four turns.
  - Pieces come in mirror-symmetric groups placed whole, so a door that blocks one lamp of a pair drops both and the
    room stays symmetric. `opt` groups are left out where they don't fit.
  - Reactor rooms: `plantRow`, `twinFlank`, `plinth`.
  - Gun bays: `gunGallery`.
  - Shield rooms: `shieldCore`.
  - The AI core: `coreVault`, on stations only.
  - **Tight rooms:** a row that cannot sit exactly central leans half a tile, and both leans are tried. A room just big
    enough for its machine gets the machine and an aisle.

`planDesign` lays out every design, in every turn of the room, piece turn and lean, and scores each layout:

- the room-quality score (below);
- plus 3 for each optional group kept;
- minus 5 for a door in the back wall.

It keeps the best layout. Below a score of 70 the room goes back to its recipe's steps, which arrange a cramped room
better than a design packed into alcoves.

### 4. Repair: doors slide for a design (both generators)

The station draws doors before anything is in the room. When a door's approach (the two tiles inside it kept clear)
blocks every design, the door may slide up to two tiles along the same straight wall (`rooms/doorSlide.ts`). The new
spot must:

- still open onto the same room or corridor;
- have nothing standing on either side;
- have wall on either side;
- keep every tile reachable.

This is stations only (ships keep their mirrored doors). It is the score-and-repair idea from the research: the
station's plan (which rooms meet) is kept and only the detail moves, instead of the room giving up or the station being
reseeded.

### 5. Fit-out, islands, courts

- **Steps** (the old greedy placer) furnish everything a plan did not place. Use rules are enforced at placement: beds
  block walking, and use tiles are kept.
- **Islands** (`rooms/islands.ts`): a roomy room sets one working piece in its open middle, such as a reactor room's
  battery bank or a hold's rack island, with clear floor all round. These are working pieces only, never stand-in
  consoles.
- **Courts** (`rooms/courts.ts`, `rooms/station.ts`):
  - promenades run between the doors to a landmark at the middle;
  - themed zones (plaza, garden, drill) sit behind a few hedge planters;
  - floor finishes per tile: walk, soil, market, tread;
  - landmarks: the holo column, the great tree, and banner posts carrying the roof livery emblem.
- **Archways:** a door between two open rooms (hall, support, plaza, garden, drill) becomes floor. Hall-to-hall doors
  stay.

## How it is measured

- **`roomQuality`** (`rooms/quality.ts`) uses Merrell et al. 2011's interior design guidelines, on the tile grid:
  - **circulation:** the walk between entrances against the straight line;
  - **pockets:** dead-end floor that is nobody's use tile and on no walk from an entrance to one;
  - **alignment:** pieces against a wall or lined up with a neighbour;
  - **balance:** the pieces' centre of mass against the room's centre.

  `score` folds these into 0–100 (the weights are provisional). Density, openness and the room's shape (rect, ragged)
  are reported but not scored.
- **`stationQuality`:** adjacency and clustering (above).
- **`tools/shipgen/qualityReport.ts`** gives means over a seed range for every faction and station kind, split by role,
  layout family and room shape. Compare means over the same seeds; never compare single seeds.

Scores over seeds 1–6, every faction and station kind (84 layouts):

| Measure | Before the rework | Now |
|---|---|---|
| All rooms (corridors aside) | 84.7 | 86.5 |
| Gun bays | 74.6 | 80.5 |
| Reactor rooms | 77.6 | 80.0 |
| Shield rooms | 77.3 | 86.9 |
| AI core | 79.5 | 85.1 |
| Adjacency | 0.53 | 0.565 |
| Clustering | 1.30 | 1.38 |

- Generation takes about 300 ms per layout.
- About 290 of roughly 350 station machine rooms over seeds 1–6 now get a design, up from 175 before the tight-room
  work. The rest are irregular rooms, rooms where no design reaches 70, and rooms whose doors can't slide.

## Research and how it was used

| Source | Idea | Used for |
|---|---|---|
| Lopes, Tutenel, Smelik, de Kraker, Bidarra, ["A constrained growth method for procedural floor plan generation"](https://publications.graphics.tudelft.nl/papers/584) (GAME-ON 2010) | Rooms grow from seeds, rectangles first, L shapes last | Court bands |
| Merrell, Schkufza, Koltun, ["Computer-generated residential building layouts"](https://www.cs.princeton.edu/courses/archive/spring11/cos598A/pdfs/Merrell10a.pdf) (SIGGRAPH Asia 2010) | A program (rooms and adjacencies) first, then stochastic optimisation of the plan | Districts, the adjacency table, role swaps after the structure |
| Merrell, Schkufza, Li, Agrawala, Koltun, ["Interactive furniture layout using interior design guidelines"](https://graphics.stanford.edu/projects/furniture/) (SIGGRAPH 2011) | Clearance, circulation, alignment, balance and symmetry as one cost | The `roomQuality` terms; symmetry as a property of the designs |
| Yu, Yeung, Tang, Terzopoulos, Chan, Osher, ["Make It Home"](https://ww3.math.ucla.edu/camreport/cam11-49.pdf) (SIGGRAPH 2011) | Arrangements optimised against a cost, not placed greedily | Scoring every design candidate and keeping the best |
| Tutenel, Bidarra, Smelik, de Kraker, ["Rule-based layout solving and its application to procedural interior generation"](https://research.tudelft.nl/en/publications/rule-based-layout-solving-and-its-application-to-procedural-inter) (CASA 2009) | Object classes carry placement rules and "feature areas" kept clear | Access tiles, keep marks, use rules at placement |
| Bao, Yan, Mitra, Wonka, ["Generating and exploring good building layouts"](https://history.siggraph.org/?p=108396) (SIGGRAPH 2013) | Hard constraints plus soft goals; repair, don't reject | Door slides; design fallbacks instead of reseeds |
| Spelunky ([Kazemi](https://tinysubversions.com/spelunkyGen2/)), Cogmind prefabs ([Kyzrati](https://www.moddb.com/news/map-prefabs-in-depth)) | Hand-made templates stamped into generated maps | Room designs as authored templates that stretch to the room |
| Kate Compton, "10,000 bowls of oatmeal" | Variety is not memorability; a nameable feature is | Court landmarks |
| Shadows of Doubt devblogs (Cole Jefferies, ColePowered Games) | Everything is rooms linked by doors; props come after room colours | Only the archive summary was readable: DevBlog #13, "Creating Procedural Interiors", was blocked by the site's bot check. No method from it is used here. |

## Tried and dropped

- **Octagon and chamfered-square ring outlines** (twice). Straight sides keep ring rooms rectangular, but the user wants
  round stations round: the circle is what makes them interesting. The second attempt is kept as a fallback on branch
  `shipgen-stations-octagon` in case round rooms can't be made to work.
- **Placeholder consoles and seated consoles as islands.** Rejected by the user: consoles are working pieces with real
  mechanics, not decoration.
- **Drill-hall-specific landmarks** (sparring ring, targets, memorial). Rejected as against "more with less": too
  situational.
- **Podium landmark.** Rejected. The holo variants (ring, pylon, globe) were rendered but not built; they wait in
  `tools/blender/sprites/landmarks.py` (REVIEW).
- **A design-fit term in role swaps** (rooms swap toward sizes that suit their design). It had no measurable effect,
  because those rooms are already sized for their designs. Reverted.
- **Keeping reactor, core and gun rooms rectangular on ships.** It broke the ship symmetry and thickness tests, so it is
  stations only.
- **Designs with no quality floor in tight rooms.** Gun bays improved, but shield rooms (−1.1) and AI cores (−0.8) fell
  below the steps' arrangement over seeds 1–18. Floors of 70, 75 and 80 were measured; 70 keeps the most designs with
  every machine role above the baseline.
- **Phase 2 on ring bands** (rooms stating their size to ring bands). Mostly unnecessary: ring reactor rooms take their
  margin from `space`, and the design sizes apply where they matter.

## Known gaps

- **AI cores in 12×3 rooms** still use the steps' staggered layout. The core vault's straight row needs a one-tile gap
  between turrets (roof-mounted pieces can't touch), and `pockets` counts those gaps as dead floor, so the row scores
  under 70. It is a look-and-feel call: count required spacing as used floor, or accept the staggered layout.
- **Adjacency** (0.565) is the weakest score. Role swaps and room order have taken what they can; more needs structural
  rules per layout family (where the docks, the core and the industrial wing go).
- **Lamps:** the lamp pass adds lamps after designs and ignores their symmetry.
- **The `roomQuality` weights are provisional,** and the score knows nothing about symmetry or purpose, which the
  designs are built for.
- **Tests allowed to fail for now (user):** the stationLife intruder test bar and the mining-hub attempt count.

## What I'd do next

1. **Design-aware lamps:** a design names its lamp spots, and the lamp pass skips designed rooms.
2. **Symmetry in the score:** add a mirror term to `roomQuality`, so the planner and the floor value what the designs
   are for, and settle the core-vault gap question with it.
3. **Structural adjacency:** per layout family, place the docks, the secure core and the industrial wing first (a
   coarse zoning pass, as in the Subveillance devlog and Merrell 2010), then grow rooms into them. This is the only lever
   left on adjacency.
4. **More designs where rooms are still filled piece by piece:** bridge, armoury, medbay, mess.
5. **History and set pieces** ([LAYOUT_RESEARCH.md](LAYOUT_RESEARCH.md), "Making stations feel less generated"): a
   later wing in another style, a brig, a customs checkpoint.
6. **Space syntax audit:** depth from the docks and a two-routes metric for key rooms, for boarding play.

## Tools

- `node tools/shipgen/rooms.js <role> --spec station.<kind>:station --count 12 --out <dir>` draws room sheets (one role
  across seeds).
- `qualityReport(from, count, specs?)` in `tools/shipgen/qualityReport.ts` gives the score means. Load it through
  Vite's SSR loader, as `tools/shipgen/rooms.js` does.
