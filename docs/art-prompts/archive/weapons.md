# Prompt: weapon module art for cc-ftl

(Paste the shared project context above this prompt.)

**Task:** design and build the ship WEAPON art. Start fresh: none of the previous attempts were accepted.

**Design (decided).** Every weapon is two parts.
1. **Bay:** a floor module that sits anywhere inside the ship, under the roof. It is the breech, power feed and ammo loader that crew service.
   - Light weapons are 2x2 tiles: burst laser, ion cannon, incendiary launcher.
   - Heavy weapons are 3x3 tiles: mass driver, missile launcher.
   - Sprite id: `module.<weapon>.bay.r{0..3}`.
2. **Turret:** sits on the ROOF directly above the bay, about 2.2 units up (flush with the wall tops). It aims at targets and fires.
   - Pre-render 8 aim directions, every 45 degrees.
   - Sprite id: `turret.<weapon>.d{0..7}`, plus `.charged`. d0 points along grid +x, and the directions go clockwise.
   - **Enemy ships** show their roof, so the turret sits on it and is what the player clicks to target that weapon.
   - **The player's own ship** is shown without a roof (cutaway). The renderer draws the turret as a 30% alpha ghost with a thin outline at roof height. You only supply the normal sprite.
   - The turret base should visually connect down through the roof (a mount ring or column).
   - It must be BIG, covering most of its bay's footprint seen from above: about 1.7 tiles across for light weapons, about 2.5 tiles for heavy.

**Deploy and stow (decided).** Turrets fold away into the bay when not in use, and deploy
through a roof hatch when combat starts.
- **Stowed sprite:** `turret.<weapon>.stowed`. A closed armoured hatch or low flush cap on the
  roof. On the player's ship nothing shows.
- **Deploy frames:** `turret.<weapon>.deploy.f{0..4}`. Five frames from stowed to fully up, at
  the d0 facing only. The turret rotates to aim after it is fully up.
- The game plays the frames over about 2 seconds, and weapons can't fire until fully deployed.

**Look:**
- CLEAN military sci-fi: armoured, purposeful, readable.
- **Round barrels.** "When I think weapon, I think round barrel." Use real cylinders with muzzle brakes, shrouds and cooling sleeves.
- **No industrial dressing.** That means no brass, valve wheels, bolts, hatches, junction boxes or exposed pipe runs. That look is reserved for engines.
- Each weapon has a colour identity, shown in emissive accents when charged:
  - burst laser: cyan
  - mass driver: orange (twin rails or a heavy round barrel)
  - missile launcher: red and hazard
  - ion cannon: blue and magenta
  - incendiary: orange fire
- Idle: accents dark.
- The turret must stand out against a mid-grey roof, so use darker armour and value contrast.

**What the user rejected. Avoid these:**
- Square barrels or rails.
- Slab-like, boxy turret heads.
- Brass, pipe and bolt dressing.
- Turrets that are tiny on their bay.
- A washed-out grey turret on the grey roof.
- A floor slab under the bay.
- These three concepts, all rejected: a rounded naval dome gun-house; an open gimbal yoke with a cylinder cannon; a sleek teardrop pod with recessed barrels. Try something else.

**Deliver first:** a concept pass with 2 or 3 genuinely different directions, burst laser plus mass driver only. For each, show:
- the turret on a roof patch, charged, at a 45-degree aim;
- the mass driver bay on floor tiles with a crew member and the 30% ghost turret above it;
- a 1x and a 3x sheet, plus Blender renders.

After the user picks a direction: all 5 weapons, 8 directions, idle and charged, plus bays in 4 rotations.
