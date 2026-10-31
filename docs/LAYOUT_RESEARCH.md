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

## Stations as built and designed (second pass, October 2026)

A second literature pass, on station layouts people have designed by hand or for real, and on other generators. No
published method generates round station interiors; Space Haven's derelicts and Barotrauma's outposts are not documented.

### Space Station 13 and 14 maps

Hand-made station maps, refined by players over about 20 years: the largest body of station-layout experience there is.
[Paradise design guide](https://devdocs.paradisestation.org/mapping/design/),
[Paradise wiki, Guide to Mapping](https://paradisestation.org/wiki/Guide_to_Mapping).

- Hallway hierarchy: primary halls 3 wide, arterial halls 2 wide, halls inside a department 1-2 wide.
- Departments (medbay, engineering, cargo) are clusters with a front door off the main hall and a back or side door into
  maintenance. Maintenance wraps round the departments, so security can flank intruders and there are loops.
- "Big Room Disease": rooms as large as their purpose and occupancy need, "but no larger"; consistent scale (a freezer
  never outsizes its kitchen).
- Public areas should be interesting (windows to space, decoration, floor finishes); every maintenance area gets a
  distinctive feature so players know where they are.

**For us:** ring corridors 2 wide under a 3-wide concourse; departments instead of every room doored onto the ring; a
service passage for loops; rooms sized by their job, not by the arc they were given.

### Heat Signature: sectors, locks and keys

Tom Francis, [sectors](https://pentadact.com/2015-11-14-teaching-heat-signatures-ship-generator-to-think-in-sectors),
[locks and keys](https://pentadact.com/2015-11-28-generating-locks-and-keys-in-heat-signatures-ships).

- Ships felt like random, empty mazes until the generator placed sectors: clusters of 3-6 rooms as one unit, each
  attached outward from the last, so every room is reachable.
- Door security rises towards the objective (the cockpit); the key lies in the sector before.
- Small leftover pockets read as natural when spread out, not clustered.

**For us:** departments as the placement unit; security that deepens from the docks to the secure core and the bridge.

### Shadows of Doubt: shells and partitions

ColePowered, [DevBlog #13](https://colepowered.com/2019/02/),
[#22 Doors Galore](https://colepowered.itch.io/shadows/devlog/164492/shadows-of-doubt-devblog-22-doors-galore).

- Hand-designed building outlines; the generator places the dividing walls inside them.
- Rooms are scored on shape and windows; only some room types may connect; a room may "steal" floor from a neighbour
  when it needs more.

**For us:** band segments that trade floor with their neighbours until each fits its job, and connection rules
(quarters never open onto cargo).

### Habitat zoning (NASA, ESA)

[SAE 881119, Space Station habitat baseline](https://saemobilus.sae.org/papers/a-baseline-design-space-station-habitat-881119),
[NASA privacy guidelines (1988)](https://ntrs.nasa.gov/api/citations/19880011858/downloads/19880011858.pdf),
[Liquifer, Gateway I-HAB interior (IAC 2019)](https://liquifer.com/wp-content/uploads/2020/03/2019_Interior_IAC-Paper-Liquifer-2019_v3.pdf).

- Three zones: quiet (crew quarters), a buffer for noise (stowage, medical, hygiene), then the active areas.
- Hygiene away from food; work areas away from living quarters.

**For us:** room order quarters, then buffer (medbay, lockers, storage), then mess and galley, then works.

### Radial plans: Palmanova and the Stanford Torus

[Palmanova](https://en.wikipedia.org/wiki/Palmanova), [Third Venetia](https://thirdvenetia.substack.com/p/the-star-fortress-of-palmanova);
[Stanford Torus](https://en.wikipedia.org/wiki/Stanford_torus), [NSS](https://nss.org/stanford-torus-space-settlement/).

- Palmanova: one number drives the plan (multiples of three: nine bastions, three gates, eighteen radial streets). Radial
  streets run from the central square towards the bastions, crossing concentric ring roads; the bastions stand at regular
  angles so their fields of fire overlap.
- Stanford Torus: the ring is cut into six equal sections with a spoke to the centre of each; housing and agriculture
  take whole sections; industry is moved off the ring.

**For us:** each round station picks a symmetry number (4, 6 or 8) that sets its spokes, rim rooms and dock banks, with
each rim room at the end of a line from the centre: rim rooms read as bastions, not as boxes glued on. The ring cut into
equal sections, one district each, its spoke at the section's centre.

## Round plans and non-rectangular rooms (third pass, October 2026)

A broader pass beyond stations: radial buildings, radial layout algorithms, rooms that are not rectangles, and drawing
curved walls on a tile grid.

### Radial buildings

- **The Pentagon:** five concentric rings joined by ten radial corridors; the courts between the rings are light wells
  (more windows); the outer ring is the long way round, so people cut across by the radials.
  [Wikipedia](https://en.wikipedia.org/wiki/The_Pentagon), [Defense Media Network](https://defensemedianetwork.com/stories/lost-and-found-in-the-pentagon).
- **Fujian tulou:** an outer ring of identical units, lower inner rings for kitchens and stores, the ancestral hall at the
  centre, one gate. [Wikipedia](https://en.wikipedia.org/wiki/Fujian_tulou),
  [Studio Matrx](https://www.studiomatrx.org/architecture-canon/tulou-hakka-roundhouses).
- **Eastern State Penitentiary:** a central rotunda with no partitions and a sightline down the axis of every cellblock;
  when later blocks broke the radial plan, mirrors were fitted to keep the view.
  [Eastern State](https://www.easternstate.org/node/722).

**For us:** the gaps between rings become deliberate courts with windows to space, not leftover void; more radial
corridors (one per section) so nobody walks the long way round; repetition is a strength (a habitation ring of identical
cabins reads as designed); one main gate; the rotunda keeps a clear sightline down every spoke.

### Radial partition (sunburst)

The sunburst is a treemap drawn radially (d3 `partition`): each node gets an angle in proportion to its size within its
parent's angle, and its depth in the tree sets its ring; a "parallel" variant stacks children radially instead.
[Protovis](https://graphics.stanford.edu/~mbostock/protovis-jsdoc/symbols/src/layout_Sunburst.js.html),
[TanStack](https://tanstack.com/charts/latest/docs/reference/marks/sunburst).

**For us:** the station as a tree (station, district, department, room) laid out as a sunburst: districts take sections
of the ring, departments take arcs within them, rooms take arcs within those. One algorithm for districts, departments
and room order, replacing the ordered list wrapped round the ring.

### Non-rectangular floor plans

- Lerm, ["Floor Plan Generation for Simple Polygons with Support for Holes"](https://dl.gi.de/bitstreams/85753577-65cb-4080-939e-dce4d2304bf3/download):
  rooms grow walls outward from seed points inside any polygon outline (a ring is a polygon with a hole), then the walls
  are straightened and simplified until the plan looks credible.
- Dahl and Rinde, ["Procedural Generation of Indoor Environments"](https://www.cse.chalmers.se/~uffe/xjobb/Lars%20Rinde%20o%20Alexander%20Dahl-Procedural%20Generation%20of%20Indoor%20Environments.pdf):
  Voronoi splits of irregular polygons; ring-shaped node structures.
- Shape grammars in cylindrical coordinates (procedural modelling of round geometry, Cyberworlds 2016,
  DOI 10.1109/CW.2016.19): split operations on curved surfaces. Our band cut is a simple version of this.

**For us:** wall straightening after the band cut (Lerm) could remove the one-tile notches and ragged partitions.

### Furniture in irregular rooms

- AnyHome ([arXiv 2312.06644](https://arxiv.org/pdf/2312.06644)): anchor pieces first, then a free-space mask updated
  after each placement; rules for corners, wall sections and the centre of what is left.
- Svobodová and Janků (2021): simulated annealing divides a room into functional zones, then a genetic algorithm places
  furniture within each zone; not limited to rectangular rooms.

**For us:** designs already lay out a rectangular core; zones first, then pieces, would suit the curved leftovers.

### Curved walls on a tile grid (rendering)

- **Dual grid:** tiles drawn half a cell offset from the map grid, chosen by marching squares from the four cells under
  their corners; Oskar Stålberg's scheme needs 15-16 tiles instead of 47 and gives rounded corners.
  [Boris the Brave, Quarter-Tile Autotiling](https://www.boristhebrave.com/2023/05/31/quarter-tile-autotiling/),
  [TileMapDual](https://github.com/pablogila/TileMapDual).
- **45-degree wall pieces:** dedicated diagonal tiles that still fit the grid
  ([RPG Maker](https://www.rpgmakerweb.com/blog/make-your-own-diagonal-walls)).
- Townscaper's relaxed irregular quad grid ([Boris the Brave](https://boristhebrave.com/docs/sylves/1/articles/tutorials/townscaper.html))
  gives organic shapes but needs a non-square map; it does not fit our square tile sim.

**For us:** the stair-stepped look of round walls can be fixed where it is drawn, not where it is generated: diagonal or
dual-grid wall pieces from the Blender pipeline would make a round hull read as round, with the sim grid unchanged. This
is an art and render task, outside the generator.

## Generator techniques (fourth pass, October 2026)

A pass on procedural generation methods only, from games and papers.

### Flow graph first, geometry second

- **Enter the Gungeon** ([Boris the Brave](https://www.boristhebrave.com/2019/07/28/dungeon-generation-in-enter-the-gungeon)):
  each floor starts from one of a handful of hand-made flows (4 to 8 per stage), graphs with no positions, each built
  round a notable feature (a big loop, a many-way fork, a route through the shop). Rooms are then injected by rule
  (type, placement rule, chance, preconditions: secret rooms at dead ends, jails, extra vendors). Hand-made room templates
  are assigned to nodes, loops are laid out first and trees after, and failures fall back to path-found corridors.
  Lessons: generate the most important parts first; plan pacing on the abstract graph, not the tile map.
- **Dormans, mission and space grammars** ([Karavolos, Bouwer, Bidarra 2015](https://graphics.tudelft.nl/Publications-new/2015/KBB15)):
  a graph grammar writes the mission (tasks, locks and keys), then a shape grammar turns it into space. Cyclic generation
  ([Boris the Brave on Unexplored](https://www.boristhebrave.com/2021/04/10/dungeon-generation-in-unexplored/)) builds
  round loops instead of trees.
- **Ma et al., "Game Level Layout from Design Specification"** (Eurographics 2014,
  [HAL](https://hal-univ-tlse3.archives-ouvertes.fr/INRIA/hal-00927311)) and its successor **Edgar**
  ([Nepožitek](https://github.com/OndrejNepozitek/Edgar-DotNet)): a connectivity graph plus room templates (an outline
  polygon and door positions) become a layout; configuration spaces give where two templates can meet, and the graph is
  laid out chain by chain. Edgar recommends fewer than 30 rooms.

**For us:** a few hand-made flows per station kind (a market loop, a military keep with one way in, a works spine),
with set pieces injected by rule; the important parts placed first (heart, concourse, docks, secure core), the rest
fitted round them. Chain-by-chain layout suits departments (a few rooms each), not whole stations.

### Set pieces after analysis (Brogue machines)

[Brogue wiki](https://brogue.wiki/wiki/Level_generation): the level is dug, then analysed for loops and chokepoints, and
only then are "machines" placed: set pieces that build themselves (vaults, traps, guarded treasure) where the analysis
says they fit, with connectivity checked so nothing is cut off.

**For us:** a station analysis pass (chokepoints, loops, depth from the docks), then set pieces placed by it: customs at
the chokepoint between the docks and the concourse, the guard post at the heart's one way in, a brig at a dead end.

### Rotational symmetry

Symmetric generators build part of a level and join rotated copies (a half rotated 180 degrees, in CTF and puzzle
generators); radial modes remain rare ([dungeongen](https://github.com/benjcooley/dungeongen) lists them as planned).

**For us:** build one section of a round station (its spoke, rim bastions and band cut) and copy it round the centre,
then vary only what fills it. Quarter turns are exact on the tile grid.

### Quality diversity

MAP-Elites keeps the best layout per niche of a few measures instead of one best overall
([constrained MAP-Elites for dungeons](https://arxiv.org/pdf/1906.05175), [FI-MAP-Elites](https://github.com/konsfik/FI-MAP-Elites)).

**For us:** a few candidates per station, keeping the best by score, would lift quality at about 300 ms each; niches
(layout family, openness, district mix) would keep stations from converging on one look.

### History in passes (Caves of Qud)

[GDC 2018](https://gdcvault.com/play/1024990/Procedurally-Generating-History-in-Caves),
[Grinblat and Bucklew, FDG 2017](https://pcgworkshop.com/archive/grinblat2017subverting.pdf): ruins are generated in
several passes from the cultures that occupied them, each pass adding finer detail.

**For us:** a station in passes: its builders' layout, a later owner's changes (rooms given new roles, a wing added in
another style), then wear.

## Plan

What came of this plan, and what was tried and dropped, is in [STATIONGEN.md](STATIONGEN.md).

1. Courts: constrained growth on the band, rectangles first, L-growth last, room seeds sized from the plan, a court
   seed in the middle; split strips along long straight runs. (Prototype in progress on `shipgen-stations-1`.)
2. Audit: space syntax depth and integration; a two-routes metric for key rooms.
3. Generation: score and repair before reseeding.
4. Fit: an improvement pass after greedy placement.
5. Stations: zoning (prototype next), then a landmark and set pieces per kind, then phased growth (history).
