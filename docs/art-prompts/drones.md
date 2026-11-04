# Prompt: drone and drone bay art for cc-ftl

(Paste `common.md` above this prompt.)

**Branch:** `art/drones`, based on `main`.

**Task:** design and build the DRONES (three types) and the DRONE BAY module. The look is open: I'll direct it in previews.

**Context:**
- Design: `docs/DESIGN.md` "Drones (user decisions, 2026-11-04)". Issue #318.
- The sim is being built on branch `drones/core-318`, with code-drawn placeholders. Take the sprite ids, the bay's footprint and its access tile from that branch, or agree them with me before you build.
- Drones are small flying machines run by the ship's AI core. They're fully automatic.
- They work inside the ship (flying over modules, not through walls or shut doors) and launch into space.
- They're not crew and not robots. They should read as a separate family, but match the approved robots, robot bay and weapons.

**The drones** (one shared chassis with per-type parts is fine):
- **Defence:** orbits the ship in space and shoots down missiles and shuttles. It needs a small gun and a muzzle flash frame.
- **Repair:** fixes modules, puts out small fires, and seals hull breaches from outside. It needs a tool arm and a working frame (sparks or spray).
- **Medic:** flies to wounded crew and patches them up. It needs a working frame (a scanning or treatment light).

**Drone sprites, each type:**
- 8 headings (`d0..7`), because drones move freely like turrets do, not on 4 rotations.
- States:
  - flying (a gentle hover, 2–4 frames);
  - working;
  - inert (powered down, lying on the floor or drifting);
  - ion-stunned (a few frames of crackle; a shared overlay is fine).
- A shadow or altitude cue, so a drone over the floor reads as flying. Agree with me how flight height shows.

**Drone bay (`module.droneBay`, 4 rotations like other modules):**
- Holds and recharges 2 drones.
- Drones launch into space through a CEILING HATCH like the weapon hatches, so it doesn't need to touch the hull.
- States:
  - empty;
  - 1 docked;
  - 2 docked;
  - charging (glow on the charge contacts only);
  - hatch opening and closing (`f0..f4`, like the turret deploy frames);
  - unpowered;
  - damaged and destroyed, like the other modules.
- The roof hatch: follow how the weapon hatches draw above the roof plating (#262).

**Space:** drones in space render on the sector view like shuttles. Check `src/render` for how shuttles and projectiles draw at sector scale, and whether drones need a smaller or simpler sprite there.

**First preview:**
- each drone at d0 and d2 in flying and working states, at 1x and 3x, beside a crew member and a module for scale;
- the bay at r0, empty and with 2 docked, in a room with walls.

Render it quickly, then wait for feedback.
