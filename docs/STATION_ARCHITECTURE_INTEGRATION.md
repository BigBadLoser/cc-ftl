# Station architecture integration — implementation checkpoint 1

**Status: phase 0 complete for a 12-seed baseline; phase 1 foundation implemented but NOT yet the final authoritative generator.** This is a real, optional TypeScript implementation against the archived `cc-ftl-stationgen-staged` snapshot, not V18 and not a visual redesign. It must be rebased against the active branch before adoption.

## Implemented source

- `src/sim/shipgen/stationArchitecturePlan.ts`: typed **room program**, named **regions**, **public/private access**, physical **portals**, **named route anchors**, corridor width policy, exact rectangular room-core checks, explicit boundary owner records, and a **single wall compiler** deriving internal and exterior walls from the union of floor tiles. This compiler has no automatic exterior dilation, duplicate hull layer, or silent 2×2 slab repair.
- `src/sim/shipgen/stationHullIntegrity.ts`: recovered V2 checker from `v2-on-original-staged.patch`, unchanged in its basic logic; exterior flood, whole-wall connectivity, 2×2 solid wall and diagonal exposure constraints. (Do not claim a new hull algorithm.)
- `src/sim/shipgen/stationGen.ts`: optional **sixth argument** `auditArchitecture` (default `false`). With `true`, the *identical finished and furnished template* receives `architecture.sourceRequirements`, `architecture.report`, and `architecture.hullIntegrityProblems`. The normal gameplay generation path is unchanged; this is not a substitute generator.
- `src/sim/shipgen/stationArchitecturePlan.test.ts`: nine focused tests (one shared room/hull boundary with no perimeter padding, same-raster import, overlap rejection, named route continuity, V13 internal-jog rejection, exact room core, physical three-wide door, 2×2 wall defect, direct public access).
- `tools/shipgen/auditStationArchitecture.js`: native repo command that runs the diagnostic against real station kinds/seeds with installed Vite dependencies.

## What the geometry model guarantees on authored fixtures

- Explicit floor ownership; floor overlap prohibited by construction.
- Exactly one cell allocated per shared physical boundary; one tile shared by room and exterior hull (no extra wall + service strip).
- Portals carry semantic owners and actual aperture tiles. Three-wide physical doors must specify all three contiguous wall tiles.
- Named routes require anchors on actual floor regions, cardinal path continuity, width (1/2/3), and no 1–2 tile mid-span jogs (V13 rule). **Routes are not inferred merely from one connected corridor bitmap.**
- Required room shape validates a minimum *actual rectangular clearance*, not area alone; tapered extra area can be retained around that core.
- A finished legacy generated template can be imported **losslessly** and audited. It remains a read-only adapter until the canonical representation becomes the authoritative builder.
- Checks for 2×2 wall slabs, diagonal floor exposure, missing doors, public network splitting, independent public entrance, and hull connectedness.

## Real generated baseline, fixed seed and program

12 generated and furnished native stations: trading station seeds 1–4; mining station seeds 1–2; farming station seeds 1–2; trading hub seeds 1–2; trading outpost seeds 1–2. Default station grammars, not selectively chosen clean output. Report and two diagnostic tilemaps are packaged in `evidence/`.

| Result | Count |
|---|---:|
| Native `generateStation` reports no problems | 12/12 |
| Architecture auditing leaves output hash unchanged | 12/12 |
| Recovered V2 hull checker passes | **2/12** |
| All rooms have a direct public-space entrance | **5/12** |
| All rooms have independent access via largest connected public component | **1/12** (provisional access classification) |
| One connected structural wall network containing the exterior hull | 12/12 |

**Caveats:** 2×2 hull-check failures can include junctions elsewhere in the template; they must be investigated tile by tile, not automatically removed. Direct public access is classified from room roles and finished floor/door tiles, and may require security/service exemptions. A reported station with no original problems is **not proof** that the new architectural gates pass. We have not proven whole-program room mapping or furnishing against the new compiler; the original pipeline remains the emitter. The inferred public network can be overly strict for specific station kinds, pending explicit secure/service topology.

## Research alignment and recovered code

- **Merrell, Schkufza & Koltun (2010)** — separate program/topology from realization and solve constraints in an iterated loop. The new plan stores program, named routes, physical geometry, and failure provenance side by side, but **bidirectional optimization is not yet implemented**.
- **Lopes et al. (2010)** — constrained growth of shape-preserving rooms. Preserve the original `stationCourts` / `stationRings` room-growth routines; new room clear-core checks allow irregular fringes but do not substitute for placing those rooms.
- **GPLAN / G2PLAN (2021–2022)** — dimensions are constraints on adjacency-driven floorplans. `StationRoomRequirement` and actual rectangular-core validation are in place; multi-bay program-to-geometry planning from V11/V12 is **not yet ported**.
- **Edgar graph + room/door patterns** — named semantic anchors, portals, physical aperture width, corridor graph. Do not treat a connected mask as a valid functional route.
- **WallPlan (2022)** — shared wall geometry is materialized once from floor regions; an exposed room wall is the hull, not two walls with a gap. Current compiler rejects rather than repairs configurations that require illegal wall slabs.
- **V13 access planner** — independent public circulation and mid-span no-jog rule are adapted into the new report and route validator. V13's complete A* routing / bay-entrance optimizer is **not yet reused**.
- **V2 hull-integrity audit** — recovered directly from the patch, applied to the exact generated template without modifying it.

## Phase gate status — deliberately not declaring success

| Agreed stage | Status | Evidence / blocker |
|---|---|---|
| Phase 0: baseline | **Partial pass** | 12 repeatable multi-kind seeds, content/modules and output hashes; broader seed/perf/art fixtures still needed |
| Phase 1: shared region / wall contract | **Foundational pass, end-to-end gate FAIL** | Nine passing compiler/adapter tests, typecheck. Actual station construction still writes via `Builder` rather than compiling `StationArchitecturePlan` |
| Phase 2: unified circular mass + route planner | **Not started** | Original circular mass algorithm and V12/V13 department planner not yet combined into shared plan |
| Phase 3: room fitting with semantic entrances | **Not started** | Source room mapping remains disconnected from geometry; existing furnishing continues unchanged |
| Phase 4: legal construction from the plan | **Not started** | Compiler tested on fixtures, not a whole program-complete wheel; most baseline stations fail V2 check |
| Phase 5: bidirectional structural repair | **Not started** | There is no structural reshape pass reacting to fit, access or boundary failures |
| Phase 6: architectural diversity | **Not started** | No claim of better silhouettes, varied layouts, or playable quality |

## Critical next integration work, not optional changes

1. **Translate the native `Builder` planning operations into `StationArchitecturePlan` operations rather than importing it after completion.** Establish stable room/bay IDs through `planStation`, `stationRings`, and fit-out; preserve all modules and program slots. Until this is done, the canonical plan cannot prevent native invalid layouts.
2. **Port V12 multi-bay department planning and V13 entrance routing onto these same region/portal IDs**, without accepting V12's scattered rectangles as the visual grammar. Department mass geometry must be formed by the original inhabited-wheel operations (variable-depth arcs, enlarged industrial hall insertions), not by V17's fixed pie wedges.
3. **Use the plan's derived wall grid as the physical template** before furnishing; reject impossible corners and force structural geometry replanning, not cosmetic wall patches.
4. Make end-to-end *exact* station requirements, legal rooms/doors, independent access, interior wall/hull correctness, functionality, and visual circularity simultaneous acceptance requirements; run V2 and V13 validators and game sim tests on the same seed, never separately.
5. Generate full-resolution same-program same-seed comparison sheets only once all those tests work. A technical-only fixture passing is not a quality improvement.

No code is pushed to GitHub by this delivery. Running the CLI in the project's actual environment requires its normal dependencies (`npm install` / installed Vite). This archive's offline validation used a TypeScript transpilation shim; the full app's Vitest, Svelte and CI suites were unavailable in this sandbox.
