# cc-ftl Station Architecture Integration — Checkpoint 4

**Result: partial implementation; architecture acceptance FAILED.** Native TypeScript source based on the archived `cc-ftl-stationgen-staged.zip`; no live GitHub changes. Cumulative and incremental patch files both checked against their source baselines.

## Agreed plan versus observed work

| Agreed stage | Delivered | Status |
|---|---|---|
| Restore original `labels.ts` renderer | Exported `labelResult(g: GenResult, title, t)`; existing `labelView()` now delegates to it; `compareProgramBays.js` uses it for all modes. Generated full-resolution room/furniture/legend sheets. | **Complete** |
| Replace fixed angular neighborhood envelopes with program-sized structural bays | Implemented `constructProgramBayFootprint()`: builds occupied geometry from exact room cores + compact apron + 4-connected links to a narrow curved public frontage. Search-window floor is not automatically made into room floor. Wired behind `programBay`. | **Partial**: angular search windows still allocate bay positions; a true free structural-bay topology grammar is not implemented. |
| Joint room capacity and circulation | Reused native exact core packer, optional local gallery, source-program preservation checks; footprint now physically follows fitted cores. | **Partial**: weak individual-room access, and construction topology still inherits the original four-spoke ring. |
| Legal shared walls, hull and entrance construction | Existing `StationArchitecturePlan` compiler and V2 hull validator run; structural bay footprints enter the native construction/furnishing path. | **Failed acceptance**: all 8 generated wheels fail one-tile hull integrity. |
| Full native generation on a forced wheel | Forced `stationWheel` in each comparison; 8/8 genuine `programBays` profiles, 0 native errors, 0 missing source modules. | **Complete as experimental integration**, not complete legal/playable acceptance. |
| More seeds and structural diversity | Compared trading station seeds 1–4, farming station seeds 1–2, trading outpost seeds 1–2. | **Not completed**: additional programs, 12–24+ seeds and true topology diversity outstanding. |

## Eight-case A/B/C comparison

All cases have the exact same seed, program, tier and forced wheel grammar. `off` is legacy, `neighborhood` is Checkpoint 3's filled-sector approach, and `programBay` is the new footprint construction. All screenshots below were produced by the **original `labels.ts` and `views.ts`** on actual native, furnished station results.

| Metric (8 forced-wheel cases) | Legacy | CP3 sectors | Program bays |
|---|---:|---:|---:|
| Total occupied floor | 22,522 | 34,075 | **25,492** |
| Ratio to legacy | 1.00× | 1.51× | **1.13×** |
| 2×2 wall slabs | 138 | 79 | **76** |
| Direct public room entrances | 398 | 390 | **393** |
| Full hull-integrity passes | 0/8 | 0/8 | **0/8** |
| Completed native wheel results | 8/8 | 8/8 | **8/8** |
| Explicit missing requested modules | Not tallied in this report | Not tallied | **0** |

The new mode reduces floor area by **25.2% vs CP3**, but remains **13.2% larger than legacy** in aggregate. These totals are *not* a fully matched quality score: room counts change due to existing grammar/furnishing decisions, and direct-public-room-door count alone does not establish department security or privacy.

### Representative original-renderer images

- `evidence/original-compare-structure.png` — same-seed legacy / sector / program-bay structure comparison.
- `evidence/original-compare-silhouette.png` — identical rendering conventions without department colors.
- `evidence/station.trading-station-1-{off,neighborhood,programBay}-labels.png` — **full-resolution** original room names and actual furniture footprints. Seed 2 also included.

The visible design remains a recognizable inhabited wheel with larger rectangular room masses and a narrowed curved occupation band; **the old radial spoke topology and angular *placement order* remain**. Some rooms remain too large, and shape diversity is insufficient for the original design brief.

## Implementation specifics

- `tools/shipgen/labels.ts`: `labelResult()` accepts an existing `GenResult` without rerunning the original default generation mode. Original `labelView()` behavior preserved.
- `tools/shipgen/compareProgramBays.js`: native Vite-loaded A/B/C runner, force-only `stationWheel` grammar, failed/mismatched mode flagged; outputs original sheets, metrics and content/hull/access audits.
- `src/sim/shipgen/stationNeighborhoods.ts`: `constructProgramBayFootprint` constructs connected bay geometry from exact rectangular cores, a shared curving frontage, and shortest links. It does not fill the entire angular search window. Legacy `sector` path retained unchanged.
- `src/sim/shipgen/{stationWheel,stationGrammars,stationGen,navyLayouts,navyKit}.ts`: opt-in `architectureMode='programBay'` wired through native generator/arranger/grammar; default remains unchanged.
- `src/sim/shipgen/stationProgramBays.test.ts`: synthetic bay-construction fixture with legal core retention and connectedness, plus full native fixed-wheel furnishing/program/compactness test.

## Test and source evidence

- **17/17** focused tests pass with offline TypeScript transpiler/test shim (15 prior tests + 2 new).
- Strict targeted TypeScript check of changed generator components passes:
  `tsc --noEmit --strict --skipLibCheck --module esnext --moduleResolution bundler --target es2022 --lib es2022,dom src/sim/shipgen/stationNeighborhoods.ts src/sim/shipgen/stationWheel.ts src/sim/shipgen/stationGen.ts`
- Including `tools/shipgen/labels.ts` in a standalone strict compile encounters an **existing** `tools/shipgen/views.ts(72,31)` error around optional debug data; this view file was not changed. Rendering was executed successfully in the offline harness.
- Native A/B/C generation and original sheets were executed in the offline JS/TS harness; application-wide Vitest, Svelte typecheck, renderer/game integration, and crew path simulation have not been run.
- `cumulative-from-original.patch` was generated against archived original files and validated by `git apply --check`, applied in a fresh test repository and byte-verified against the edited source. `incremental-from-checkpoint3.patch` also passed `git apply --check`.

## Deviation register (explicit, as requested)

1. **Structural grammar scope reduced (major).** The original plan called for eliminating angular department envelopes and constructing a true topologically flexible structural-bay grammar. I implemented program-led **built footprints** within existing angular *search/assignment windows*. The stations' occupied mass now responds to room geometry, but placement order still derives from the old system. The architectural grammar remains unfinished.
2. **Circulation and security not solved.** I retained the existing ring/four-spoke skeleton and basic optional local galleries. I did not complete the joint V13 access-routing integration or ensure direct independent access for all intended private rooms.
3. **Hull/physical construction gate not met.** Native output still contains 2×2 wall slabs and fails the V2 hull check in all eight pilot samples. I did not silently remove walls or claim the station to be legally constructed.
4. **Only a pilot evaluation.** Eight forced-wheel cases rather than the planned full program diversity, substantial random-seed testing and a gameplay navigation run.
5. **Original renderer retained, but offline comparison harness differs.** I restored the canonical TypeScript labels/structure/silhouette renderer and supplied an in-repo Vite comparison CLI. For execution here I used a CJS TypeScript loader, since the captured source has no project `node_modules`; no Python-based *station rendering* was used.

## Research correspondence

| Approach | Implemented principle | Remaining gap |
|---|---|---|
| Merrell et al., program-to-geometry optimization | Room requirements now affect final structural-bay mass rather than just inhabiting a fixed empty sector | No bidirectional replanning of bay topology after geometry/access failure |
| GPLAN / G2PLAN dimensional floorplanning | Exact-size rectangular room cores are constrained before bay floor exists | Public adjacency/dimensions still not jointly solved in one feasibility search |
| Lopes et al., constrained region growth | Narrow, connected envelope growth from fitted cores with curved frontage | Does not yet model purposeful irregular rooms with clearance, privacy and route constraints together |
| Edgar graph/room arrangement | Named native ring and room connections persist across construction | Ring topology is inherited; no alternate coherent circulation graphs |
| WallPlan shared physical walls | `StationArchitecturePlan` already owns region boundaries and emits one wall layer for the new rooms | Other native builder stamps can still create double-thick intersections; full hull legality fails |

**Next necessary engineering problem is not additional score tuning.** An explicit layout-level structural graph must choose connected bay masses, entrances, and circulation simultaneously, rather than allowing angular allocation windows to dictate their organization. Its construction compiler then needs to resolve remaining illegal boundary intersections before furnishing. The current implementation is a useful source integration and compactness correction, not the completed version of that plan.
