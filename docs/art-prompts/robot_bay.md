# Prompt: robot bay art for cc-ftl

(Paste `common.md` above this prompt.)

**Branch:** `art/robot-bay`.

**Task:** design and build the ROBOT BAY module (`module.robotBay`).

**Context:**
- The sim side exists on branch `robots`: see `src/content/modules.ts`, `module.robotBay`. It's a 1x2 footprint with the cradle on the anchor tile. It uses 3 power and currently borrows the bed sprite.
- Robots return to their bay to recharge and be repaired, like a bed for robots.
- The player also ASSEMBLES new robots in it, so it doubles as a small fabrication cradle.
- It needs 4 rotations, like the other modules.

**States:**
- empty;
- charging (robot docked, glow on the charge contacts);
- assembling (arms or tools active, a partial robot frame);
- unpowered.

**Look:**
- Clean sci-fi that fits the approved consoles and beds.
- A cradle or alcove a robot backs into, with charge contacts and a small status light.
- Glow only on the charge contacts and status light.

**First preview:** the bay at r0 in all 4 states, plus the other rotations, in a room with walls and a human for scale, at 1x and 3x. Render it quickly. Then wait for feedback.
