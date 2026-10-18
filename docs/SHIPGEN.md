# Ship generation v3: assembly-driven

Status: the generic 2D arranger and four navy hull grammars are built (v4). Drones and scrappers still run on v2
(structure-first topologies) until their proofs of concept replace it; v2's topology code is then removed. There is
one pipeline; only its stage 3 currently branches on whether a faction has hull families.

## Pipeline

```
 FactionDef + seed + depth
  1 BRIEF        role / hull family (weights scale with depth), budget            plan.ts
  2 ASSEMBLIES   functional assemblies from the plan: command, batteries, core,   composeNavy.ts (sectionsOf)
                 habitat, cargo, hangar, power, drive; each holds its rooms
  3 ARRANGE      constraint-scored order and per-kind depths, with seeded slack;  composeNavy.ts (arrange)
                 FEASIBILITY FEEDBACK while building: a section that cannot hold
                 its rooms at its depth raises that depth; a bulkhead port that
                 finds no counterpart reorders; at most 8 revisions
  4 STRUCTURE    joins recorded per assembly pair: frame (shared bulkhead),       compose.ts (Composer)
                 graft (sponson on a section), beam (solid strut; drones next)
  5 TRAVERSAL    derived from the assemblies' access requirements: navy halls     sections' halls, bulkhead doors
                 meet at bulkhead ports; drones will get crawlways (robots
                 normal speed, humans slow, boarders pass)
  6 FIT + CHECK  existing placer, lights, power top-up, validation, METRIC bands  generate.ts, fit.ts, layout.ts,
                 (diagnostics, used for rejection; reseed, max 24 attempts)        validate.ts, metrics.ts
  7 OUTPUT       ShipTemplate + GenResult { metrics, debug: assemblies, asmOf,     generate.ts
                 ports, joins, traversal, profile }
```

## Data model

- **Assembly** (`AsmRecord`): `id`, `kind`, `label`, `access` (human, robot or external), bounds, and the stamped
  parts that make it up.
- **Port** (`PortRecord`): a tile, a facing, an access kind, and `matched`. A bulkhead opens a door only where both
  sides have floor. An unmatched port makes the arrangement infeasible, and it gets revised.
- **Join** (`JoinRecord`): `frame`, `graft` or `beam`, with the tiles it runs through. Beams are structural in the
  data and never walkable. When drones use them, the sim gets a beam flag on wall tiles, and the game draws an
  isolated, clearly marked placeholder render until strut sprites exist. The viewer draws joins in its debug view.
- **Hull family** (`HullFamilyDef`, data in FactionDef):
  - weight by depth and budget bonus;
  - depth range per section kind;
  - gun columns per battery and sponson chance;
  - rooms per section;
  - `merge` (small hulls combine core, crew and stores), `citadel` (enclosed core);
  - allowed drive layouts (`block` transverse engineering, `pods` flush engine pods behind a power neck).
- **Metric bands** (FactionDef): compactness, occupancy, corridor ratio, narrow links, aspect. They are calibrated
  from rendered samples; the navy currently uses compactness ≥ 0.38 and corridor ratio 0.10–0.45.

## Reused or replaced

| Kept | Changed | Replaced or demoted |
|---|---|---|
| placer and fitting (`Layout`, `fit.ts`), `validate.ts`, determinism, canvas stamping, `ShipTemplate`, debug spawn, viewer | `plan.ts` is the brief; `Builder` is the low-level stamper (with `reset` for revisions); `pairUp`, `stern` and the noses are section helpers | v2 topologies (spine, ring, carrier, hub, rails, clusters, salvage), kept only until the drone and scrapper proofs of concept land |

## The 2D arranger (`arranger.ts`, `blocks.ts`)

The arranger is faction-agnostic.

- **Blocks:** a block is drawn with a local Builder and frozen into rows, plus:
  - one private char per room, with its role and spec;
  - ports (wall segments with a side and an access kind);
  - engine faces.
- **Attaching:** `attach(parent, child, {side, parentPort, childPort, align, kind})` joins two free ports on opposite
  sides along a shared wall line and slides the child along the overlap. Before it commits a candidate placement it
  checks feasibility:
  - floor only on empty tiles;
  - walls only on empty tiles or walls;
  - nothing east of any engine face, whether it was placed before or after.
- **Mirrored attaching:** `attachMirrored` places a block and its mirror partner (same outline, its own contents) on
  mirrored parents, both or neither, undoing the first if the second fails.
- **Doors:** these open only where both sides of the shared wall are floor.
- **Debug output:** assemblies, ports, joins (frame, graft or beam) and traversal.

Drones will reuse the arranger with their own blocks and grammar.

**v5:**
- **Decks:** outboard decks (a hall plus one band of rooms, attached lengthways through their inner wall) make
  parallel layers and lengthways overlap instead of perpendicular wings.
- **Several grammars per family:** a weighted list in the data. A grammar is drawn first, then up to four candidate
  arrangements of it are scored against the family's soft `aspect` target and compactness (pressure, never a reject).
- **Kept-open faces:** gun mounts and airlocks keep their north / south faces open (`Block.exposed`), so nothing
  buries them.
- **Flush airlocks:** airlocks sit flush as dock rooms inside bands and decks.

**Navy grammars** (v5: `navyGrammars.ts`, several per family; the list below is v4):
- **corvette** `linear`: a short chain.
- **frigate** `spineWings`: a spine, plus mirrored wing blocks side by side on a hatch of the mid-spine section.
- **cruiser** `twinHull`: a citadel at the root, two mirrored hull chains flanking it, twin drives.
- **carrier** `carrierIsland`: a hangar block at the root, a bow battery, an offset command island on one side, a gun
  block on the other, an aft chain and nacelles.

**Propulsion** (`propulsion` per family, engines always facing +x):
- transverse bank;
- engine cluster on a stern spine;
- nacelles on outriggers;
- pods at the wing ends;
- side drives overhanging the power section.

**Diversity:** in addition to shape and section-profile distance, an **adjacency distance**: the multiset Jaccard
distance over join tokens `kindA>dir>kindB` and assembly-degree tokens. It is reported within and across families.

## Navy sections

- **Sections are mirrored assemblies:**
  - Band sections: rooms around a 2-wide axis hall.
  - Enclosed sections: a citadel or hangar deck on the axis, passages around it, transverse halls at both ends. These
    make loops.
  - Batteries can carry their guns in grafted sponsons.
  - The drive is either a transverse engineering block or flush engine pods.
- **Proportions:** the section contents and the family depths set the outline. Corvettes merge their sections and
  stay short, frigates carry deep batteries, cruisers have a broad citadel, and carriers have a hangar deck as their
  widest part.
- **Order:** constraint-scored (hangar amidships, batteries spread, core between batteries, stores aft) with seeded
  noise, so sequences vary between seeds.

## Navy follow-ups (v5 accepted as the baseline)

- Rework or drop layered cruisers.
- Make side decks longer and shallower than their host.
- Open or fill the enclosed holes (courtyards between long decks and twin drives).
- Keep side decks behind the nose (no fork noses).
- Add a second carrier layout.

## Drones (built, v6): machinery first, same arranger

- **Blocks** (`droneBlocks.ts`):
  - sealed pods whose interior is exactly the module footprint: guns, PD, shields, 1–2-reactor banks, engines. Access
    kind `external`; there is no door and no floor left, so they are serviced from outside;
  - robot crawlways one tile wide (access `robot`), whose long sides carry several mounts;
  - solid beams (`=` in templates, sim `Struct.Beam`: solid, airtight, unwalkable, no floor, no integrity);
  - the processing room (AI core plus the weapons console);
  - small stores;
  - a dock.
- **Grammars** (`droneGrammars.ts`):
  - `spoke`: the processing room at the centre, crawl spokes to repeated pod clusters (mirrored only when rolled),
    reactors on a west arm, engines on a crawl rail aft;
  - `truss`: beam trusses fore (guns) and aft (defences, reactors) with pods on struts, engines on a cross beam;
  - `cluster`: repeated crawl-node clusters on a zig-zag of crawl tubes, pods out on beam struts.
- **Families:** picket, lancer and swarm weight these grammars and carry soft aspect targets.
- **No helm:** the AI core is the bridge for validation (as on the robots branch). One weapons console stays,
  because weapons only charge with a manned console. Crews are human placeholders until the robots branch merges.
  The AI core is the boarding target; validation makes it reachable over the crawlways from the airlock.
- **Beams in game** draw with an isolated, clearly marked placeholder (`src/render/beamPlaceholder.ts`) until strut
  sprites exist. In the viewer, beam tiles are magenta.
- **Generator follow-ups:**
  - beams are buried under pod walls; trusses should stay visible along their length;
  - small drones have a high corridor share;
  - engine rails are repetitive;
  - the dock still looks like an antenna;
  - families are less distinct than grammars;
  - some spoke layouts still look like randomly attached equipment: favour purposeful machinery clusters and
    structural relationships over arbitrary branching.
- **Sim follow-ups** (no sim work until the generator is signed off):
  - capability-based crawl speed (robots normal, humans slow) needs the robots branch;
  - sealed pods can't be repaired from inside (external servicing is not simulated yet).

## Drones (original plan)

- Dense machine assemblies (weapon clusters, reactor banks, a processing core with PD), repeated in modules of 2–4.
- Arranged by utility: processing central, power by its loads, mounts outward, drive at +x.
- Exposed beams between assemblies, and robot crawlways only where an access port needs one.
- Mirrored only when the mounts balance.

## Scrappers (v8): anchored salvage compositions

Same arranger, no sim changes. Files:
- `scrapDonors.ts`: the donor registry and its pool of jobs.
- `scrapBlocks.ts`: the hand-made civil and one-off hulls.
- `salvage.ts`: cut, damage, outline ports and freezing a section.
- `scrapGrammars.ts`: composition.

- **Donor sourcing.** Each donor's origin is in `Block.donor`.
  - Navy donors come from the navy's own builders: bow (`noseBlock`), drive (`bankBlock`), battery (`bandBlock`).
  - The old navy hull is a whole navy arrangement (`arrangeHull` with the navy faction and a corvette or frigate
    family on a sub-plan), cut off fore or aft of a seam.
  - The drone weapon section is the drone generator's own arrangement of the guns, with its processing room gutted.
  - Navy and drone refinements therefore carry over automatically. The sources are named in
    `FactionDef.salvage`.
  - Hand-made, civil or unique only: freighter (open bay under a 2-wide gangway), habitat (1-wide ring round a hub),
    liner segment (tiny one-bed cabins on a 1-wide spine, lounge bulb), station module (square, 1-wide cross
    corridor, four quadrants), ore barge (catwalk over hoppers stepping shallower), cargo pod string (pods on 1-tile
    tubes), mining tug.
- **Role selection.**
  - Each hull family weights donors by what the role wants (`HullFamilyDef.donors`) and names its anchors
    (`anchors`). Raiders lean on hulks, drone guns and habitats; haulers on freighters, barges and pod strings;
    gunrunners on batteries, drone sections and stations.
  - Every job the plan has (command, hangar, crew, guns, crates, drive) gets a donor that carries it. Donors that
    share a job split it. Extras scale with size.
  - Whatever no donor kept is patched in: bow, gun band, habitat, station, patched reactor, strapped engines,
    bolted crates, spare airlocks.
- **Composition.**
  - `heap`: weld onto any part on any face.
  - `raft`: two donors welded lengthways.
  - `chain`: end to end, onto the last donor.
  - Donors flip top to bottom. Engine-free non-navy donors also flip end to end. Engines always face +x.
  - Seams of 1 to 2 tiles between hulls are plated over (`Arranger.plate`), never over engine exhaust or kept-open
    gun and airlock faces.
- **Salvage look** (`salvage.ts`).
  - Partial hulls: a cut along a seam column that crosses no room and no room's only door, resealed into wall.
    Whatever the cut lost goes back to the pool, by module.
  - Damage: a 2 to 3 tile corner knocked off a room that can spare the floor. Never through a door, corridor,
    sealed pod, engine, airlock or bay.
  - Graft ports come from the remaining outline. Engine, airlock, bay and reactor rooms take no grafts.

### Generator follow-ups

- Size does not scale enough: depth-1 scrappers are almost as large as depth-9 ones. Each job gets a donor and
  donors have minimum sizes; small ships need fewer, smaller donors (or cut ones).
- Patched reactors and strapped engines are frequent and read as grey slabs; give them a donor look.
- Some enclosed one-tile space pockets survive between welded hulls; plate enclosed pockets too.
- No rotation by 90 degrees (gun and airlock faces are north / south only); flips only.
- Liner and pod string are rare at depth 1 to 4; families could weight them by size.
- Navy and drone donor shapes improve with the navy and drone passes.
- About 10% of first attempts still fail fit-out (a gun or engine squeezed by a weld); reseeding covers it.

### Render follow-ups (not started)

- Per-donor livery and wear art (hull tint, rust, patch plates) from the sprite pipeline.

## Diversity

The viewer and tests report:
- **shape:** mean pairwise 1 − IoU of normalised hull masks;
- **sections:** mean normalised edit distance of the section profiles (`C B5s Ke5 H4 Q3 D3`).

Both are measured within one family and across families per depth. The navy test requires all four families to
appear, every port to be matched, frame joins to be present, and at depth 9 a shape diversity above 0.15 and a
section diversity above 0.4.

## Viewer

Three views, in both the CLI sheets (`--views all`) and the phone page (View selector):
- **layout:** the detailed view.
- **silhouette:** the filled hull outline.
- **assemblies:** each assembly tinted and labelled; frame joins yellow, grafts orange, beams magenta; traversal
  dotted by access kind; ports green when matched, red when not.

Each ship shows its family, its section profile and its metrics.
