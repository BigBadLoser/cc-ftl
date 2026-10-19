# Prompt: airlock module art for cc-ftl

(Paste the shared project context, `common.md`, above this prompt.)

**Task:** design and build the AIRLOCK module.

**What it is in the game.** The airlock is how crew leave and enter a grid. A shuttle docks at its outer door and crew walk through it to board enemy ships, derelicts and stations. It is also where enemy boarders arrive, so its look should say "entry point".
- Footprint: 1 tile wide, 4 tiles deep, on the hull edge.
  - Row 0 is the OUTER door, which sits on the hull line itself and replaces the hull wall there, like the engines do.
  - Rows 1–2 are the chamber.
  - Row 3 is the INNER door, opening into the ship.
- Four rotations; the rotation gives which hull side it is on.
- **Cycle:** the two doors are never open together. A cycle (pressurise or depressurise) takes about 4 seconds, with both doors shut.
- Unpowered or broken: both doors stay shut.
- It must fit the wall and door language: walls are 1.85 high with a sloped skirt, interior doors are dusty-rose framed portals, and the hull is colour-blocked blue-grey/ochre armour. The outer door is a heavy hull hatch, clearly sturdier than an interior door.

**Sprites the renderer will need:**
- `module.airlock.r{0..3}`: the chamber frame.
- Door states for the inner and outer doors: closed, open, and a few frames each of opening and closing.
- `.cycling`: lights or warning strips active during a cycle. Optionally a red/green status light per door.
- The outer door must also read in the three wall view levels:
  - walls up;
  - cutaway, where the near hull is cut;
  - shortest, where the hull becomes a ghost.
  It belongs to the hull, so follow how the engine bulkhead handles that.

**Look:**
- Clean sci-fi; no brass or industrial pipes (those are for engines).
- Heavy pressure doors, hazard striping on the thresholds, status lights.
- No floor slab.

**Deliver first (quick preview, low samples):**
- r0 and r1 next to hull walls, with a crew member, in each wall view level, at 1x and 3x;
- the door states (closed, opening, open) and the cycling light state;
- one Blender render.

Sprite ids may be renamed at integration.
