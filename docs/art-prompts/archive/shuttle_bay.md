# Prompt: shuttle and shuttle bay art for cc-ftl

(Paste the shared project context, `common.md`, above this prompt.)

**Task:** design and build the SHUTTLE and the SHUTTLE BAY.

**What they are in the game.** Ships never move; crew travel between ships, derelicts and stations by shuttle.
- **The shuttle** is an entity, not a walkable grid; you never see its interior.
  - It sits parked on its bay in the home ship.
  - It launches, flies through the sector, docks at an airlock on another grid, and flies home.
  - It carries a pilot and about 4 passengers.
  - It can be shot down, and point defence targets it.
- **Shuttle bay:** a 4x5 INTERIOR floor module (it does not touch the hull), a launch pad with a hatch the shuttle launches through. Reference: the large hexagonal hazard-striped pad in the Space Haven whole-ship screenshot.
  - The 3x3 pads in that screenshot are for mining/construction pods, which come later. Keep the bay design compatible with a smaller pod-bay version.
  - Crew board at a boarding tile beside the parked shuttle.
- The look should sit with the approved consoles, walls (1.85 high), dusty-rose doors and colour-blocked hull.

**Sprites the renderer will need** (ids may be renamed at integration):
- `module.shuttle_bay.r{0..3}`: the pad, with the hatch closed. Plus a few frames of the hatch opening and closing.
- `vehicle.shuttle.parked.r{0..3}`: the shuttle sitting on its pad.
- `vehicle.shuttle.fly.d{0..7}`: flying in 8 directions, for the sector view, with engine glow.
- `vehicle.shuttle.docked.r{0..3}`: docked against a hull airlock's outer door, outside the hull.
- Optional `.damaged` variants, and a launch/landing frame or two.

**Look:**
- A compact, chunky utility shuttle, clearly a small craft. Readable at game scale as "our shuttle" versus an enemy one; a livery or tint area that the roof livery system could recolour is a bonus.
- The pad: hazard striping, light strips, a hatch.
- Clean sci-fi; no brass or industrial pipes (those are for engines).
- No floor slab under the pad beyond the pad itself.

**Deliver first (quick preview, low samples):**
- the bay with the parked shuttle at r0 in a room, with crew for scale, at 1x and 3x;
- the hatch-open frames;
- the shuttle flying at 2–3 directions;
- the shuttle docked at an airlock;
- one Blender render of each.
