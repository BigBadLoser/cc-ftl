# Prompt: AI core module art for cc-ftl

(Paste the shared project context, `common.md`, above this prompt.)

**Task:** design and build the ship's AI CORE module art.

**What it is in the game.** The AI core is the ship's computer.
- It runs automation and operates the point-defence turrets (separate modules). Point defence works only while the AI core is powered and its sensor mast is deployed.
- Footprint: 2x2 tiles, fully solid. It stands anywhere inside the ship. Four rotations.
- Identity colour: magenta / pink.

**Sprites the renderer expects:**
- `module.ai_core.r{0..3}`, the module standing on the floor, plus `.active` when powered and running.
- **Roof part, the sensor mast.** On enemy ships the roof is shown, so this is what the player sees and targets.
  - `roof.ai_core.stowed`: a closed armoured hatch, flush with the roof (the roof plane sits 2.4 above the floor).
  - `roof.ai_core.deploy.f0` to `f4`: five frames of the hatch opening and the mast rising and unfolding (antenna booms extend, tips light up).
  - `roof.ai_core` and `roof.ai_core.active`: fully deployed.
  - The mast deploys whenever the core is powered and stows when it isn't, over about 2 seconds.
  - On the player's own ship there is no roof (cutaway view). The renderer draws the deployed mast as a 30% alpha ghost at roof height, and nothing at all when stowed. You only supply the normal sprites.
  - The roof part must read clearly as a target: it should cover roughly 50–70% of the module's footprint seen from above.

**Look:**
- CLEAN sci-fi, like the approved bridge consoles: smooth gunmetal panels, inset panels, bevels and seams.
- No brass, valve wheels, bolts, hatches, junction boxes or exposed pipes. That industrial look is reserved for engines.
- Colour comes from emissive parts only: data slits, light bars, a central "eye" or lens, readouts.
- Light hierarchy: a few bright magenta accents. The rest is muted (non-emissive muted magenta or plum, navy) or unlit. A small amount of a second accent (white, soft blue) is fine; not a rainbow.
- **Idle (unpowered):** dark. It keeps a muted magenta tint so it stays recognisable.
- **Active:** it should feel alive and "thinking", for example with readouts and light bars lit. If cheap, add a subtle 2–4 frame idle animation; otherwise keep it static.
- It must sit directly on the floor. **No floor slab, plinth or wide flat base.** A narrow kick recess at the foot is fine.

**What was tried and was weak. Avoid these:**
- a plain box tower with slit arrays;
- a wide low base that reads like a slab;
- a roof part too small to read as a target;
- an idle state that loses its colour identity entirely.

**Deliver first (quick preview, low samples):**
- the module at r0, idle and active, on floor tiles beside a 2.4-high wall with a crew member for scale, at 1x and 3x;
- the mast deploy strip (stowed, f0–f4, deployed) on a roof patch, at 3x;
- one Blender render.

After the user approves the look, render the other rotations at final quality.
