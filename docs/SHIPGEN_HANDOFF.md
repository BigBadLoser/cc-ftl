# Ship generator handoff: navy, drones, scrappers

For a coding agent picking up the generator cold. Read this first, then `docs/SHIPGEN.md` (the design and history,
newest notes per faction) only for the faction you touch. Branch: `shipgen`.

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
  - Run `npm run check` (lint, typecheck, test) before every commit. A full run takes about 60 to 80 s; the
    200-seed validity tests are the slow part.

## Pipeline

`generateShip` (`generate.ts`) runs one attempt per reseed, up to 24:

1. **Plan** (`plan.ts`): the faction budget at this depth becomes `RoomSpec`s (guns, crew, stores, hangars),
   engine and reactor counts.
2. **Arrange** (`navyLayouts.ts` `arrangeHull`):
   - Pick a hull family, draw its grammar once, and run 6 candidate arrangements.
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
5. **Stamp and fit out** (`generate.ts`, `fit.ts`, `layout.ts`): place modules in rooms, then lights, then extra
   reactors.
6. **Validate** (`validate.ts`): modules on floor or hull, reachability, power, helm or AI core, engines on the +x
   hull. Then **metrics** (`metrics.ts`) and the faction's metric bands. Any problem triggers a reseed.

## File map

`src/sim/shipgen/`:

| file | what it holds |
|---|---|
| `types.ts` | FactionDef, HullFamilyDef, grammar ids, DonorKind, TransitionStyle, GenResult and debug records |
| `plan.ts` | budget → ShipPlan and RoomSpecs, `weaponSpec`, `cargoSpec`, `pickWeighted`, `shuffle` |
| `generate.ts` | the attempt/reseed loop, fit-out, template, metrics |
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
| `scrapBlocks.ts` | civil and one-off donor builders (freighter, habitat, liner, station, barge, pods, tug) |
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

## How to iterate

Run all commands from the repository root.

```sh
# One faction, one depth, seeds 1..12, every view, into a folder of your choice
node tools/shipgen/cli.js faction.navy --depth 9 --count 12 --views all --out /tmp/sheets/after
# Views: detail | silhouette | assembly | structure (comma list) or all. Seeds: --from 13 --count 24
# One hull family only:
node tools/shipgen/cli.js faction.drones:picket --depth 9 --count 12 --views structure,silhouette --out /tmp/sheets/after
# Live viewer: npm run dev, then open /tools/shipgen/
```

- **Output:** `<faction>-d<depth>.png` (detail), `-silhouette.png`, `-assembly.png`, `-structure.png`, plus
  `<faction>-d<depth>.txt`.
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

1. **Navy drive-bank notch.**
   - Symptom: a one-tile vertical slot between the last spine section and the drive bank (and between twin hulls
     and their drives).
   - Cause: the taper stops at exhaust rays or doesn't find the step (`hullFill.ts` `taper`; the drive attached in
     `navyKit.ts` `propulsion`).
   - Done: no slot on the depth-9 silhouettes, and engines still validate.
2. **Scrapper size scaling.**
   - Symptom: depth-1 scrappers are almost as big as depth-9 ones.
   - Cause: every job gets a donor and donors have minimum sizes (`scrapGrammars.ts` `choose`, `scrapDonors.ts`).
   - Done: depth-1 sheets visibly smaller, while the at-least-three-donor-kinds test still holds.
3. **Navy carrier length.**
   - Symptom: carriers come out at about 2.3 against a 2.8–3.6 target.
   - Cause: the central hangar block and two deck layers (`navyGrammars.ts` `carrierIsland`, `flightDeck`).
   - Done: carrier aspect about 2.8 on 12 depth-9 seeds.
4. **Drone swarm mixed grammar.**
   - Symptom: some lattices grow a straight line of nodes (half comb).
   - Cause: links prefer growing east (`droneGrammars.ts` `cluster`).
   - Done: no swarm with three or more nodes in a straight line on the depth-9 structure sheets.
5. **Drone prong crowding.**
   - Symptom: inner-face pods on fork and twin prongs clump against the stem.
   - Cause: `frame` prongs give inner faces when `sep >= 6`, and the sockets fall back to direct placement
     (`socketed`).
   - Done: pods stay ordered on the prongs (staggered at most).
6. **Scrapper grey slabs.**
   - Symptom: patched reactors and strapped engines read as plain slabs.
   - Cause: `scrapBlocks.ts` `reactorRoom`, and `podBlock` used for strapped engines.
   - Done: those pieces have a recognisable shape.
7. **Scrapper blobs.**
   - Symptom: heaps of four or more donors merge into one blob.
   - Cause: welding onto any host on any face (`scrapGrammars.ts` `compose`).
   - Done: donors are still distinguishable on the structure sheet.
8. **Taper plating draws as solid grey walls** in the detail view.
   - This is a tools concern (`tools/shipgen/draw.ts`), not sim. Optionally draw `plate` blocks as a lighter
     armour tone.
9. **Smaller weak spots:**
   - Battleships still bulge slightly at the turret pairs.
   - Within-grammar variety in the navy is low.
   - Ring pickets have long struts on the outer staggered row.
   - About 10% of first scrapper attempts fail fit-out; reseeding covers it.

## Acceptance for any change

- For every faction (navy, drones, scrappers, and civilians once merged), 12/12 seeds valid at depths 1, 4 and 9.
- No metric average regressing beyond its healthy range; first-attempt success not worse.
- Before and after sheets (silhouette plus the relevant detail or structure view) attached to the change.
- `npm run check` green.

## Coordination with the civilian work

The civilian generator is being built in parallel on the same branch.

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
