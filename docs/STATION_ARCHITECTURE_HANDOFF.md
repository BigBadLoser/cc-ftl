# cc-ftl Station Generation — Architecture Integration Handoff for Claude

**Status:** experimental integration through Checkpoint 4; **not architecturally accepted**.  
**Repository:** `BigBadLoser/cc-ftl`  
**Working branch:** `stationgen/architecture-integration` (branched from `stationgen/staged`, commit `1e8b1462bded4cfc38ca717d6059d95548febd5a`)  
**Existing staged generator:** `stationgen/staged`, underlying station rework PR [#234](https://github.com/BigBadLoser/cc-ftl/pull/234), follow-up issue [#254](https://github.com/BigBadLoser/cc-ftl/issues/254).  
**Date:** 2026-11-11.  
**Audience:** Claude Code or another implementation agent resuming this branch.  

> **Read this first:** Do **not** continue incrementally tuning the current angular sector generator. The critical unfinished deliverable is to replace angular *placement* of departments with a genuine connected architectural bay/topology planner, while retaining circular inhabited masses, native furnishings and strong validation. The new `programBay` mode in this branch is a useful intermediate, not the goal.

## 0. Immediate assignment

Your task is to turn the recovered architectural components into **one coherent native TypeScript station generation pipeline**. Produce a genuinely circular *inhabited* station, with integrated large rectangular freight/machinery spaces, named connected circulation, real room dimensions and access, one-tile shared walls, a continuous airtight hull, required equipment, and existing native furnishing. The same constructed station must pass every criterion. Maintain a matched comparison against the original staged generator.

The user's key requirements, established repeatedly:

- **Circular/wheel-like silhouette must be recognizable**, without relying on department colors. The original staged generator was often more visually compelling than V11–V17; don't abandon its inhabited perimeter geometry.
- **Room walls at the exterior are the hull.** Never insert an arbitrary 1-tile empty strip or second wall between a perimeter room and the exterior hull.
- Major industrial rooms are genuinely rectangular with clearances, and should **shape the architecture** rather than be shoved into thin radial wedges. Small cabins and service rooms can be tapered if their functional cores are legal.
- **No scattered buildings**, disconnected spokes, visually meaningless pie sectors, giant empty courts, or overly inflated residential rooms.
- Exactly **1-tile-thick walls**, airtight continuous hull, **no open diagonal cracks**. No illegal solid 2×2 wall slabs.
- Traffic hierarchy: ~2-wide main ring, 3-wide busiest docking/market concourses, 1-wide local passages where appropriate; no sudden mid-span 1-tile jogs.
- Every department connects independently to suitable shared circulation; **do not route through another department**. Internal cabin access can be via an internal gallery. Respect restricted/service access.
- Required room/module program is non-negotiable. Preserve existing furnishing, role swaps, airlocks/docks and crew navigation; all real rooms need legal accessible entrances.
- Structural variation must be architectural (different bay masses, partial inner rings, court/core organization, dock arrangements), not rotations or recolorings.
- Use **`tools/shipgen/labels.ts`** (full resolution) and existing structure/silhouette views for comparisons, not a new simplified renderer.

## 1. How we got here — useful lessons from 17 experiments

This history matters because many seemingly natural approaches have been tried and rejected:

| Work | Useful surviving asset | Architectural failure / caution |
|---|---|---|
| Original staged generator (`stationgen/staged`) | Real circular inhabited rooms, departments, dock banks, court/spoke geometry, native room designs, furnishing and role swaps | `stationBands.ts`/`bandArcs()` splits annulus circumference into individual rooms, stretched awkward rooms, permitted indirect access, repetition, imperfect walls |
| V1–V4 | Graph/hull/circulation experiments; shared boundary sealing | Generic ring/corridor schemes or unrealistic envelope rules |
| V5–V7 | Exact rectangular fitting, curved envelope/packing feedback | Often left an empty circle of disconnected rectangles; quality suffered |
| V8–V10 | Corridor hierarchy, demand-driven links, bounded complete-layout search and repair | Didn't escape chosen ring-first geometry |
| V11–V12 | Department requirements and dimensioned multi-bay planning | Scattered rectangular departments, insufficient circular mass, inefficient coverage |
| V13 | Independent department access, security and route-quality checks | Correct validation but dungeon-like physical organization; access checks rejected 3/12 older plans |
| V14 | Visually improved circular sector grammar | Repetitive pie charts; 21 failed room-size checks |
| V15 | All 448 room-size footprints fit across 12 programs | Individual rectangles scattered inside a circle, only ~35% envelope occupation |
| V16 | Connected inhabited annulus and all 448 fit | Lumpy central void, spokes apparently disconnected, only ~30% actual room floor |
| V17 | Explicit spoke endpoints, cleaned court, hull checks | Kept fixed radial sector grammar, visual result barely changed |
| Manual tile layout | 37/37 real trading rooms, explicit doors, legal shared walls in that fixture | Essentially rectangular silhouette; accidentally introduced perimeter gap from dilation |
| CP1–CP2 | Shared architecture IR, V2 hull validator, source-program checks, native audit, optional wall compiler and candidate ranking | Merely auditing/ranking legacy candidates did not fix architectural assumptions |
| CP3 `neighborhood` | Native wheel path bypasses `bandArcs()`, department-level sector allocation, exact room cores and frontage; native furnishing works | Still angular neighborhoods, giant rooms (48–51% area inflation), hull failures |
| **CP4 `programBay` (this branch)** | Room-core-driven occupied footprints, narrow curved frontage, native `labels.ts` A/B/C comparisons, forced-wheel testing | **Still uses angular search/assignment windows and original ring/four-spoke topology; hull failures persist** |

**Essential conclusion:** We developed useful program, geometry, room-fitting, route/access and wall validation *parts*, but those parts have repeatedly been applied in incompatible orders and against separate representations. The correct long-term integration is a single plan whose **geometry and named topology can be revised when capacity, access, walls, or furnishing fail**.

## 2. This branch: Checkpoints 1–4, what's actually implemented

`architectureMode` is opt-in. The older generator remains available for comparisons. Important files:

| Path | Purpose / current status |
|---|---|
| `src/sim/shipgen/stationArchitecturePlan.ts` | New `StationArchitecturePlan`: room requirements, owned regions, named routes/anchors, portals, exact rect-core checks, public/private access checks, shared-boundary wall compilation. Import existing completed station to audit. **Not yet universally authoritative during native construction.** |
| `src/sim/shipgen/stationArchitecturePlan.test.ts` | Adversarial geometry/portal/route/hull tests. |
| `src/sim/shipgen/stationHullIntegrity.ts` | Recovered V2 hull/wall check: connected external wall structure, illegal 2×2 slabs, diagonal leakage and continuity. Failures are real regressions to investigate, not scoring suggestions. |
| `src/sim/shipgen/stationStructuralIntegration.ts` | Adapter between existing native `Builder`/finished stations and architecture representation; pre-furnishing wall compiler/audits. |
| `src/sim/shipgen/stationNeighborhoods.ts` | CP3 sector neighborhoods, room-core fitter, internal corridors; CP4 `constructProgramBayFootprint()` builds actual occupied geometry from room cores, curved narrow frontage and 4-connected links. **This is the primary experimental implementation.** |
| `src/sim/shipgen/stationNeighborhoods.test.ts` | Neighborhood/packing fixtures. |
| `src/sim/shipgen/stationProgramBays.test.ts` | CP4 footprint behavior and real native forced-wheel furnishing/content/compactness checks. |
| `src/sim/shipgen/stationWheel.ts` | Opt-in path for new neighborhoods; existing `bandArcs()` is bypassed when using new mode but retained for legacy. **Underlying angular placement/ring arrangement remains.** |
| `src/sim/shipgen/stationGrammars.ts` | Routes `architectureMode` through wheel grammar selection. |
| `src/sim/shipgen/{stationGen,generate,types,navyLayouts,navyKit}.ts` | Native mode propagation, source program/integration checks and command plumbing. |
| `tools/shipgen/labels.ts` | Restored `labelResult(g: GenResult, title, t)` accepts pre-generated results. `labelView()` delegates; full original label/furniture palette and legend preserved. |
| `tools/shipgen/compareProgramBays.js` | A/B/C **forced-wheel** native comparison: `off`, `neighborhood`, `programBay`. Outputs full `labels.ts`, existing structure/silhouette, metrics, content/hull/access audits. |
| `tools/shipgen/{auditStationArchitecture,compareArchitectureModes,compareNeighborhoodWheels}.js` | Earlier baseline and comparison commands. |
| `docs/STATION_ARCHITECTURE_INTEGRATION.md` | Original CP1 integration rationale; **historical**, some claims/status superseded by this handoff. |

The source was developed against the exact contents of the archived `stationgen/staged` snapshot and its modified-file Git blob SHAs were checked against the live `stationgen/staged` branch before creating this branch.

### Current measured result — do not conflate metrics

Eight native forced-wheel comparisons, same programs/seeds under three modes: trading stations seeds 1–4; farming stations seeds 1–2; trading outposts seeds 1–2.

| Metric, eight cases combined | Legacy `off` | CP3 `neighborhood` | CP4 `programBay` |
|---|---:|---:|---:|
| Occupied floor tiles | 22,522 | 34,075 | **25,492** |
| Floor vs legacy | 1.00x | 1.51x | **1.13x** |
| 2×2 wall slabs | 138 | 79 | **76** |
| Direct public room doors (raw counts) | 398 | 390 | **393** |
| Full V2 hull checks passing | 0/8 | 0/8 | **0/8** |
| Native generated and furnished wheel cases | 8/8 | 8/8 | **8/8** |
| Explicit requested modules missing | Not tallied in this set | Not tallied | **0** |

**Interpretation:** CP4 cuts floor by ~25.2% versus CP3, but is still ~13.2% larger than legacy; 76 illegal 2×2 wall slabs remain; **none** of the eight passes hull-integrity acceptance; raw door counts do not establish department security or adequate individual access. Visual output still reads as constrained radial placement with limited structural variety.

Earlier 12 native baseline layouts: 12/12 passed legacy game checks but only 2/12 passed the recovered V2 hull test; 7/12 had rooms lacking direct public-circulation access. Experimental source-program checks also found ordinary generation could accept some candidates missing required modules.

**Test status:** 17/17 focused tests passed in an offline TypeScript transpilation/test shim, and a targeted strict `tsc` check passed for changed generator modules. Original rendering worked in that harness. **Not yet run:** full project Vitest, Svelte typecheck, real app build, in-game crew-path tests and CI. Do not claim the focused tests establish a playable or legally constructed station. A standalone strict typecheck including `tools/shipgen/views.ts` encountered an existing optional-debug-data type error unrelated to the modifications.

## 3. Research map — what it says, what we have, what we still need

These are engineering inspirations, not guarantees and not implementations to drop in unchanged.

1. **Merrell, Schkufza & Koltun (2010), _Computer-Generated Residential Building Layouts_.** Paper: https://vladlen.info/publications/computer-generated-residential-building-layouts/ . High-level room program/adjacency -> layout optimization -> actual 3D/physical construction. **We have** source program and constructed native templates. **Missing:** a program/topology/geometry loop that revises architectural mass rather than trying to fit inside a predetermined ring.
2. **Lopes et al. (2010), _A Constrained Growth Method for Procedural Floor Plan Generation_.** Paper: https://www.eurosis.org/cms/files/proceedings_full/GAMEON2010.deel1_2.11.10.rdo.pdf . Connected room/region growth with topology, reachability, consistency constraints. **We have** legacy room growth and CP4 core-driven footprint construction. **Missing:** legally constrained growth governed by actual public/private frontage, shared walls, and whole-plan capacity.
3. **G2PLAN (2022), _Transforming an Adjacency Graph into Dimensioned Floorplan Layouts_.** DOI: https://doi.org/10.1111/CGF.14451 . Feasible geometry from adjacency/topology *and* dimensions. **We have** actual rectangular core constraints and an earlier V12 department/bay graph prototype. **Missing:** simultaneous solution of department-bay adjacency/size/portals, especially when one bay is curved/irregular. The paper does **not** solve curved spaceship hulls for us.
4. **Edgar (open-source procedural room graph / templates).** Docs: https://ondrejnepozitek.github.io/Edgar-Unity/docs/basics/room-templates/ . Room outline and door templates realize intended topology; named door possibilities matter. **We have** named routes/portals in the plan. **Missing:** those semantic links controlling actual geometry and valid door locations throughout generation. Use departmental rather than arbitrary dungeon graph semantics.
5. **WallPlan (2022), _Synthesizing Floorplans by Learning to Generate Wall Graphs_.** DOI: https://doi.org/10.1145/3528223.3530135 . Explicit wall-graph representation is a useful conceptual model for shared boundaries. **We have** a testable boundary compiler. **Missing:** eliminating contradictory wall stamps by making the same compiler authoritative over the entire finished station, including exterior hull and post-furnishing changes.
6. **Quality-diversity methods:** preserve multiple valid structural types, not just the highest score of a single ring variant. Useful **after** legality; do not apply novelty scoring to invalid, inaccessible stations. We need meaningful descriptors: partial-ring extent, public-route graph cycles, central occupation, dock topology, location/count of major rectangular industrial masses, inhabited perimeter, and distribution of depths.

**Why this combination should outperform previous experiments:** The same region graph, dimensions, access requirements and shared boundaries will determine bay construction, furnishing input and final construction. Failure can cause a *specific structural edit* (resize bay, reposition a public entrance, merge neighborhoods, introduce gallery, adjust the hull) rather than silent clipping, expanding rooms into leftover area, choosing an unrelated grammar, or adding a second hull. The evidence so far is promising on integration and compactness but does not yet prove visual or legal success.

## 4. Proposed canonical architecture / invariants

Treat `StationArchitecturePlan` as the **only mutable source of spatial truth before raster output**. Avoid parallel masks invented by the ring planner, corridor placer and hull constructor that disagree on ownership.

**Suggested concepts** (adapt the actual interfaces; do not necessarily introduce new types if existing ones suffice):

- `RoomRequirement`: role, department, must-place modules, min rectangular core, allowed irregular fringe, orientation, public/restricted access, required door width/clearance.
- `DepartmentBay`: stable ID, requirement IDs, connected occupied tile region or polygon, minimum/maximum useful area, frontage portal candidates, allowed exterior/hull edges, structural mass kind (`curved-inhabited`, `rectangular-hall`, `core`, `service`).
- `CirculationGraph`: distinct nodes for ring junctions, dock links, galleries, court, service/security locks; named edges with width, endpoint, space rights and continuous cardinal tiles.
- `BoundaryGraph`: shared edges of one-tile wall tiles, owner pairs, legal door aperture positions; exterior boundary derived directly from occupied footprint. One wall belongs to two adjacent regions and may *be* the hull.
- `PlanDiagnostics`: precise failure class, relevant bay/room/portal/boundary coordinates, proposed repair scope, repro seed and source program.

Core invariants: real usable room cores, no two owner regions overlap, no undocumented leftover tile expansion, all chosen public routes connect their specified endpoints, every required room legally reaches the intended network, restricted routes preserve access policy, all walls exactly one tile thick where a wall is required, no 2x2 slabs or diagonal leak, sealed continuous hull, exterior room wall shares hull. The game template and furnishing results must preserve these invariants (or trigger replan).

**Important nuance:** A corridor-network-wide connectivity pass does *not* prove every named spoke has valid endpoints. Similarly, 448/448 room footprint fit does *not* prove 448 accessible furnished rooms. Keep these checks separate and conjunctive.

## 5. Implementation roadmap — work in this order

### Step A. Baseline, reproducibility and full application tests

1. Use the branch's native command rather than the experimental Python sheets. Inspect `compareProgramBays.js` options before running.
2. Re-run CP4's eight fixed seed/program cases with the project's installed dependencies. Record layout hashes, module inventory, exact room counts, exterior frontage, corridor area, unassigned floor, error categories, and runtime. Regenerate `labels`, silhouette, structural sheets through original `labels.ts` / `views.ts`.
3. Run focused tests with normal `vitest`, then full relevant shipgen tests, `tsc` / app build and one simple crew traversal smoke test. Fix any actual portability errors from the offline harness before modifying geometry.
4. Keep a **forced `stationWheel` grammar**, explicit mode/seed/program identity in metrics, and separate failed/fallback results. The candidate selection may otherwise choose another grammar and hide the experiment.

**Gate A:** reproducible native baseline, exact known failing cases with coordinates, and unmodified default generation behavior.

### Step B. Make **bay/circulation topology authoritative** — the missing research step

1. Recover/adapt the *useful* V12 graph/capacity and V13 department-access/routing concepts. Don't copy V12's scattered rectangle compositor as architecture.
2. Before any room partitioning, create a small **department-neighborhood topology** with permitted public/service edges, dock and court links, reserved portals, and size/shape requirements.
3. Generate **connected inhabited masses**, not ring-slice allocation: variable-depth curved perimeter bands, rectangular freight/machine halls interrupting the arc, merged contiguous sectors, optional partial galleries/inner rings, and purposeful cores/courts. Their shapes should arise from room capacity *and* circulation constraints, with actual hull-facing room frontage.
4. Remove angular **department placement/assignment windows** as the controlling geometry in `stationWheel.ts` / `stationNeighborhoods.ts`. An arc may still be a useful geometric primitive, but cannot be the unit that assigns all departments around a predetermined circle.
5. Express meaningful spatial edits: move/deepen bay, insert rectangular mass, merge/split neighborhood, change ring/gallery segment, move a dock attachment, relocate a portal, or change central occupation.

**Gate B:** without room colors, 2–3 explicitly different *connected inhabited* candidate skeletons; recognizable circular silhouette and integrated rectangular masses; every major route has named, validated endpoints. No random 12-seed search as a substitute for proving the grammar's expressive power.

### Step C. Exact room partition and access feedback

1. Keep CP4 exact room cores. Fit whole industrial rooms as legal rectangles, but allow constrained irregular growth for cabins that actually fits their furnishings.
2. Prohibit automatic expansion of a room into unused bay floor. Every tile is room, wall, corridor, named court/service use, or explicit surplus triggering resize/repair.
3. Plan local department galleries, room doors, security edges and passage widths together with room fitting. Reject bays lacking individual room access; do **not** fix inaccessible cabins by deleting walls or punching holes through unrelated rooms.
4. Feed impossible core/portal/route failures back to the **bay topology/mass stage**. Bounded deterministic search or repair (V10 ideas) is appropriate, with cheap geometric pruning before expensive fit-out.

**Gate C:** every required room fits, has valid furnished clearance, and a legal path to its allowed shared circulation; all department access/security restrictions hold. Unassigned floor is measured and structurally justified; occupied floor no longer inflates merely to satisfy arbitrary search sectors.

### Step D. Make boundary compiler the only physical wall writer

1. Unify hull, room, gallery and dock boundaries into one owned-edge compilation. Investigate why 76 CP4 2x2 slabs survive despite a tested `StationArchitecturePlan` boundary compiler: likely mixed builder wall stamps / T-junction treatment / postcompilation changes. Prove the actual cause from coordinates before changing a rule.
2. Generate tile-boundary geometry that fits on this game's grid: continuous exterior with diagonal sealing and no 2x2 solids or two-thick walls, room against hull without a perimeter gap.
3. Convert the plan to the **same native template** and run furnishing and module placement. Postprocessing that modifies doors/walls must revalidate constraints or return a structural repair request.

**Gate D:** one complete same-seed, truly circular, furnished and navigable wheel passes room/program/access/secure-boundary/hull/one-tile-wall checks. Visual approval is still independent.

### Step E. Broader validation and structural diversity

After Gate D passes: generate 12–24 seeds for trading station, then farming/mining/hubs/outposts. Track valid rate, p50/p95 generation time, fallback rate, total room/corridor/wall/void/surplus tiles, content parity and stability. Compare original `labels.ts` sheets at exactly the same scale. Introduce and quantify distinct structural topologies only after legal generation is reliable.

**Gate E:** diversity in *actual mass/topology* visible on gray silhouette/structure views, while every accepted station passes all integrated constraints. Rotations, colors and small radius changes are not enough.

## 6. What not to do / avoid repeating earlier failures

- Do **not** present a passing submodule test, 448/448 core fit, or working furnishings as architectural acceptance.
- Do **not** produce another `V18` Python reference generator instead of editing native TypeScript.
- Do **not** tune the current sector allocation score to mask its fixed angular arrangement.
- Do **not** silently reduce scope to clean center circles, adjust spokes, or fix a couple of hull tiles and claim a redesign.
- Do **not** render with a new simplified custom sheet system; `tools/shipgen/labels.ts` was explicitly restored for this.
- Do **not** accept non-wheel grammar fallbacks as evidence that new wheel construction works.
- Do **not** add blanket maintenance margins between the hull and rooms.
- Do **not** eliminate legitimate restricted-area separations to improve a naive access metric.
- Do **not** expand entire residual bay envelopes into giant residential rooms.
- **State exactly what was planned, implemented, unimplemented, and failed** in each future result.

## 7. Commands and quick start for Claude

```bash
# Branch contains experimental CP1–CP4 source and this handoff.
git fetch origin
git switch stationgen/architecture-integration

# Install project's normal dependencies if needed, then inspect compare runner:
node tools/shipgen/compareProgramBays.js station.trading --size station --from 1 --count 8 --out tools/shipgen/out/program-bays

# Focused test files; project test setup may require the standard npm/Vitest runner:
npx vitest run \
  src/sim/shipgen/stationArchitecturePlan.test.ts \
  src/sim/shipgen/stationNeighborhoods.test.ts \
  src/sim/shipgen/stationProgramBays.test.ts

# Review original visual system and key integration source:
# tools/shipgen/labels.ts, tools/shipgen/views.ts,
# src/sim/shipgen/stationWheel.ts, stationNeighborhoods.ts,
# stationArchitecturePlan.ts, stationStructuralIntegration.ts,
# stationHullIntegrity.ts
```

The `README` and scripts from CP4 may still reference offline test harnesses or archived ZIPs; treat the actual checked-out repository as source of truth. Inspect package scripts and adapt commands to this checkout. `architectureMode='off' | 'neighborhood' | 'programBay'` is an experimental mode switch; do not assume these are production-safe defaults.

## 8. Questions Claude should answer before starting a large rewrite

1. What exact native operations write the 76 surviving CP4 illegal 2x2 wall slabs? Are they generated by room adjacency T-junctions, hull outline materialization, dock logic or furnishing/repair?
2. Where are angular neighborhoods assigned? Which parts are reusable curved rasterization versus structural **decision logic** to replace?
3. Which existing `StationArchitecturePlan` interfaces can be made authoritative without duplicating Builder's floor/wall ownership?
4. What is the *minimal* explicit department topology for a trading wheel that can represent curved inhabited mass plus rectangular warehouses and a valid public/service circulation graph?
5. How will failures move back up the hierarchy with reproducible causes? What is the bounded deterministic search budget?
6. How will we separate intended courts and maintenance/service access from genuinely unassigned wasted floor?

## 9. Required reporting format for the next milestone

For **each** delivered checkpoint include: original agreed objective; actual TypeScript files/functions changed; what concepts came from prior code/research; one same-seed **original-renderer** legacy vs new comparison; complete content/door/security/wall/hull results on the exact same generated station; floor allocation and runtime; tests actually run in the real repo; explicit deviations and blockers. If the new layout is ugly, too rectangular, disconnected or invalid, call it a failed architectural gate regardless of other improvements.

**First high-value outcome:** one compact, visually compelling and legitimately circular furnished station whose architectural bay graph was formed from the real room program and named circulation, and which passes V2 hull checks and actual room access. Only then broaden seed diversity or add more families.
