# Prompt: airlock art for cc-ftl

(Paste `common.md` above this prompt.)

**Branch:** `art/airlock`, based on `main`.

**Task:** design and build the AIRLOCK module (`module.airlock`).

**Size and layout (user decision):**
- **Inside the ship:** a 2x3 footprint, 3 wide along the hull and 2 deep inboard.
  - Row next to the hull: the door housing in the middle, with a CARGO UNLOADER on each side of the door.
  - Inboard row: a small KEEP-OUT ZONE of marked floor (hazard-edged or lit decking) in front of the door and unloaders, where cargo is unloaded. It stays walkable.
- **In the hull:** the 1-tile hull row behind the door, where the airlock replaces the hull wall (3 wide).
- **Outside:** 1 tile past the hull's outer face, the docking collar with its round docking hatch, where shuttles dock.

Altogether that is the hull tile plus the 2x3 inside plus the 1-tile collar outside.

If the user's reference suggests a different reading (e.g. 2 wide by 3 deep), ask before building.

**Compactness:** it is smaller and more compact than a big armoured block. The door housing is about one tile wide and full height, and the unloaders are low machines beside it.

**The game today:** the airlock is 1x4 (outer door, a 2-tile chamber, inner door), but this art defines the NEW look. The sim footprint change and the cargo unloader behaviour are done at integration, not by you. Report the tile roles you used (door, unloaders, keep-out, collar).

**Context:**
- The sim already exists. The airlock is a 1x4 module that sits in the hull and replaces the hull wall there, like engines do (`hullEdge: n`, rotates with the module).
- From the outside in, its tiles are: the outer door, a 2-tile chamber, the inner door. It cycles in 4 s: the outer door opens to space and the inner door opens to the ship, never both at once.
- Crew pass through it, and shuttles dock against its outer door.
- See `src/content/modules.ts` (`module.airlock`) and how engines replace the hull wall in `src/render/` and `experiments/engine_kestrel_h185/README.md`. Build the airlock's hull piece on the PRODUCTION hull profile in `tools/blender/sprites/walls.py`: same outer face, sloped skirt and 2.05 top.
- Sol left an earlier preview at `art/airlock-preview` (commit 5440f4b). Use it as a starting idea if it helps; it is not approved.

**Reference look (Space Haven airlock):** the user supplied a Space Haven airlock reference screenshot. Ask the user for it, and use it as visual reference only: never trace it, copy it or commit it. The target look:
- A compact, armoured airlock housing set into the hull, with its docking collar projecting OUTWARD past the hull.
- Faceted, angled armour plates with orange accent stripes.
- A big ROUND docking hatch on the outer face: a heavy circular door in a thick ring, with spokes or locking segments, facing out to space for docking.
- On the inboard side, a tall door frame into the ship, with a small status and keypad panel with lights, and a lit strip on top.
- It reads as a heavy, pressure-rated piece of machinery that clearly stands out from the hull wall.

**Docking collar:**
- The airlock must sit well PROUD of the hull, so shuttles and vehicles have room to dock.
- Give it an external docking collar or tube that projects outward past the hull's outer face into space, about 1 tile, with a sealing ring or clamp face at its end.
- That end face is where a shuttle's hatch mates.
- It works like the engine bell: a separate outside layer, `module.airlock.collar.r{n}`, drawn outside the hull and sorted by the tile beyond the hull row.
- Report the collar length you choose. The docked shuttle's position may need to move out to meet it, and that is a code change done at integration, not by you.
- The collar can show a docked state: the clamps engaged and the seal light green.

**Wall view levels:** the airlock housing is NEVER cut away.
- Like doors and the engine bulkhead, it stays full height in Up, Cutaway and Low.
- Only the plain hull wall on either side collapses to the ghost or skirt, as usual.
- Show it in all three levels to prove this.

**Sprites needed:**
- the module in 4 rotations;
- door states: both closed, inner open, outer open, plus 2–3 frames of each door opening;
- the chamber with a cycle light (red while cycling, green when ready);
- an optional "shuttle docked" collar or clamp detail on the outer face.

**Look:**
- It should sit with the approved doors (dusty rose), walls and engine.
- Make it a clearly heavier, pressure-rated door compared with interior doors.
- Use hazard striping sparingly.

**First preview:**
- all 4 rotations;
- the door states;
- the airlock in a hull wall, in Up and Cutaway, with a crew member for scale, at 1x and 3x.

Render it quickly, then wait for feedback.
