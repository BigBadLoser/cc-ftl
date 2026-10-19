# Prompt: shield generator module art for cc-ftl

(Paste the shared project context, `common.md`, above this prompt.)

**Task:** design and build the two SHIELD GENERATOR modules.

**What they are in the game.** Shield generators project the ship's energy shield, the bubble that absorbs incoming fire. The shield console (cyan, on the bridge) operates them.
- **Shield generator:** footprint 2x3 tiles, fully solid. Stronger.
- **Small shield generator:** footprint 2x2 tiles, fully solid. Weaker and cheaper.
- Both stand anywhere inside the ship. Each has four rotations.
- The two must have clearly different silhouettes. The small one must not be a shrunk copy of the big one.
- Identity colour: cyan. The approved shield console uses a cyan hexagonal-cell motif (a centre hex plus six neighbours), so echo it.

**Sprites the renderer expects:**
- `module.shield_gen.r{0..3}` and `module.shield_gen_small.r{0..3}`, plus `.active` for each when powered and projecting.
- **Roof part (emitter dish or projector array).** On enemy ships the roof is shown, so this is what the player sees and targets.
  - `roof.shield_gen.stowed` / `roof.shield_gen_small.stowed`: a closed armoured hatch, flush with the roof. The roof plane is 2.4 above the floor.
  - `roof.<id>.deploy.f0` to `f4`: five frames. The hatch opens, then the emitter rises and unfolds (a dish opening, emitter pylons telescoping).
  - `roof.<id>` and `roof.<id>.active`: fully deployed.
  - The emitter deploys when combat starts (about 2 seconds) and stows afterwards. Shields don't come up until it is fully deployed.
  - On the player's ship (cutaway, no roof) the renderer draws the deployed emitter as a 30% alpha ghost, and nothing when stowed. You only supply the normal sprites.
  - It must read as a target: cover roughly 50–70% of the footprint seen from above.
  - The big and small versions should differ on the roof too.

**Look:**
- CLEAN sci-fi, like the approved bridge consoles: smooth gunmetal panels, inset panels, bevels and seams.
- No brass, valve wheels, bolts, hatches, junction boxes or exposed pipes. That industrial look is reserved for engines.
- Colour comes from emissive parts only: field emitter cores, hex-cell panels, coil bands, readouts.
- Light hierarchy: a few bright cyan accents. The rest is muted (dark teal, navy) or unlit. A touch of white or soft blue is fine.
- **Idle (unpowered):** dark, with only small pilot lights.
- **Active:** the emitter core glows and feels energised. If cheap, add a subtle 2–4 frame pulse.
- It must sit directly on the floor. **No floor slab, plinth or wide flat base.** A narrow kick recess at the foot is fine.

**What was tried and was weak. Avoid these:**
- Bodies sitting on a wide low base that reads like a floor slab.
- A small generator that is just a scaled copy of the big one.
- Roof dishes too small to read as targets.
- Spindly side pylons.
- A ghost that includes the whole hatch frame and so looks bigger than the module.

**Deliver first (quick preview, low samples):**
- Both modules at r0, idle and active, on floor tiles beside a 2.4-high wall, with a crew member for scale, at 1x and 3x.
- The deploy strip for both roof parts (stowed, f0–f4, deployed) on a roof patch, at 3x.
- One Blender render of each.

After the user approves the look, render the other rotations at final quality.
