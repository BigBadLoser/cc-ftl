# Catalog: art and rendering

The sprite manifest (`public/assets/1x/manifest.json`, 8,412 asset ids in the families below) is built by the Blender pipeline (`npm run sprites`). A manifest entry is **not** content:
a sprite can exist with no def and no system behind it. This file lists the art-only leftovers and the render systems. Per-content art status (a def whose sprite is missing) is in each area file.
Method: an id counts as art-only when its `family.name` string appears nowhere in `src/` outside tests (checked with ripgrep; dynamically built ids such as `${stem}.d0` are the one thing it can miss).

## Manifest families
| Family | Assets | Used for |
|---|---|---|
| `tile` | 2,610 | Floors, walls, hull sides, doors, vacuum, corners |
| `roof` | 1,507 | Roofs and roof parts per module and hull |
| `module` | 1,498 | Module bodies, states (empty/full, damaged, rotations) |
| `rock` | 601 | Asteroid rock walls and tiles |
| `container` | 427 | Detachable cargo containers |
| `fx` | 338 | Shots, explosions, shields, muzzle flashes |
| `item` | 280 | Floor stacks (s/m/l/unit/held), UI icons |
| `starmap` | 170 | Map nodes, icons, markers |
| `turret` | 146 | Roof turrets per weapon, 8 directions |
| `crew` | 145 | Bodies, hair, legs, gear layers, clips (human, alien, robot) |
| `vehicle` | 120 | Shuttle, mining pod, escape pod |
| `struct` | 112 | Beams and trusses |
| `drone` | 108 | Repair, medic, defence drones, shadow |
| `decay` | 105 | Blood, corpses, egg sacs, scratches, frost |
| `wallprop` | 104 | Wall decorations (11 kinds) |
| `backdrop` | 51 | Planets, stars, black hole behind a node |
| `portrait` | 49 | Crew portrait renders |
| `prop` | 41 | Floor props (8 kinds) |

## Art-only sprites (no def, no system)
| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Cryo pod | `module.cryo_pod` | Prisoner holding sprite; planned (#116) | Art only | manifest; DESIGN.md wrongly says "already in the game" |
| Comms console | `module.comms_console` | Sprite only | Art only | manifest |
| Medical console | `module.med_console` | Sprite only | Art only | manifest |
| Sensor console | `module.sensor_console` | Sprite only | Art only | manifest |
| Workbench | `module.workbench` | Sprite only (#320 planned) | Art only | manifest |
| Armory storage | `module.storage_armory` | Sprite only | Art only | manifest; tools/blender/sprites/storage_set.py |
| Cold storage | `module.storage_cold` | Sprite only | Art only | manifest |
| Storage tank | `module.storage_tank` | Sprite only | Art only | manifest |
| Freight container art | `module.storage_container` | Used by `module.cargo_container` (2x3, doors on the short end) | In game | manifest; see modules.md |
| Wall props (11) | `wallprop.beacon, cable, conduit, grille, panel, pipe, pipes, sign, terminal, tray, vent` | Wall decorations; no code places them | Art only | manifest; tools/blender/sprites/wallprops.py |
| Floor props (7) | `prop.barrel, barrels, cable, chair, crates, plant, toolcart` | Floor decoration; only `prop.crate` is used (item held fallback) | Art only | manifest; render/itemView.ts uses prop.crate |
| Item sprites (32) | `item.ai_chip, alien_tissue, alloy, ammo_cells, artifact, carbon, circuit, consumer_goods, contraband, coolant, copper, data_core, explosive, gas_canister, glass, gold, implant, luxury_food, luxury_goods, medkit, nanites, plasma_cell, power_cell, robot_scrap, sensor, servo, silicon, stim, textiles, titanium_ore, torpedo, wreck_core` | Goods with art but no ItemDef | Art only | manifest; see items.md |
| Hand-weapon sprites (10) | `crew.human.gear.hand.breach_axe, flamethrower, heavy_repeater, laser_pistol, laser_rifle, plasma_cutter, rail_rifle, shock_baton, shotgun, smg` | No ItemDef (#49) | Art only | manifest |

Not counted above: 6 `decay.*` and 15 `fx.*` ids (blood, bodybag, corpse, frost, oil, scratch, debris, decal, impact, muzzle, shield_edge, explosion_large and others) have no literal reference in `src/`, but render code builds many of these names dynamically, so they are unverified rather than art-only.

## Render systems (`src/render`)

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Iso scene and layers | `scene.ts, iso.ts, layers.ts, depthSort.ts` | Pixi isometric scene, depth bands, camera | In game | src/render/scene.ts |
| Hull, walls, roofs, rock | `hullPaint.ts, hullArt.ts, roofView.ts, rockRoofView.ts, tiles.ts` | Hull keys, wall tiles, roof art, light-tinted roofs | In game | src/render/ |
| Modules and turrets | `moduleView.ts, moduleArt.ts, turretView.ts, tierArt.ts` | Module states, rotation, turret aim; tier outline for engines | In game | src/render/ |
| Crew rendering | `crewView.ts, crewAtlas.ts, crewSprites.ts, handWeapon.ts, portrait.ts` | Layered crew with gear and clips, portraits | In game | src/render/ |
| Shots, shields, fx | `shotLook.ts, shieldView.ts, fx/*, fxView.ts, beamArt.ts` | Projectiles, shield domes, explosions, atmosphere | In game | src/render/ |
| Vehicles, drones, pods | `shuttleView.ts, podView.ts, droneView.ts, vehicleBayArt.ts` | Craft and bays | In game | src/render/ |
| Starmap rendering | `starmap/*, backdrop.ts` | Map and node backdrops | In game | src/render/starmap |
| Lighting and overlays | `lightTint.ts, wallLight.ts, overlay.ts, overlayDefs.ts` | Light tint, field overlays | In game | src/render/ |
| Procedural placeholder art | `fallback.ts` | Code-drawn stand-ins for missing sprites (e.g. module.cargo_container) | In game | src/render/assets/fallback.ts |
| Render on demand and culling | `-` | Render on demand, cached static layers, per-sprite culling | Planned | issue #123 |
| Enemy interior wall ramp bug | `-` | Enemy ship shows ramp instead of armour underbelly | Planned | issue #261 |
| Old hull ghosts while building | `-` | Hull ghosts displayed | Planned | issue #381 |
