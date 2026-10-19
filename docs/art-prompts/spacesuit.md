# Prompt: EVA spacesuit crew layers for cc-ftl

(Paste `common.md` above this prompt. **Branch override:** base `art/spacesuit` on `main`, not `m4-integration`. All approved art is on main now.)

**Task:** a spacesuit for human crew on EVA. EVA means crossing vacuum between grids, walking breached rooms, and boarding derelicts. Build it as crew sprite layers that drop into the existing layered crew system.

**Read first:**
- `tools/blender/sprites/human_render.py`: the layer slots, stack ORDER and the holdout rules;
- `tools/blender/sprites/human_gear.py` and `human_base.py`;
- `src/render/loadout.ts`: how layers are picked at runtime;
- the crew entries in `public/assets/manifest.json`: `crew.human.<slot>.<item>`, with the 8 directions and every existing clip (idle, walk, work, the combat clips, sit, downed and so on).

**The suit:**
- **Layers:** a full-coverage suit as items in the existing slots, so it works with every clip and all 8 directions:
  - `torso.eva` and `legs.eva`;
  - `arm.L/arm.R.eva`, a suited version of the flesh arm. The cyber arm stays visible, or gets its own suited variant; propose one.
  - `gear.head.eva_helmet`: a rounded helmet with a visor. While it is worn, hair and eyes are hidden; the runtime will skip those slots.
  - `gear.back.eva_pack`: a life-support backpack with small thruster nozzles.
- **Colour:** suit colours go through the palette-swap keys (`team.cloth`, `team.accent`), so the suit takes faction colours like normal clothing.
- **Glow:** the visor gets a faint glow, plus tiny pack lights on the glow sheet. Nothing else glows.
- **Silhouette:** chunkier than normal clothes, so a suited crew member reads as "in a suit" from across the ship at 1x. It must still fit the 1.5-unit crew height and the existing holdouts. No clipping through the console chair; sitting in a suit is allowed.
- **EVA float clip, a new clip:** `eva_float`, 8 directions, about 4 frames. Crew drift in vacuum with the body slightly tilted, legs trailing, and small thruster puffs from the pack on the glow sheet. Walking in a suit uses the normal walk clip.
- **Robots** don't need suits, so this is human only.

**First preview:**
- one suited crew member in 3 directions (front, side and back), idle and walk, plus `eva_float` in one direction;
- an unsuited crew member next to them for comparison;
- on floor tiles, with a wall, at 1x and 3x.

Render quickly, then wait for feedback.
