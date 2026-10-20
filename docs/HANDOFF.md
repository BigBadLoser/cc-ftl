# Handoff (2026-10-19)

This is where things stood when work moved from one long cloud session into a Claude Code Project. Read it after `CLAUDE.md`,
then `docs/STATUS.md`. Standing rules are in `CLAUDE.md` and `docs/handoff/project-instructions.md`; lasting design
decisions are in `docs/handoff/project-memory.md`, `docs/DESIGN.md` and `docs/ARCHITECTURE.md`.

## Terminology (user decision; older code and docs still say "sector" for a node)

- **Node:** one playable grid, a location with fixed structures (asteroids, stations, old derelicts).
- **Sector:** a group of nodes.
- **Hyperlanes:** the links between sectors.

The refactor's `SectorGrid` is really the node grid. It gets renamed after render step 5 lands (see Open work).

## On `main` (deploys to https://cc-ftl.bigbadloser.workers.dev)

- **M5:**
  - shuttle bay (4x5 pit) and the shuttle with flight art;
  - side docking with the extending 4-ring tube;
  - docking airlock (3x4 plus collar, unloaders, keep-out);
  - EVA and spacesuits (suits stocked at airlocks and shuttles, hull ring, EVA from a hovering shuttle);
  - robots and robot bays, capture and prizes;
  - the three military weapons;
  - the event system (11 starter events);
  - crew needs (hunger, galley, rations, mood);
  - the Fire volley hint.
- **Ship generator** (`src/sim/shipgen`): assembly-driven navy, drones, civilians and scrappers (v27), the real beam/truss art,
  and a connectivity rule. Generated enemies only appear with `?shipgen=1|navy|drones|civilian|scrapper`.
- **Sector-grid refactor:**
  - steps 1–4: `SectorGrid` chunks, windows, the field systems per region, the owner layer, the gap rule;
  - step 8: vehicles as `BodyC`.

  The plan is in `docs/ARCHITECTURE.md`, "Sector grid (planned)". There are no save migrations: bump `SAVE_VERSION`.

## Branches waiting on the user (pushed, not merged)

| Branch | What | State |
|---|---|---|
| `trade` | Credits, prices, hailing ships in the node, trade window, shuttle-delivered deals, barter | Done, checks green. Ready to merge once approved. Station trade is an instant TEMPORARY fallback. |
| `starmap` | M6 endless chunked galaxy (sectors, nodes, hyperlanes), route planning, fuel and FTL charge, sensors, arrivals, 7 factions, standings, starmap view | Done, checks green. Open question: add a density-field pass (clusters, voids, chokepoints, varied sector sizes)? The large scale is too uniform. |
| `sector-5` | Render step 5: one shared world layer, combat panel as a second camera, picking in sector coordinates, visibility rule, low-body depth | Committed. Was finishing its before/after screenshot comparison when the session ended. Re-run it (`scratchpad` scripts are gone) and get approval. |
| `crew-pipeline` | Crew sprites: per-clip sheets, fixed frame size, render cache and incremental builds | Was in progress. Check whether it got pushed. If not, restart from its brief (below). |

These touch shared files (the top bar, `api.ts`, content). Merge them one at a time, running `npm run check` after each.

## Open work, in rough order

1. **Merge the branches above** once the user approves (visual work needs screenshot approval, default and zoomed).
2. **Rename "sector" to "node"** in code and docs (`SectorGrid` → `NodeGrid`, and so on), after `sector-5` lands.
3. **Sector refactor:**
   - 5b: chunk tile views;
   - 6: the coordinate flip (Opus);
   - 7: `gridId` removal;
   - 9: packets and jump, which wire the starmap's `enterNode` hook to really swap node grids, plus the deploy modal;
   - 10: performance.
4. **UI framework pass.** A desktop-first layout mockup was approved in direction: a top bar, a crew roster on the left, one context
   panel at the bottom, one right drawer, an action bar, alert toasts, shared styling. Do it after the trade and starmap merges.
5. **Derelicts** (the rest of M5): wrecks to board and loot, alien-infested wrecks with creature AI, rogue AI shipyards, and the decay pass.
   Art for these is in progress in the art thread.
6. **Shuttle livery** per faction: a Blender mask pass on the shuttle sprites, then the existing livery shader in `shuttleView`.
   Do it after `sector-5`.
7. **Faction structure variants**, wired into `src/render/tiles.ts` chains once the art (`docs/art-prompts/structure_variants.md`) lands.
8. **Small items:**
   - crew on the hull ring look like they stand on air; fix it with walkable beams after the flip;
   - trade not done: restock, regional prices, NPC-to-NPC trade, auto-pilot assignment, some item icons.
9. Teleporters and prisoners are **dropped**.

## Art pipeline state

- **Prompts:** in `docs/art-prompts/`. Paste `common.md` above each one. Older ones are in `archive/`.
- **Done and on main:** airlock, weapons, trusses, robots and robot bays, shuttle, bay, spacesuit.
- **In flight in the user's art thread:** derelict, alien, and the galley/rations/mess table (held until `crew-pipeline` lands,
  so eating animations are cheap).
- **Next:** `structure_variants.md`.
- Hand-weapon effects and crew status marks stay drawn in code (user decision).

## Crew pipeline brief (only if `crew-pipeline` needs a restart)

- Per-clip sheets per item, so a new clip only renders that clip.
- A fixed frame size and anchor, replacing `union_box`.
- A render cache keyed by item, clip, direction, frame and an input hash, with incremental builds and single item or clip targets.
- Pixel-identical against the current sheets apart from padding.
- Runtime loader updated.

Rendering rigid gear once and attaching it at runtime is a later idea.

## Reference repos

`bigbadloser/space-web-game` is the user's earlier project. Use it for **design reference only; never port code from it.** Its
starmap generation ideas informed `starmap`.
