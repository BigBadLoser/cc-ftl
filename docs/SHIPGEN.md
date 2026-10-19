# Ship generation v3: assembly-driven

> New to the generator? Start with [SHIPGEN_HANDOFF.md](SHIPGEN_HANDOFF.md): scope, file map, how to render
> sheets, metrics, design constraints and the open backlog.

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

## Navy v9 refinement (the five v5 follow-ups)

- **Long shallow decks.**
  - `deckPair` takes a span. A deck stretched to its span widens its rooms, not its corridor.
  - Deck grammars (`spineDecks`, `deckPair`, `layered`, `flightDeck`) build slimmer spines: 1 to `sectionRooms - 1`
    rooms per side, at one even depth at least one deeper than the decks (`evenDepth`).
  - Decks run the length of several spine sections, flush on all of them.
- **No fork noses.** `AttachOpts.xMin` keeps a child's west wall at or behind a column. Every deck is laid with
  `xMin` at its host's west wall, so decks sit behind the nose.
- **Layered cruisers reworked.** Crew decks run the whole spine and gun decks the crew decks, each layer stepped in
  at bow and stern. The result is a broad stepped hull, not a cross with stub decks.
- **Citadel cruisers.** Gun decks run the length of the flank decks (flush, or inset by 2 to 4 tiles).
- **Courtyards.**
  - Twin-hull and island-carrier drives attach `align: 'start'`, pushed outboard, so the gap between the hulls,
    or the hangar well, stays open aft.
  - `arrangeHull` scores enclosed space against a candidate (`Arranger.holes`). It then plates over enclosed
    pockets of up to 16 cells (`fillHoles`), never ones a gun or airlock looks out of. This applies to every
    faction on the arranger.
- **Second carrier: `flightDeck`.** Nose, a battery, then hangars side by side in pairs on the spine, core and
  stores aft, and long hull decks along the aft sections.

### Navy v10: long warships

- **Proportion targets.** Soft scoring targets are now corvette and frigate 3 to 4, cruiser 2.5 to 3.5, carrier
  2.8 to 3.6. `arrangeHull` scores 6 candidates.
- **Spines grow first.** Spine sections carry one room a side 70% of the time (else two), so a ship with more
  rooms gets longer before it gets broader. `balance` moves crew rooms from the decks into the spine until the decks
  are no longer than the spine.
- **One deck layer by default.** Frigate decks carry the guns and airlocks, whose faces need open space; the crew
  sits in the spine. Crew decks inside gun decks happen 15% of the time.
- **Layered cruisers are battleships.** A long one-room-a-side spine (bow guns inline, half the crew), crew decks
  the whole spine, and gun decks stepped in by an eighth of its length at each end. Weights: twin-hull 3,
  layered 1.5, citadel 0.5 (the citadel layout still reads squat).
- **Island carrier.** The command room is grafted straight onto a hull deck's outer wall, with no stalk.
- Donor sections cut from generated navy hulls (scrappers) use one candidate.

### Navy v11: guns as mounts (`navyMounts.ts`)

- **Slim hull, guns outside it.**
  - The hull is a slim spine of crew, core and stores, with the airlocks in its faces.
  - Guns are sponsons: one room sized to its mount (`mountBlock`), grafted onto a spine section's flank with one
    door.
  - Light guns are sometimes flush in a bow band section. Heavy (3x3) guns are always sponsons.
- **Mount layout per seed (`mountGuns`).**
  - Clustering: spread at intervals, or fore, amidships or aft.
  - Pairing: mirrored pairs (`attachMirrored`) or staggered sides.
  - Gun faces stay open: the arranger keeps the mounts' outer faces clear.
- **Grammars.**
  - `spineMounts`: frigate weight 5 (decks and wings 1 each); corvette weight 3 (straight chain 2, decks 0.5).
  - `layered` is now `battleship`: a long one-room-a-side spine, a short raised citadel (crew decks over the
    middle third), heavy sponsons on the citadel, the rest spread along the spine fore and aft.
  - Twin-hull cruisers and carriers are unchanged.
- **Bow gun fix.** The bow gun room takes only a light mount (`pickNose`). A 3x3 mount never found a straight hull
  face there; this was the cause of almost all "weapons do not fit" failures (about 20% of first attempts at depth
  4, now 0 of 80).

### Navy follow-ups

- Battleships still bulge amidships (citadel plus turret); a lower citadel would read longer.
- Carriers (about 2.3) and twin-hull cruisers stay broader than their targets.
- Small corvettes with one gun look alike (depth-1 adjacency within family 0.33).

## Drones v13: sockets and profiles on trusses

The navy's structural helpers carry over:
- **Sockets.** A carrier (beam or crawlway) gets sockets at even intervals along it.
- **Profiles.** A shared `Profile` (`profile.ts`) sets the strut length at each socket.
- **The result:** pods ride in a designed outline, and the beam stays visible between them.

- **Families** (grammar weights 5:1):
  - picket: the core, a sturdy socketed beam fore with the pods hugging it, a crawl spine only when there are
    many pods, paired thrusters;
  - lancer: a long fore beam whose struts follow a lance-head profile, a flatter beam aft, rail-end engines;
  - swarm: repeated crawl nodes, an engine pod on nodes and links where the exhaust is clear (distributed).
- **Propulsion.** `drive` builds a short rail with gaps, paired groups at both ends of a cross beam, or a rail-end
  pair on the carrier's faces. Engines always face +x.
- **Dock.** The dock sits straight on the core face, not on an antenna tube. The core is 7x4 so the dock door,
  the AI core and the console all fit.

### Drones v15: frame topologies

- **One frame per ship.** `frame` lays the carriers around the core in one of these topologies: single beam,
  Y fork (stem, cross piece, prongs), twin beams, H (rails on uprights), cross.
  - The topology is drawn once per ship (`Ctx.variant`, shared by every candidate arrangement).
  - Each family draws from its own weighted set.
  - Pods are shared out over the carrier faces by length (`load`).
- **Families now use one grammar each.**
  - Picket (`spoke`): single or cross, sturdy short beams, a crawl stub only for stores.
  - Lancer (`truss`): single, fork, twin or H; the spoke grammar stays as a rare alternative.
  - Swarm (`cluster`): a lattice of small nodes grown off any earlier node, on any face. There is no spine.
- **Engines follow the topology.**
  - Tips: the fork cross piece, H rails and cross arms each take one engine.
  - The rest sit at the stern: a fan (one pod off the beam end, one on a strut above and one below, exhausts
    clear), a paired cross beam, or a short rail.
  - The aft drive goes on before the aft pods.
- **Core ports are multi-use,** so the dock, beams and crawls can share a face.

### Drones v16: picket chassis

- **Picket chassis.** A compact `collar` frame: rails hugging the core's top and bottom faces running aft over the
  stores stub (capped at 10 tiles), and a bow brace across the front. Pods ride the frame's outer faces on
  sockets.
  - A handful of pods may use a short `brace` instead (stubby arms, one pod at each tip).
  - The drive sits behind the stub.
  - The lancer's spoke alternative and the `cross` topology are gone, so no lancer looks like a picket.
- **Crowded faces stagger.** When a face's pods do not fit in one row, every other pod goes out on a longer strut
  (a second row). This is a shared socket rule; it also helps fork and twin prongs.
- **The drive falls back** to a narrower style when a beam drive finds no room.
- **Viewer.** A new `structure` view (CLI `-structure.png`, live viewer option): beams, traversal and enclosed
  machinery in three flat colours.

### Drones v17: picket variation

- **Why v16 pickets came out identical.** It was not seed handling. Picket construction drew almost nothing from
  the ship's rng after the plan: the collar was forced once a picket had more than three pods, and the stub
  length, rail length and socket positions all followed from the plan. Depth-9 drone plans have the same pod
  sizes (both light guns are 2x2), so different seeds built the same ship.
- **Fix: parametric chassis choices.**
  - Collar or ring, drawn once per ship.
  - Rail length (0 to 2 shorter), rail thickness (1 to 2), the bow brace (70%), and a seeded share of pods per
    face.
  - The ring stands off the core on struts (7 to 9 tiles), is open aft for the drive, and puts its corner pods
    first (`Carrier.ends`).
  - The smallest pickets (three pods or fewer) only choose between brace and collar.
- Viewer: `faction.drones:picket` renders one hull family.

### Drone follow-ups

- Swarm grammar is mixed: some lattices grow a run of nodes in one line (swarm #4 at depth 9 is half comb, half
  blob). Node links could prefer turning.
- Fork and twin prongs still crowd: inner-face pods clump against the stem.
- Pickets at depth 1 to 4 look alike (one collar); a second compact chassis (a ring with corner pods) would help.
- Staggered picket rows read busier than single rows.

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

## Transitions (v18): tapered collars between sections

- **`hullFill.ts` holds all the plating passes** that run after an arrangement: seam plates, enclosed-pocket
  fills, and `taper`. The Arranger exposes `cell`, `reserved` and `box` to them.
- **How `taper` works.** It finds concave steps where two different blocks meet (a wider section's wall rising from
  a narrower one's outer wall). It fills each corner with a stepped diagonal of plating, up to the step height and
  as far along the narrower section as the slope asks.
  - Reserved cells (gun and airlock faces, engine exhaust) stop it, so equipment, traversal and clearances are
    never touched.
  - Steps inside one block are left alone.
- **Per faction (`FactionDef.transition`).**
  - Navy: integrated, regular (slope 2, up to 4 high).
  - Scrappers: improvised adapter plating (slope 1, up to 3, jitter 0.5).
  - Drones: none (exposed beam joins).
- It runs in `arrangeHull` before pockets are filled, so it applies to scrapper donors cut from navy hulls too.
- **Picket ring (v18).** The ring stands 2 to 3 tiles off the core. Its rails are as long as its pods need (40%
  of the pods on each rail, staggered when crowded); a ring that would sprawl past twice the core's length falls
  back to a collar. Its stub reaches past the ring, so the airlock and stores sit outside it.

## Civilians (v19-v21): topologies, not one corridor run

`civilGrammars.ts` (topologies) on the shared arranger, from `civilBlocks.ts` (the civil builders the scrappers also use as
donors), `civilFrames.ts` (container frames, ore cages, truss bridges, rig booms, the liner's 2D hull) and
`civilStations.ts` (ring and lattice stations). Content: `src/content/factions/civilian.ts`. Lightly armed: point
defence, at most a single light gun and a small shield; never a battery.

v20 joined every section corridor end to corridor end, so every ship was one straight run with blocks hung off it. In
v21 each family draws a topology once per ship (`c.variant`, shared by all candidate arrangements), and most of them
join sideways or lengthways:

- freighter: `frame` (containers slung from two crawlway rails with an open lane between them, the crew body and drive
  aft), `offset` (the cargo mass beside the crew body, flush aft, reaching forward: asymmetric), `tug` (a crewed tug
  pushing a big container body on a truss bridge).
- liner: one wide 2D hull (`linerBody`): two long corridors, back-to-back cabins between them, lounges fore at full
  depth, outer cabin rows whose depth follows the outline (`teardrop`, `oval`) or a flat `twin` hull (the inner band
  split by a groove, the lower hull shorter). Cockpit fore, drive aft; an occasional bow dome as an accent.
- mining: `cage` (a row of ore holds under a crawlway rail with truss teeth, beside the crew body, flush aft; sometimes
  a bow rig), `boom` (the same cage, plus the rig on a long boom off the other flank reaching past the bow), `struts`
  (v20's barges and rigs, a minority).
- station: `ring` (rooms round a square corridor ring with an empty centre, a hub joined by 2-4 spokes), `lattice`
  (single-room modules on a grid, linked by tubes along rows and one tube per row pair, beams elsewhere), `stack`
  (station hub, habitat and pods offset along a north-south mast, airlocks at its ends).
- The crew body (freighter, mining) is the cockpit (bridge, core, airlocks) plus a habitat-ring crew module aft.
- Drive (`drive`): `nozzle`, `pair` or `nacelles`, the first no taller than its host. Stations carry thruster rooms
  inside the ring or lattice instead (east-facing: the engine art and validator only allow +x); a stack's thruster sits
  on an east-side module, so no station has a stern section.
- `beside` grafts a body flush with the host's after end on its outermost wall line; arranger `xMax` keeps it from
  overrunning the drive.

Metric `spine`: the share of corridor tiles within one tile of a single straight row or column. At d9 (12 seeds), v20 to
v21: freighter 0.95 to 0.25, liner 0.95 to 0.42, mining 0.94 to 0.62 (struts seeds still 0.9-1.0), station 0.37 to 0.33.

Taper: `{ slope 3, max 2, jitter 0, label 'fairing' }`.

Known weak spots (v21 first preview): ring stations look alike; twin liners show an enclosed groove; the crew body is
still a short run; tapers smear the cage's rail into the crew body.

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
