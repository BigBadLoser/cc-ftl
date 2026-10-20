# Prompt: missile launcher, ion cannon and incendiary launcher art for cc-ftl

(Paste `common.md` above this prompt.)

**Branch:** `art/weapons2`, based on `main`.

**Task:** build the three remaining weapons so they match the approved burst laser (S), mass driver (H) and point defence (R).

**Read first:**
- `tools/blender/sprites/weapons.py` and `turrets.py`, with the approved weapons as the reference;
- the weapons section of `docs/STATUS.md`.

**The weapons:**
- `module.missileLauncher`: 3x3, missiles, with an ammo feed.
- `module.ionCannon`: 2x2, blue ion.
- `module.incendiaryLauncher`: 2x2, fire shells.

See `src/content/modules.ts` and `weapons.ts`.

**Each weapon is two parts, like the approved ones:**
1. a floor BAY, `module.<stem>.bay.r{0..3}`, with the core at full height;
2. a ROOF TURRET with these sprites:
   - `turret.<stem>.d{0..7}`, plus `.charged` variants;
   - `.stowed`;
   - `.deploy.f0..f4`, folding away when not in use.

Use the same anchors, sizes and naming as the approved weapons so they drop straight in.

**Look:**
- Each weapon is distinct and readable at game scale:
  - the missile launcher has a box or rack with visible tubes;
  - the ion cannon has coils or emitter rings, with the blue glow on its charged state only;
  - the incendiary launcher is a stubby mortar or lobber with heat vents.
- Round barrels.
- Glow only on the charged state.
- Keep the approved weapons' material language.

**First preview:**
- all three turrets in 2–3 directions each, plus stowed;
- their floor bays at r0 in a room with walls and a crew member for scale;
- 1x and 3x.

Render it quickly, then wait for feedback.
