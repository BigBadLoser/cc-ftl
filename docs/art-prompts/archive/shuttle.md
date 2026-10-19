## Project context (shared)

cc-ftl (github.com/bigbadloser/cc-ftl) is a browser isometric ship-colony game (Space Haven building + FTL combat). Read `CLAUDE.md` and the "Asset pipeline" section of `docs/ARCHITECTURE.md` first.

**How art works:**
- All game art is pre-rendered from Blender and then quantised to pixel art. Models are built in Python from primitives under `tools/blender/sprites/`, rendered headless (Cycles CPU) and baked into sprite sheets listed in an asset manifest.
- The renderer never draws game content procedurally.
- Install Blender with `tools/blender/setup.sh`.
- Isometric tiles are 64x32 px.

**Where to start:**
- Base your branch on `walls-tall`. It is `m4-assets` plus the new taller walls and no module slabs, and it has the module helper kit (`detail.py`, `greeble.py`, `cmbkit.py`) and the clipping and floating-part checker (`overlap.py`).
- See the prototype scripts in `tools/blender/review/proto_*.py` for render and composite plumbing.
- You may write your own helpers.

**Hard style rules:**
- Clean shapes with smooth shading quantised to flat bands. No texture noise and no faceting.
- Every detail must be at least 2 px wide at game scale, or it turns to mush.
- Render at 64 or more Cycles samples (or denoise) so nothing speckles.
- **No floor slab, plinth or deck plate under any module.** Modules stand directly on the ship's floor tiles. Feet, cradles and legs are fine.
- Glow (emissive) only where something should glow.
- No clipping parts and no floating parts. Run an overlap check.
- Walls are 1.85 units tall (`walls.HF`); the roof is a 0.2-thick slab on top, so its top is at 2.05 (`roofs.ZR`); the hull rises to 2.05. Derive heights from those constants. Crew are 1.5 units. The low "cutaway" wall view is 0.38.
- **Never copy or commit reference images.** They are visual reference only.

**Deliverables for review.** The user approves before anything is wired in.
- The Blender render.
- The final pixel sprite on floor tiles with walls and a crew member for scale, at 1x and at a 3x nearest-neighbour zoom.
- Push to your own branch. Do not merge to `main`.

# Prompt: shuttle art for cc-ftl

**Task:** design and build the SHUTTLE (vehicle art only). Another session is building the shuttle BAY (the recessed 4x5 pit it parks in). Don't build the bay. A plain placeholder pad for scale is enough.

**What the shuttle is in the game.** Ships never move; crew travel between ships, derelicts and stations by shuttle.
- It is an entity, not a walkable grid, and you never see its interior.
- It parks in its bay inside the home ship, a 4x5-tile interior module. The pad sits at the bottom of a pit recessed into the deck, so the shuttle sits well below floor level.
- It launches through a roof hatch, flies across the sector view, docks against an airlock on another ship's hull, and flies home.
- It carries a pilot plus about 4 passengers and holds cargo (salvage).
- It can be shot down, and enemy point defence targets it.

**Size:**
- When parked it fits a pit about 2.3 wide by 4.0 long (see the dimensions below), with its length along the bay's 5-tile axis.
- It can be taller than the 1.85 walls; that is why it sits in a pit. Most of its height is sunk below the deck, so it stays clear of the roof slab (top at 2.05). Agree the pit depth with the bay (see the note at the end).
- It must read clearly as a small craft next to a 1.5-unit crew member.

**Look:**
- A compact, chunky utility shuttle: think workhorse, not fighter.
- A distinct silhouette that reads at 64x32-tile game scale.
- A cockpit windscreen, an obvious SIDE boarding hatch (crew board from a walkway along the long side), and one or two engines with emissive glow only at the nozzles.
- Clean sci-fi with smooth shading and flat colour bands. No brass or industrial piping (those belong to the engines).
- It should sit alongside the approved art: consoles, the dusty-rose doors and the colour-blocked hull.
- Give it a livery area, flat panels painted in the pure key colours #ff0000 (primary) and #00ff00 (secondary), so the game's roof livery system can recolour it per faction. Keep the base hull a neutral light grey.
- Optional `.damaged` variant (scorches, a broken panel, smoke-free; no particle effects).

**Sprites the renderer will need** (ids may be renamed at integration):
- `vehicle.shuttle.parked.r{0..3}`: parked on its pad in each of the 4 bay rotations, landing legs down.
- `vehicle.shuttle.fly.d{0..7}`: flying in 8 directions, legs up, engine glow on.
- `vehicle.shuttle.docked.r{0..3}`: docked nose or side-on against a hull airlock's outer door, outside the hull.
- `vehicle.shuttle.launch.f0..f3` (optional): rising off the pad.

**Workflow:** preview first.
- Low samples and one Blender process at a time. The machine is shared.
- Send previews before any full build.
- Don't wire anything into `src/` and don't run the full sprite build; integration happens later.

**Deliver first (quick preview):**
- The parked shuttle at r0 on a placeholder 4x5 pad in a room, with walls and a crew member for scale, at 1x and at a 3x nearest-neighbour zoom.
- The shuttle flying in 3 directions.
- One Blender beauty render.

Put your model in `tools/blender/sprites/shuttle_craft.py`, plus a review script under `tools/blender/review/`. Push to a branch named `art/shuttle`.

**Pit depth:** the bay session owns the pit depth. Pick a shuttle height, then size the placeholder pit so the shuttle's top stays under 2.05 above deck level. Report both numbers so the two pieces can be matched.

## Bay dimensions to match (from the bay session, branch `opus-bay`, v8)

The local frame is rotation 0, centred on the 4x5 footprint, with u = grid x and v = grid y.

**Pit and footprint:**
- The pit fills columns x 0..2 across all 5 rows. Opening: u −1.68..0.78, v −2.18..2.18, with all four corners chamfered 0.5.
- The shuttle's centre line is at u = −0.45. Max plan size is about 2.3 across by 4.0 long, and its corners must stay inside the chamfers.

**Depth and height:**
- The pit floor (the launch doors) sits 1.6 below the deck, and the feet rest on the rails at z −1.55.
- The foot clamps are at u −0.45 ± 0.7, v −0.92 and +0.75.
- The shuttle can be at most 3.45 tall above the doors, to stay under the roof slab's underside.

**Boarding:**
- The walkway is column x 3, along the long side.
- The gangway sits at v = 0 and is 0.6 wide. It reaches from u 0.93 to 0.53, with its deck top at z +0.15 above the deck.
- The shuttle's SIDE hatch faces +u and meets the gangway there.

**Sprites:**
- Parked: `vehicle.shuttle.parked.r{0..3}`, using the same anchor as the bay (the centre of the front-most tile).
- Docked: `vehicle.shuttle.docked.r{0..3}`.
- Flying: `vehicle.shuttle.fly.d{0..7}`, with the origin at the craft's centre. d0 points the nose toward grid −y, then the rest go clockwise in 45° steps.
- The bay itself is `module.vehicle_bay`.

**Check the fit:** pull `tools/blender/sprites/shuttle_bay.py` from `opus-bay`.
