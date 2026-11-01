# Station generator: staged refactor of #234 (plan)

Issue #254. Status: approved plan (user, 2026-11-01), wheel first. This replaces the earlier v2 proposal. The "core and
band" v2 prototype is parked on branch `stationgen2/proto` (see "What v2 taught us"). The current generator is described in
[STATIONGEN.md](STATIONGEN.md) and its research in [LAYOUT_RESEARCH.md](LAYOUT_RESEARCH.md).

## Decision

We evolve PR #234's generator (branch `shipgen-stations-1`, the best generator we have) into a staged pipeline,
replacing its weakest algorithms one at a time. We don't write another independent rewrite. #234 is both the parts
bin and the visual baseline. Every step is compared with the step before it, and a step that makes layouts worse is
reverted or redesigned, never compensated for with repair passes.

Work branch: `stationgen/staged` (#234 head + the station bench). Each step here becomes its own PR. The room-level
extractions E1 to E3 (#257–#259) were closed by the user (the ship results looked worse); #234's own room code stays on
this branch, and room-level changes for ships are revisited separately if needed.

## Target stages

facility requirements → structure ⇄ department placement → room subdivision → furnishing → validation and selection

- **Facility requirements:** what the station must hold (rooms at target size with min/max, modules, crew, power,
  docks, the market's shop count *from the plan*, not "as many as fit").
- **Structure ⇄ department placement:** the two influence each other; this is not a structure-first pipeline.
  Departments are packed rooms-first into blocks, which gives the space they need. Candidate skeletons (a ring plus
  straight streets) constrain where blocks can fit, and the ring's size follows from the blocks placed along its streets
  and on its band. Search over (skeleton, block assignment) pairs, not skeleton then blocks.
- **Room subdivision:** split strips along straight runs into rooms of planned width (split grammars), blocks into
  rectangles (treemap or packer), and ring-band strips of fixed depth. Rooms never stretch to fill: surplus becomes bare
  ring or deliberate open space with clean edges.
- **Furnishing:** #234's fit-out (room plans, designs) as it stands on this branch.
- **Validation and selection:** functional checks (reachability, module use, power, docks, station rules, through-routes
  only on circulation, controlled departments' single entrance), structural metrics (the bench) and candidate selection.

Stage boundaries are designed around this architecture. Where #234's code interleaves stages, it is not wrapped in
interfaces for their own sake: a boundary is introduced only where it actually separates responsibilities, and only as
the step that needs it.

## Replacement order (wheel first)

Each step: labelled sheets of seeds 1–24 before and after (`cli.js --views labels`), with matching facility
requirements, plus the bench (functional checks and structural metrics). The step stays only if it is better on the
sheets.

1. **Stage boundaries that matter, behaviour preserved.** Separate facility requirements and department placement
   from the wheel's structure code where it is cheap. Pin the wheel's output for seeds 1–24 so moved code is provably
   unchanged.
2. **Department placement before rooms; delete role swapping.** Departments are assigned to sections/streets together
   with the skeleton, then rooms are placed within them. `swapRoles` goes.
3. **No stretched rooms.** Ring-band rooms come in strips of fixed depth at planned widths, not arc shares. The ring
   size follows from contents, and surplus becomes bare ring or open space.
4. **No rim placement.** Machine rooms and holds sit only as blocks along straight streets. `fitAlong` rim placement,
   `sweep` and the final rim pass go.
5. **Harbour route.** Customs is a passage at the dock chokepoint, with the armoury and office beside it, never on the
   route. Checked by an analysis pass: no airlock-to-public shortest path through a room.
6. **Variation, only after 1–5:** symmetry number (2 or 4 quarter-turn copies of one designed section), quality
   diversity (best candidate per niche), then the concentric layout.

Round layouts only. The other station layouts keep their current path until the round ones are proven.

## What v2 taught us (kept, dropped)

- **Dropped:** filling the whole disc ("every tile inside the hull is owned") was the root cause of v2's stretched
  cabins, corridor pools and oversized core. The surplus has to land somewhere. A round silhouette comes from the ring,
  and open space inside it, framed by ring and streets, reads as intentional.
- **Kept from v2:** the department program, the footprint and cohesion stats, the harbour test, the department block
  packer (`station2/core.ts coreBlock`), the wall and door emitter, the bench.
- **Kept from the research we under-used:** "big room disease" (rooms as large as their job, no larger), the
  Subveillance depth cap, SS13's hallway hierarchy (3 / 2 / 1–2 wide, departments with a front door and a back door to a
  service loop), split grammars on straight runs, Edgar-style department chains, Palmanova/Torus sections, rotational
  symmetry, MAP-Elites niches, Brogue's analysis pass for set pieces.
- **Stair-stepped round walls** are a rendering matter (dual grid or 45° wall pieces in the art pipeline), not
  something the generator should fight with room shapes.
