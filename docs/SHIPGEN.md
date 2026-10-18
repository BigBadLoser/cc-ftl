# Ship generation v3: assembly-driven (proposal)

Status: proposal for review; nothing here is implemented yet. v2 (structure → rooms) is on `shipgen` and stays the
baseline until v3 replaces it.

## Why

v1 and v2 are corridor-first: draw halls, then hang rooms off them. v3 starts from **what the ship must do**: it
builds functional assemblies first, arranges them by physical constraints, joins them structurally, and only then
derives where people (or robots) walk. Corridors are an outcome, not the skeleton.

## Pipeline

```
 FactionDef ─┐
 seed, depth ┴─► 1 BRIEF        doctrine, ship role, size class, budget            (plan.ts, extended)
                 2 ASSEMBLIES   propulsion, power, weapons, command/processing,    (new: assembly library + makers)
                                cargo, hangar, habitat; each a tile shell + modules + ports
                 3 ARRANGE      place assemblies by relations and constraints       (new: arranger + strategies)
                                (engines at +x, guns on the hull, power near loads,
                                command protected, mirror for doctrines that do)
                 4 STRUCTURE    joins between assemblies: graft (shared wall), beam (new: structure graph)
                                (solid strut, not walkable), frame (shared hull skin);
                                hull skin = walls around everything occupied
                 5 TRAVERSAL    walkable network derived afterwards: every access   (new: router; reuses Layout BFS)
                                tile, chair and airlock reachable; halls, crawlways,
                                doors; boarders' targets (bridge/core) reachable
                 6 FIT + CHECK  existing placer fills each assembly's planned       (fit.ts, layout.ts, validate.ts)
                                modules; lights; validation; METRICS gate; reseed
                 7 OUTPUT       ShipTemplate (rows + modules), GenResult with the   (generate.ts, unchanged contract)
                                assembly/structure/traversal graphs for the viewer
```

## Data model (all in `src/sim/shipgen`, plain data)

- **Assembly**: `{ id, kind, cells, modules, ports, needs }`
  - `kind`: propulsion | power | weapons | command | processing | cargo | hangar | habitat | fragment.
  - `cells`: a local tile mask of `floor`, `wall`, `machine` (solid, module-only) and `void`. Machine cells let drone
    assemblies be dense blocks of modules with no room around them.
  - `modules`: the planned module ids, plus fixed positions for hand-made assemblies.
  - `ports`: edge points with a type. `access` must join the traversal network, `struct` can take a graft or beam,
    and `util` is a power/data link.
  - `needs`: constraints such as `faceE` (engines), `hull` (guns), `protected` (command), `near: power`, `mirrorPair`.
- **Arrangement**: assemblies with an offset and an optional mirror. Mirroring flips the shell and re-runs the placer
  inside it, because module art is rot-0 only and can't be mirrored.
- **Structure graph**: assemblies are nodes. Edges are `graft` (shared wall, adjacent shells), `beam` (a solid
  1–2-tile strut, never floor) or `frame` (a navy section absorbed into one continuous hull). The hull skin is
  derived from the union.
- **Traversal graph**: derived, never drawn first. Nodes are access ports, airlocks and doors. Edges are `hall`
  (≥2 wide, navy and civil), `passage` (1 wide) or `crawl` (1 wide, drone maintenance, only where a port needs
  one). The router uses shortest paths over free cells, so not every structural link is walkable.
- **Utility graph**: power/data links between ports. The sim has one power network per ship, so today it is used only
  for arrangement scoring ("power near loads") and later for pipe/conduit art. It has no sim effect yet.

## What survives, what goes

| Kept as is | Kept, changed | Replaced or demoted |
|---|---|---|
| `Layout`, `fit.ts` (placer, fitError, connectivity, lights) | `plan.ts` → the **brief** (budget → assembly list) | `topoNavy` / `topoDrone` / `topoSalvage` become **arrangement strategies** (spine, ring, hub, rails…) that the arranger may pick; none dictates every ship |
| `validate.ts`, the sim's layout tests, determinism | `Builder` → low-level stamping for shells, beams and router output | `strip()`, the corridor-first room attaching |
| `Canvas` stamp/crop, `ShipTemplate` output, `debug.spawnGenerated`, saved origin | `FactionDef.architecture` → `doctrine` (assembly policies, see below) | the v2 `ShipRoleDef.archetypes` weighting (roles pick strategies instead) |
| viewer (CLI sheets, phone page), noses as hand-made command assemblies | `GenResult` gains the graphs and metrics | |

There is one system: every faction runs the same seven stages, and factions differ only in their data.

## Faction construction philosophy → pipeline

- **Navy (standardised engineering):**
  - Brief: a **hull family** (corvette, frigate, cruiser, carrier) from role and size. Each family has proportions and
    a set of standard section types.
  - Assemblies: standard sections in fixed sizes: drive section (2–3 engines in one frame), reactor section,
    battery sections (paired guns), command section (the kept noses), hangar section.
  - Arrange: sections in a mirrored order the family sets (for example a cruiser: nose · battery · core · battery ·
    reactor · drive). Section widths set the hull outline: a carrier is wide in the middle, a corvette narrow.
  - Structure: `frame`, one continuous hull.
  - Traversal: a main hall plus loops the family adds.
- **Drones (machinery first):**
  - Assemblies: dense `machine` blocks (weapon clusters, reactor banks, a processing core plus PD), repeated modules
    in groups of 2–4.
  - Arrange: by utility. Processing sits central, power next to its loads, mounts outward, drive at +x. Mirrored
    only when the mounts balance.
  - Structure: mostly `beam` struts and exposed frames.
  - Traversal: `crawl` only, from one airlock to every access port and the core. There are no rooms beyond what a
    module footprint and access need.
- **Scrappers (literal salvage):**
  - Assemblies: **fragments**, which are real cut-outs:
    - run the navy, drone or civilian maker for a donor ship and cut a section out at its structure graph (a drive
      section, a cargo block, a drone weapon cluster);
    - or use a few hand-made fragments (a freighter hold, an ore barge, a habitat ring).
  - Arrange: a large anchor fragment first, others grafted on at believable points (wall-to-wall, offset, sometimes
    with a short beam). Propulsion is whatever donor drive survives, plus strapped engine assemblies that face +x.
  - Traversal: each fragment keeps its own internal corridors. Grafts add short connectors only where needed.
- A **civilian** maker (freighter, barge, habitat) is added mainly as a fragment donor. It can become a neutral
  faction later.

## Metrics (diagnostics, reported per ship; used as rejection bands, not as an optimisation target)

- **compactness**: occupied cells ÷ bounding box (navy high, drones low, scrappers mid).
- **hull occupancy**: (module + machine cells) ÷ interior cells, i.e. how much of the ship is actual equipment
  (drones high).
- **corridor ratio**: traversal floor ÷ all floor (navy ≈0.25–0.35, drones low, scrappers varied).
- **narrow links**: 1-wide passages, crawls and beams per assembly (drones high, navy low).
- **aspect** and **branch count** from the structure graph.
- **silhouette diversity** over a seed batch: mean pairwise distance (1 − IoU) of the normalised hull masks. It is
  checked in tests and the viewer per faction and depth, so seeds must differ at macro scale.

Each faction defines an acceptance band per metric, and outliers are rejected and reseeded. The viewer prints the
metrics under each ship and a diversity score per sheet.

## Solid struts and art

The sim needs nothing new: a beam is `Struct.Wall` with no floor (solid, airtight, counts toward hull integrity).
The renderer is the gap:
- A **1-tile beam** has space at +y or +x, so it draws as a near-hull ghost rim. It reads as an outline, not a beam.
- A **2-tile beam** draws as a full-height far-hull wall plus a ghost rim, with roof plating on the far row. It looks
  like a tall wall, not a truss.

A **new low "strut" tile family** would fix this. It would come from the Blender walls family and autotile on the
same 4-bit mask: about 16 sprites, roughly 0.6 tiles high, open truss detail. A `Struct.Strut` kind or a grid flag
would select it. Until then, beams are 2 thick and render as wall.

## Proofs of concept (one at a time, a sheet and a report after each)

```
1 SCRAPPER: 3 salvaged sections          2 AI VESSEL: machinery first        3 NAVY CRUISER: sections → hull
  [navy drive cut-out] grafted to          [W W]   [W W]                       nose  battery core battery reactor drive
  a [civil freighter hold], a drone        [W W]═╗ ║═[PD]                       ___________________________
  [weapon cluster] beamed on top           ║    ╔╩═╩╗                      __/ B |W W|  A  |W W| R R |EE
                                      ═════║════╣CORE╠══[R R]═══[EEE]      <__ B |   |=====|   |=====|EE   ← hall + loop
     [WW]                                   ║    ╚╦═╦╝                         \_B |W W|  Q  |W W| R R |EE
      ║beam                                [S] ═╝ ║═[R R]                         ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾
 [cockpit][  hold  C C C ]=[DRIVE E E]     ═ beam  ║ crawl                     section widths set the outline
          [  hold  C C C ]                                                     (carrier: wide hangar mid-section)
```

1. **Scrapper:**
   - Fragments: a navy drive section (cut from a navy maker run), a hand-made civil freighter hold, and a drone weapon
     cluster from the drone maker, beamed on.
   - Done when the three donors are recognisable on the sheet, and each fragment keeps its own interior.
2. **AI vessel:**
   - Built from the core, two weapon clusters, a reactor bank, a drive, struts and crawls only.
   - Done when hull occupancy is high, the corridor ratio low, and no room exists without a module.
3. **Navy cruiser:**
   - Built from family proportions and standard sections, in a frame hull.
   - Done when corvette, cruiser and carrier silhouettes are told apart at a glance, and seeds within one family vary
     in section count and order.

## Open questions

1. Drone crawlways are 1 tile and walkable by every crew type. Should humans move slower in them, or should they be
   robot-only (boarders then need to cut in)?
2. Should we commission strut art (the new tile family) now, or accept 2-thick wall beams for the proofs of concept?
3. Should scrapper fragments show their donor's livery, i.e. per-fragment roof/hull variants? That needs a
   per-tile livery id in the render.
4. Should the hull families (navy corvette, frigate, cruiser, carrier) be data in the FactionDef, or code per family?
   Data is proposed.
5. Should a civilian maker become a neutral faction as well, or stay a fragment donor only?
6. Who sets the metric bands: tune to taste from sheets, or do you want to set them?
