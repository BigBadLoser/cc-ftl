# Ship generation v3: assembly-driven

Status: the shared framework and the navy proof of concept are built. Drones and scrappers still run on v2
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

## Navy (built): standardised functional sections

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

## Drones (next): machinery first

- Dense machine assemblies (weapon clusters, reactor banks, a processing core with PD), repeated in modules of 2–4.
- Arranged by utility: processing central, power by its loads, mounts outward, drive at +x.
- Exposed beams between assemblies, and robot crawlways only where an access port needs one.
- Mirrored only when the mounts balance.

## Scrappers (after drones): grafted donor sections

- Hand-made donor sections first: a navy drive block, a freighter hold, a drone weapon cluster, a habitat.
- Each keeps its own interior, and they are grafted at believable points.
- Cutting donors out of generated ships comes later; donor livery comes later too.

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
