# Layout research: procedural floor plans, room layout and fit-out

Notes from a literature pass (October 2026) on methods that address problems seen in the ship and station generators:
irregular courtyard band rooms, stair-stepped walls on curved pockets, generate-reject-reseed churn, rooms reachable
only through other rooms, and greedy module fit. Each entry says what the method is and where it applies to cc-ftl.
See `SHIPGEN.md` for the generator itself.

## Room layout inside a region (courtyards, pockets, sections)

### Constrained growth

Lopes, Tutenel, Smelik, de Kraker, Bidarra, "A constrained growth method for procedural floor plan generation"
(GAME-ON 2010). [Paper page](https://publications.graphics.tudelft.nl/papers/584).

- Rooms start as small seeds on a grid and take turns growing.
- Phase one: each room grows only as the largest rectangle it can.
- Phase two: only once no rectangle can grow, L-shaped growth fills what is left.
- Designers control the result through functional constraints (sizes, adjacencies). The authors report plausible,
  connected plans, cheap to implement.
- [Green, Salge, Togelius (FDG 2019)](https://ar5iv.arxiv.org/html/1906.05094) adapted it to Minecraft without the
  rectangle-first phase, and got irregular rooms. That is the "random" look of our first courtyard band.

**For us:** fill a big court by seeding rooms (sized from the plan's room specs) against its walls and one court seed
in the middle, then grow rectangles first and L's last. Rectangular pockets (military satellites) come out as plain
boxes; only the last L step meets a wheel sector's curve. This replaces the angle-sliced band and most of its special
cases (cut-off passage pieces, scraps, stair-step door spots).

### Split grammars

Wonka, Wimmer, Sillion, Ribarsky, "Instant Architecture" (SIGGRAPH 2003),
[PDF](https://www.cg.tuwien.ac.at/research/vr/instantarchitecture/instant_architecture.pdf); successor CGA shape grammar
(Müller et al. 2006).

- A shape is split recursively: a facade into floors, a floor into repeated units of a set width, the remainder
  spread evenly.
- Buildings suit split rules better than growth systems such as L-systems, because of their tight spatial
  constraints.

**For us:** along each long straight run of a court's wall, split off a strip 4-5 tiles deep and split the strip into
rooms of the planned width. This gives the most regular rooms, and pairs well with constrained growth for the
leftovers.

### Squarified treemaps

Marson and Musse, "Automatic real-time generation of floor plans based on squarified treemaps algorithm" (IJCGT 2010),
building on Bruls, Huizing, van Wijk, ["Squarified treemaps"](https://research.tue.nl/en/publications/squarified-treemaps/)
(2000).

- Recursively split a rectangle into rooms of given areas while keeping each close to square.
- Rooms left without a connection get corridors added.

**For us:** fits rectangular pockets (a satellite quarter) as a whole block of rooms instead of a court.

### Coarse zoning, perimeter inward

[Subveillance devlog, "Procedural generation of building interiors"](https://unusual-intersection.itch.io/subveillance/devlog/498365/procedural-generation-of-building-interiors-part-2).

- Rings of room space and hallway space are filled inward from the perimeter, on a coarse grid (each zone cell expands
  to 4x4 tiles).
- Unlimited inner room space gave huge interior rooms. The author's fix was to cap inner room depth (twice the outer
  ring's).

**For us:** a coarse grid turns a curve into a few big steps instead of a 1-tile staircase, a direct fix for diagonal
walls. The huge interior rooms are our big courts.

### Rectangular duals (adjacency graph to rectangles)

[Floor planning with proximity requirements](https://arxiv.org/pdf/2107.05036);
[GPLAN](https://arxiv.org/pdf/2008.01803) (dimensioned floor plans for given adjacencies).

- A rectangular dual partitions a rectangle into rectangles whose adjacencies match a planar graph.
- Bhasker and Sahni gave linear-time construction for triangulated planar graphs (1987-88). GPLAN adds dimensions by
  linear optimisation and falls back to L-shaped (orthogonal) plans when no rectangular dual exists.

**For us:** heavier machinery, but it fits ship sections where adjacency rules matter (bridge beside core, reactor
beside engines).

## Scoring and searching layouts

### Space syntax

[Hillier's space syntax, a synopsis](https://0-doi-org.brum.beds.ac.uk/10.3390/su13063394);
[space syntax evaluation of procedurally generated levels](https://www.academia.edu/75209801/Developing_a_Space_Syntax_Based_Evaluation_Method_for_Procedurally_Generated_Game_Levels);
[space syntax on Splinter Cell levels](https://nottingham-repository.worktribe.com/OutputFile/722033).

- Depth: the fewest steps (rooms passed through) from one space to another.
- Justified graph: every space laid out by its depth from a root. Tree-like means a deep layout, bush-like a shallow
  one.
- Integration: a space's average depth to all others (how central it is).

**For us:** the interior audit's `behind` and `viaQuarters` are crude depth tests from the docks. Add mean depth from
the docks, the deepest key room and integration per room, so stations compare on standard numbers and an optimiser
has a target.

### Score and repair instead of reject and reseed

Merrell, Schkufza, Koltun, "Computer-generated residential building layouts" (SIGGRAPH Asia 2010),
[PDF](https://www.cs.princeton.edu/courses/archive/spring11/cos598A/pdfs/Merrell10a.pdf); Bao, Yan, Mitra, Wonka,
["Generating and exploring good building layouts"](https://history.siggraph.org/?p=108396) (SIGGRAPH 2013).

- Merrell: a Bayesian network trained on real programs proposes the rooms; stochastic optimisation (Metropolis-style)
  realises the floor plan.
- Bao: hard constraints (regulations) plus soft quality goals; the space of good layouts is explored from samples.

**For us:** a bad station is currently thrown away and reseeded, which costs attempts (military power rejections) and
changes which layout a seed gets, so before/after sheets stop matching. A few targeted repairs plus re-scoring would
keep good structures.

## Doors and circulation

- **Doors only where needed:** the [AVWW interior generator](https://arcengames.com/avww-interior-generator-technical-overview/)
  finds floor groups that cannot reach each other and adds doors only to join them. Our `pruneDoors` closes surplus
  doors instead; this is the cleaner formulation.
- **Least-area corridors:** Mirahmadi and Shami,
  ["A novel algorithm for real-time procedural generation of building floor plans"](https://ar5iv.labs.arxiv.org/html/1211.5842)
  (2012), start from treemap rooms and search for the corridor placement that uses the least floor area.
- **Cyclic generation:** Joris Dormans' work on *Unexplored*
  ([Boris the Brave's write-up](https://www.boristhebrave.com/2021/04/10/dungeon-generation-in-unexplored/)) builds
  levels around loops instead of single paths. **For us:** boarding and patrols play better when key rooms have two
  routes in. A possible audit metric is the share of key rooms reachable by two independent routes.
- **Room accretion:** [Brogue](https://brogue.wiki/wiki/Level_generation) attaches rooms at door sites on rooms already
  placed. The arranger already works this way.

## Furniture and module fit

- Merrell et al., ["Interactive furniture layout using interior design guidelines"](https://graphics.stanford.edu/projects/furniture/)
  (SIGGRAPH 2011): guidelines (clearance, circulation, alignment, visual balance) as terms of one density function,
  sampled with Monte Carlo.
- Yu et al., ["Make It Home"](https://ww3.math.ucla.edu/camreport/cam11-49.pdf) (SIGGRAPH 2011): spacing priors learned
  from examples, arrangement by simulated annealing.
- Tutenel, Bidarra, Smelik, de Kraker,
  ["Rule-based layout solving and its application to procedural interior generation"](https://research.tudelft.nl/en/publications/rule-based-layout-solving-and-its-application-to-procedural-inter)
  (CASA 2009): each object class carries placement rules and "feature areas" (space it needs kept clear). It is a formal
  version of our access tiles and keep marks.

**For us:** fit is greedy (best spot now, never revisited). A short improvement pass that moves modules and re-scores
could fix cramped rooms without new recipes.

## Less relevant at our scale

- [Wave function collapse](https://boristhebrave.com/2020/04/13/wave-function-collapse-explained) and
  [answer set programming](https://course.ccs.neu.edu/cs5150f14/readings/smith_asp4pcg.pdf) are general constraint
  solvers: good for tiles and puzzles, overkill for room layout here.
- Spaceship devlogs ([Abholos](https://neverreststudio.itch.io/abholos/devlog/9139/dev-log-1-procedural-ships),
  [Starship Command 2](https://evglabs.itch.io/starshipcommand2/devlog/1075/tuesday-update-5162017-ship-interiors),
  [shipwright](https://github.com/stewsters/shipwright)) use cell-based hull filling or force packing, and report the
  same pitfalls we hit (rooms escaping the hull, unreachable areas, walls on non-rectilinear shapes).

## Making stations feel less generated

Stations vary, but they read as generated: every room role is spread evenly, every space has the same weight, and
everything was built at once. Ideas, best payoff first.

1. **Zones before rooms.** Rooms currently go round-robin into free space. Real stations cluster functions: a
   habitation ring (quarters, messes), logistics by the docks (stores), a secure core (bridge, core, armoury), an
   industrial wing (reactors, workshops). This is the zoning-first step of the Subveillance devlog and of Merrell et al.
   2010 (both above). For us: give each ring arc, satellite or spoke a district and order its room list by district,
   with a few adjacency preferences (cargo near docks, armoury on the way from docks to bridge, quarters away from
   airlocks).
2. **A landmark and some set pieces.** Kate Compton's
   ["10,000 bowls of oatmeal"](https://en.wikipedia.org/wiki/Procedural_generation) problem: outputs can all differ and
   still feel the same; what players remember is a feature they can name. One landmark per station (the hangar deck on
   military stations, a grand concourse, a greenhouse dome, a lab ring), the other courts modest. Plus a few
   hand-authored set pieces stamped into generated layouts: a brig, a chapel, a bar with a stage, a customs checkpoint,
   the commander's office. Cogmind lays prefabs and "encounters" onto generated maps
   ([Kyzrati, Map prefabs in depth](https://www.moddb.com/news/map-prefabs-in-depth)); Spelunky picks from 8-16
   hand-made templates per room type, with probabilistic tiles
   ([Kazemi, Spelunky Generator Lessons](https://tinysubversions.com/spelunkyGen2/)).
3. **History.** Each station is one perfect shape built in one go. Real ones grow: an original core, modules bolted on
   later in another style, patched hull, a retrofitted wing (an ex-navy depot now trading). Generate in phases: the
   original structure, then one or two later additions that ignore its symmetry, with their own wall style. A kind could
   mix in a second doctrine (armouries turned into stores, a decommissioned gun bay). Pirate dens (welded modules) are
   already the most characterful stations.
4. **A corridor hierarchy.** All corridors are one width. A wide main concourse from the docks to the core, narrow
   service passages and the odd crawlway would read as designed. Loops give boarding and patrols a second route
   (cyclic generation, above).
5. **Furnishing personality.** A per-station personality (rich or poor, tidy or cluttered, busy or half-empty, worn)
   varies fill levels, recipe choices and wear, so cargo rooms on two stations differ. The fit improvement pass (above)
   clears the cramped look.
6. **Tie it to the mechanics.** [Emily Short](https://emshort.blog/2016/09/21/bowls-of-oatmeal-and-text-generation/):
   generated content matters when it connects to mechanics. A dock checkpoint where security stands and the alarm
   starts; armouries near the entrances so defenders arm on the way; hangar decks that launch boarding shuttles.

## Plan

1. Courts: constrained growth on the band, rectangles first, L-growth last, room seeds sized from the plan, a court
   seed in the middle; split strips along long straight runs. (Prototype in progress on `shipgen-stations-1`.)
2. Audit: space syntax depth and integration; a two-routes metric for key rooms.
3. Generation: score and repair before reseeding.
4. Fit: an improvement pass after greedy placement.
5. Stations: zoning (prototype next), then a landmark and set pieces per kind, then phased growth (history).
