# Prompt: engine module art for cc-ftl

(Paste the shared project context above this prompt.)

**Task:** design and build the ship ENGINE module art.

The game logic already exists on branch `m4-combat`. The renderer expects these sprite ids:
- `module.engine.hull.r{0..3}`: the engine's own hull section.
- `module.engine.machine.r{0..3}`, plus `module.engine.machine.r{n}.active` when burning.
- The two layers are drawn hull first, then machine, at the same anchor.

**Hard requirements:**
- **Footprint 4x5 tiles:** 4 tiles along the hull, 5 tiles deep into the ship.
- **Four rotations.** Rotation r tells you which hull side the engine is on.
- **It replaces the outer hull wall where it is placed.** Its outer footprint row sits on the hull line, and the engine carries its own armoured bulkhead there. That bulkhead is part of the engine and **always full height**. It never collapses in the cutaway view, even when the walls around it are cut down. Neighbouring hull walls (plain armoured panels with a trim channel) butt into its ends, so match their profile where they meet.
- **One single large thruster bell**, about 2.6 tiles across at the mouth. It sticks out through the bulkhead into space by about 1.5 tiles.
- **Idle:** a dark open nozzle mouth.
- **Active:** a glowing cyan core plus an exhaust plume.

**Look:**
- The engine is the one module that gets heavy INDUSTRIAL detail: brass fittings, chunky pipes, bolts, flanges, ribbed parts.
- The user likes: brass details, pipes, bolts, and a segmented flared bell with only a few rings, deep shallow-shaded segments and a thick lip.
- Reference photos (the user will attach them): a Space Haven engine screenshot, and a Saturn V F-1 rocket engine. Take from the F-1:
  - the turbopump with big curved ducts into the chamber top;
  - the torus exhaust manifold;
  - the tubes running down the bell;
  - the gimbal struts.
  Translate these into chunky, readable shapes.

**What the user rejected in earlier attempts. Avoid these:**
- Two thrusters in one module (it must be ONE bell).
- Upright capped cylinders at the back. They read as batteries or capacitors, not propulsion.
- Brass valve wheels on posts.
- Bells with too many rings, or slotted or open vanes that read as a wire cage.
- Plumbing that crowds the bell until it loses its flared silhouette.
- Pipes made of lumpy short segments with cube joints. Use smooth curves.
- A plain wall stretch with the engine behind it. The bulkhead must clearly read as part of the engine.
- A floor slab under the machine.
- Small greebles that turn into 2 to 4 px specks.

**Deliver:**
- Blender renders.
- Pixel sprites for r0 and r1, idle and active. Show each on floor tiles beside full-height hull walls, and once beside cut-down walls, with crew for scale, at 1x and 3x.
- Then the remaining rotations once the look is approved.
