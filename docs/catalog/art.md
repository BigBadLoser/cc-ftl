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
| `turret` | 146 | Roof turrets per weapon, 8 directions; ground turret heads `turret.<stem>.ground.d<n>` (+ charged) for the 3x3 asteroid mount |
| `module.<stem>.ground` | 28 | 3x3 ground turret mount on asteroid rock (riser, corner outriggers, junction box), one per cable side `.r0-.r3` (#514) |
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
| Cryo pod | `module.cryo_pod` | Sprite only; not used for prisoners (they go in the stasis wheel, #116) | Art only | manifest |
| Stasis wheel, slab, hover cart | `module.stasis_wheel`, `item.stasis_slab`, `slab.cart`, `slab.floor` | Prisoner holding (#116): the 3x3 wheel (4 rotations) with a slab layer per slot seen through its window, the empty slab as a floor stack, a full slab set down on the floor, the hover cart's 12-frame ring loop. The loading animation, the prisoner's face on a full slab and an unpowered wheel are not rendered yet | Partial | tools/blender/sprites/slab_game.py, slab_floor.py (family `stasis`); render/stasisArt.ts, cartView.ts, slabView.ts; lab panel `stasis` |
| Lamps, deck marks, banner | `module.light_grate/cage/mast`, `module.deck_inlay/hazard`, `module.banner` | Sheets `lights`, `decor` (art only: no def), `landmarks` (the banner and its livery masks `.lv.<emblem>`), copied from the station-generator branch (not re-rendered here); the `decor` sheet also holds unused art | In game (lamps, floor-light art) / buildable only | tools/blender/sprites/lights.py, decor.py, landmarks.py |
| Windows (#516) | `tile.hull.ext.o1.m10.w1`..`.w3`, `tile.hull.ext.o2.m5.w1`..`.w3` (each + `.tint`), `tile.wall.full.m10.win.l/.m/.r`, `tile.wall.full.m5.win.l/.m/.r`, cut down `tile.wall[.low].m10.win.l/.m/.r`, `tile.wall[.low].m5.win.l/.m/.r` (the plain cut / low wall with the window's blue lines on top, windows_iwin_cut.py) | Sheet `windows` (windows.py): the hull's straight runs with a see-through window (w1 the run's lower end, w3 the higher, w2 the middles) and the default walls' interior window (l the post at the lower end); the interior pieces are built in the default walls' look (wall3d_v2, slate rail and lip, the solid ramp with its shelf), the one they were designed on | In game | tools/blender/sprites/windows.py |
| Deck finishes | `tile.floor.heavy`, `tile.floor.clean` (+ `.1` `.2` `.3`), `tile.floor.carpet` | Sheet `deck_finishes` (deck_finishes.py): heavy plate, clean tile with siblings, carpet in greys for the hull paint. Looked at in render lab panel `floor-finishes` | Art only (no placement; the `floor` field and renderer are wired) | tools/blender/sprites/deck_finishes.py |
| Deck markings | `tile.mark.<walkway\|hazard\|keep>.<case>[.f].<nw\|ne\|sw\|se>` | Sheet `deck_marks` (deck_marks.py): transparent quarter-tile decals (walkway line e1, hazard band z2 with square ends, keep-clear q1) that join into any shape; render kind `decal:<qi><qj>` (env_build.quarter_mask). Render lab panel `deck-marks` | Art only (no placement; the mask fields and renderer are wired) | tools/blender/sprites/deck_marks.py |
| Ground power cable | `cable.duct.m<mask>[.w<walls>][.v1-4][.off]` | Sheet `cable` (cable_duct.py): a graphite duct with an orange stripe laid over asteroid ground between base modules no hull joins (#514), a sprite per connection mask with socket plates into modules, a raised lid on plain straights and four fittings on about one straight in four, lamps dark when unpowered. `src/render/groundCable.ts` `cableTileId` picks the id; no sim or view places it yet. Render lab panel `cable` | Art only | manifest; src/render/groundCable.ts |
| Landing pad | `module.landing_pad.r0-r3` | Sheet `landing_pad` (landing_pad.py): the 9x9 outdoor pad of an asteroid surface base (#509), a pale sintered slab raised on its body with a bevelled lip, yellow touchdown ring and crosshair, orange corner lamps and light strips in its sides, and a service bay in the middle of one side where the ground cable plugs in (turned with the rotation like the ground mounts' port). The pad's sim and view are in progress (#509) | Art only | manifest; tools/blender/sprites/landing_pad.py |
| Shuttle on a landing pad | `vehicle.shuttle.pad.d{0,2,4,6}.f0-f4, .r1-r4` | Sheet `shuttle` (shuttle_gear.py via vehicle_bay.craft_jobs): the transport shuttle standing on its pad on four retractable legs (#509), which swing out of open bays under the engine shoulders and the nose; f0 gear stowed .. f4 down and locked, for the landing and take-off animation; `.r1-r4` gear down with the rear loading ramp opening onto the deck, for crew boarding | Art only | manifest; tools/blender/sprites/shuttle_gear.py |
| Comms console | `module.comms_console` | Sprite only | Art only | manifest |
| Medical console | `module.med_console` | Sprite only | Art only | manifest |
| Sensor console | `module.sensor_console` | Sprite only | Art only | manifest |
| Workbench | `module.workbench` | Sprite only (#320 planned) | Art only | manifest |
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
