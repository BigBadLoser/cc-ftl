# Prompt: robot crew sprites for cc-ftl

(Paste `common.md` above this prompt.)

**Branch:** `art/robots`.

**Task:** design and build the ROBOT crew sprites.

**Context:**
- The sim side already exists on branch `robots`. Read its `docs/DESIGN.md` robot notes, `src/content/species.ts` and `roles.ts`. That's where the robot species and roles are defined.
- In game, robots currently borrow the human sprites (`src/render/loadout.ts`).
- Crew sprites come from the crew pipeline on `m4-integration`: `npm run sprites -- -- public/assets crew`. It covers 8 directions, the walk, work, idle and sit clips, and the layered loadouts. Study how the human crew sheets are built, and produce robot sheets in the same format so they drop in.

**Robots:**
- `species.robot` (120 hp): worker, repair and security roles.
- `species.robot_heavy` (200 hp, armoured, slower): the security robot.
- Robots don't sleep. They recharge in a robot bay, so they need no sleep pose, but they need a "charging" idle.
- Robots can be wrecked; a "wrecked" frame or pose on the floor is needed.
- Rogue AI robots are hostile and player robots are friendly, so a tint or livery area for faction would be good.

**Look:**
- Readable at game scale next to 1.5-unit humans.
- Distinct silhouettes per type: the worker is utilitarian, the repair robot has tool arms, and the heavy security robot is bulky. The ion-stunned state can be shown with an overlay later.
- Same clean, banded style as the approved humans.

**First preview:** all 3 robot types in 2 or 3 directions, plus the idle, walk and charging poses, next to a human, at 1x and 3x. Render it quickly. Then wait for feedback.
