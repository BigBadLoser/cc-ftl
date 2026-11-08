# Prompt: the first alien species (derelict infestation) for cc-ftl

(Paste `common.md` above this prompt. **Branch override:** base `art/alien` on `main`, not `m4-integration`.)

**Task:** concept and first creature for the hostile aliens that infest abandoned derelicts. Per `docs/DESIGN.md`, scrapper wrecks and other derelicts are infested with hostile aliens; rogue AI wrecks have robots instead. Away teams board these wrecks and fight through them.

**Read first:**
- `docs/DESIGN.md`: the Crew, Robots and Combat sections;
- the robot art (`tools/blender/sprites/` robot files, and the robot entries in the manifest), as a model of a non-human species with its own sheets;
- `src/render/loadout.ts`, to see how a species picks its sprite layers.

**Creature brief:**
- **A swarm melee hunter**, the infestation's basic unit: low and fast, many-legged or hunched, clearly not a person. It must read as hostile and alien at 1x from across a room, and never be confused with crew or robots.
- **Size:** about 1 tile footprint, and shorter than crew (under 1.5 units). If you think a bigger brute variant makes the fights better, sketch one as an optional second creature, but deliver the basic one first.
- **Look:** organic and chitinous, with a dark base and one sickly accent colour (pick one that doesn't clash with the cyan, orange and magenta used for tech glow). A small bioluminescent glow is fine on the glow sheet. Keep the clean-shapes style rule: smooth shading in flat bands, no slime texture noise.
- **Sprites:**
  - one sheet per creature, not layered, since aliens don't wear gear;
  - 8 directions, using the same naming pattern as crew clips;
  - clips: idle, run, attack (a lunge or slash), hurt, and dead (a corpse that stays on the floor).
- **Optional extra:** an infestation growth "hive" floor and wall overlay, for derelict dressing. Note ideas only; it's in the derelict prompt.

**First preview:**
- the creature in 3 directions, idle and attack;
- next to a crew member and a robot for scale, in a room with walls;
- at 1x and 3x.

Render quickly, then wait for feedback.
