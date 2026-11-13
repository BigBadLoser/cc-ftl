# Catalog: modules

Every ship module, furniture piece and sealed container. 56 module defs are registered (`content.modules` = `modules.ts` + `furniture.ts` + `tiers.ts`);
the build catalog test (`src/app/buildCatalog.test.ts`) requires every def to be reachable from a build tab, so any def here can be built by the player
(Mk II/III and the flak cannon first need a blueprint). "Buildable only" means nothing places it on a ship, so it appears only if the player builds it.
Nine sprite families have no def: cryo pod (not the prisoner holding: that is the stasis wheel), comms/medical/sensor consoles, workbench and three storage variants.

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Reactor | `module.reactor` | Burns energy crystals for the ship's main power: more load burns more, an empty store supplies nothing, and c… | In game | src/content/modules.ts:12; shipgen rooms/engineering.ts, all starters; sim/systems/power.ts, modules.ts, refuel.ts |
| Life support | `module.lifeSupport` | Makes breathable air and scrubs CO2 for the room it sits in. | In game | src/content/modules.ts:30; shipgen, starters; sim/systems/modules.ts, atmosphere.ts |
| Light | `module.light` | A lamp for a floor tile beside a wall. | In game | src/content/modules.ts:50; shipgen, starters; sim/systems/lighting.ts |
| Bed | `module.bed` | Somewhere for a crew member to sleep and recover rest. | In game | src/content/modules.ts:66; shipgen, starters; sim/systems/bedOwners.ts, needs.ts; render/bedPose.ts |
| Console | `module.console` | A general console. | In game | src/content/modules.ts:81; shipgen bridge/engineering; render/assets/fallback.ts |
| Research module | `module.research` | Crew study the ship's active research project here, faster with science. | Partial: buildable only | src/content/modules.ts:101; no ship template or shipgen room places one; sim/research/*, systems/researchJobs.ts use it; 3x2 art |
| Fabricator | `module.fabricator` | Turns metal, polymer and electronics into parts, tools and gear. | In game | src/content/modules.ts:122; shipgen, starters; sim/systems/craftJobs.ts, items/craft.ts |
| Scrapper | `module.scrapper` | Reclaims salvaged scrap into metal, electronics, spare parts and more. | Partial: buildable only | src/content/modules.ts:142; no ship places one (the starter has none); recipes.ts `scrap_*` use it; sim/systems/craftJobs.ts |
| Galley | `module.galley` | Prints hot meals. | In game | src/content/modules.ts:162; shipgen, starters; recipes.ts cooking |
| Storage crate | `module.storage` | A small crate. | In game | src/content/modules.ts:182; shipgen, starters, stations; sim/items/storage.ts |
| Small container | `container.2x4` | A sealed cargo container clamped to the frame. | In game | src/content/modules.ts:201; spawned only by shipgen/containerCells.ts on derelicts/freighters; sim/containers; detachable cargo |
| Large container | `container.3x6` | A large sealed cargo container clamped to the frame. | In game | src/content/modules.ts:209; spawned only by shipgen/containerCells.ts; sim/containers |
| Burst laser | `module.burstLaser` | Fast light laser. | In game | src/content/modules.ts:221; all starters, factions; sim/systems/firing.ts, weaponCharge.ts; render/turretView.ts |
| Flak cannon | `module.flakCannon` | Fires hull scrap in a wide spread: every pellet that hits a shield strips a layer. | Partial: blueprint only | src/content/modules.ts:231; needs research.weapon.flak or a bought blueprint; no ship fields one; weapons.ts:46 |
| Mass driver | `module.massDriver` | Heavy kinetic gun. | In game | src/content/modules.ts:242; faction ships (raider, navy) and stations; buildable |
| Missile launcher | `module.missileLauncher` | Heavy launcher for guided missiles that point defence can shoot down. | In game | src/content/modules.ts:252; Lancer, factions; uses item.missile |
| Ion cannon | `module.ionCannon` | Disables systems with ion charges instead of destroying them. | In game | src/content/modules.ts:262; faction ships and stations; sim/systems/ion.ts |
| Incendiary launcher | `module.incendiaryLauncher` | Throws incendiary rounds that start fires aboard the target. | In game | src/content/modules.ts:272; faction ships and stations; sim/systems/fire.ts |
| Engine | `module.engine` | Pushes the ship and adds evasion in a fight. | In game | src/content/modules.ts:286; all ships; sim/systems/helm.ts, ftl/*; tiers in tiers.ts |
| Airlock | `module.airlock` | Cycles crew between the ship and open space or a docked craft. | In game | src/content/modules.ts:303; all ships; sim/systems/airlock.ts, eva/*; render/airlockArt.ts |
| Shield generator | `module.shieldGen` | Projects shield layers that absorb incoming shots and recharge over time. | In game | src/content/modules.ts:324; all starters, factions; sim/systems/shields.ts |
| Weapons console | `module.weaponsConsole` | Crew at this console run the ship's weapons in combat. | In game | src/content/modules.ts:337; shipgen bridge, starters; sim/systems/operateJobs.ts |
| Shield console | `module.shieldConsole` | Crew at this console run the ship's shields in combat. | In game | src/content/modules.ts:347; shipgen bridge, starters; operateJobs.ts |
| Helm | `module.helm` | The pilot's seat. | In game | src/content/modules.ts:357; shipgen bridge, starters; sim/systems/helm.ts; ui/module |
| Point defence | `module.pointDefense` | Shoots down incoming missiles, enemy drones and shuttles. | In game | src/content/modules.ts:367; starter.ts, shipgen drone-faction ships and stations; sim/systems/pointDefence.ts |
| Radiator | `module.radiator` | Speeds up cooling of the ship's combat heat. | Partial: buildable only | src/content/modules.ts:377; no ship or shipgen room places one; ModuleDef.radiator read by sim/systems/temperature.ts and combat/heat.ts |
| Robot fabricator | `module.robotFabricator` | Builds robots for the ship, a few at a time. | In game | src/content/modules.ts:388; Rogue AI shipyard and ruin shipgen; sim/systems/fabricators.ts. Buildable |
| Robot bay | `module.robotBay` | A charging cradle that recharges and repairs one robot. | In game | src/content/modules.ts:399; shipgen (robot ships), rogue shipyard; sim/systems/robotBays.ts; ui/RobotBayPanel.svelte |
| Drone bay | `module.droneBay` | Docks and recharges two drones. | Partial: buildable, shipgen only for drone factions | src/content/modules.ts:410; sim/drones/bay.ts; ui/DroneBayPanel.svelte; no starter ship has one; drones need research |
| AI core | `module.aiCore` | Runs ship automation such as point defence. | In game | src/content/modules.ts:419; shipgen, rogue ships; sim/robots/core.ts; research.ts |
| Shuttle bay | `module.vehicle_bay` | A pit that holds one shuttle and launches it through hatch doors. | In game | src/content/modules.ts:430; Wayfarer, Lancer, shipgen hangars; sim/vehicles/*; ui/ShuttlePanel.svelte |
| Pod bay | `module.pod_bay` | A pit for one mining or construction pod. | In game | src/content/modules.ts:441; Prospector only (prospector.ts:56); sim/systems/mining.ts; buildable |
| Arcade cabinet | `module.arcade` | An arcade cabinet for one: a break spot (solo). | In game | src/content/modules.ts; sim/ai/machines/leisureSpots.ts; buildable only; art from PR #440 |
| Game table | `module.gametable` | A holographic game table for two: a break spot (social, two stools). | In game | src/content/modules.ts; sim/ai/machines/leisureSpots.ts; buildable only; crew sit on its stools |
| Mess table | `module.mess_table` | A table for the mess. | In game | src/content/furniture.ts:17; shipgen, starters; sim/crew/eating.ts |
| Chair | `module.chair` | A seat. | In game | src/content/furniture.ts:26; shipgen, starters |
| Locker | `module.storage_locker` | A tall locker. | In game | src/content/furniture.ts:34; shipgen, starters; sim/items/storage.ts |
| Storage rack | `module.storage_rack` | Shelving along an aisle, worked from its front side. | In game | src/content/furniture.ts:43; shipgen, starters |
| Cargo pallet | `module.storage_pallet` | An open cargo pallet. | Partial: buildable, shipgen only | src/content/furniture.ts:51; no starter ship has one |
| Ore bin | `module.storage_ore` | A tip bin that takes only ore. | In game | src/content/furniture.ts:60; Prospector, shipgen; refinery stock |
| Large ore bin | `module.storage_ore_large` | A large ore bin. | In game | src/content/furniture.ts:68; Prospector, shipgen |
| Scrap bin | `module.storage_scrap` | A barred cage that takes only scrap. | Partial: buildable only | src/content/furniture.ts:77; nothing places one; art and `storageAccepts` scrap exist; scrapper reads stock anywhere |
| Large scrap bin | `module.storage_scrap_large` | A large barred cage. | Partial: buildable only | src/content/furniture.ts:85; nothing places one; no test other than art |
| Freight container | `module.cargo_container` | A freight container opened from one long side. | Partial: placeholder art | src/content/furniture.ts:94; def asset `module.cargo_container` is not in the manifest (sprite exists as `module.storage_container`); listed ART_PENDING in render/moduleThumb.test.ts:15; shipgen places it |
| Recovery pod | `module.recovery` | A powered tank: hurt crew walk to it and heal to full with no medic, out of action meanwhile; downed crew carried there are stabilised and heal. Critical (downed) patients take it before a med bed; walking ones take a med bed first and the pod only when none is free; herbs x2. | Partial (first pass: buildable, no ship starts with one; HP only, no injuries) | src/content/furniture.ts; sim/crew/recovery.ts, beds.ts, ai/machines/sleep.ts (`recover` drive); render/recoveryArt.ts, podPose.ts |
| Stasis wheel | `module.stasis_wheel` | Holds up to ten prisoners frozen in stasis slabs while powered (draws only while it holds one); built with ten empty slabs; crew seal prisoners on the spot and cart the slabs here (`stasis` hauling job); unpowered or wrecked, each slab runs on a one-hour reserve, then the prisoner thaws hostile | Partial (no in-game art yet, draws the fallback; same-ship only; blueprint at research stations) | src/content/furniture.ts; sim/stasis/*; app/stasisAlert.ts |
| Medical bed | `module.med_bed` | A sickbay cot for patients. | In game | src/content/furniture.ts:103; Wayfarer, Lancer, shipgen medbay; sim/crew/treatment.ts |
| Battery bank | `module.battery` | A bank of power cells. | In game | src/content/furniture.ts:112; shipgen engineering, starters; sim/systems/power.ts |
| Hydroponics bed | `module.hydroponics` | A grow bed. | In game | src/content/furniture.ts:121; shipgen, starters; sim/farm/* |
| Large hydroponics bed | `module.hydroponics_large` | A wide grow bed with three times the yield of the small one. | Partial: buildable only | src/content/furniture.ts:130; nothing places one; sim/farm treats it as a bed |
| Ore refinery | `module.refinery` | Refines raw ore into usable metals. | In game | src/content/furniture.ts:140; Prospector, stations; recipes.ts refining; sim/items/craft.ts |
| Reactor Mk II | `module.reactor.mk2` | 2x3 reactor, 100 power. Blueprint (research or bought). | In game | src/content/tiers.ts:82-88; research.ts; sim/galaxy/blueprintShop.ts; sim/modules/blueprints.ts |
| Reactor Mk III | `module.reactor.mk3` | 2x4 reactor, 180 power. Blueprint. | In game | src/content/tiers.ts:82-88; research.ts; sim/galaxy/blueprintShop.ts; sim/modules/blueprints.ts |
| Shield gen Mk II | `module.shieldGen.mk2` | 2x3 shield, 4 layers. Blueprint. | In game | src/content/tiers.ts:82-88; research.ts; sim/galaxy/blueprintShop.ts; sim/modules/blueprints.ts |
| Shield gen Mk III | `module.shieldGen.mk3` | 3x3 shield, 7 layers. Blueprint. | In game | src/content/tiers.ts:82-88; research.ts; sim/galaxy/blueprintShop.ts; sim/modules/blueprints.ts |
| Engine Mk II | `module.engine.mk2` | Stronger engine, bigger footprint. Blueprint. | Partial: placeholder art | src/content/tiers.ts:82-88; research.ts; sim/galaxy/blueprintShop.ts; sim/modules/blueprints.ts; render/tierArt.ts tint only |
| Engine Mk III | `module.engine.mk3` | Strongest engine. Blueprint; placeholder tint outline art. | Partial: placeholder art | src/content/tiers.ts:82-88; research.ts; sim/galaxy/blueprintShop.ts; sim/modules/blueprints.ts; render/tierArt.ts tint only |
| Cryo pod | `module.cryo_pod` | Sprite only. Not the prisoner holding (prisoners go in the stasis wheel, #116). | Art only | public/assets/1x/manifest.json; no def (rg finds no reference outside tools/blender and docs) |
| Comms console | `module.comms_console` | Sprite only; no def, no system. | Art only | public/assets/1x/manifest.json; no def (rg finds no reference outside tools/blender and docs) |
| Medical console | `module.med_console` | Sprite only. | Art only | public/assets/1x/manifest.json; no def (rg finds no reference outside tools/blender and docs) |
| Sensor console | `module.sensor_console` | Sprite only. | Art only | public/assets/1x/manifest.json; no def (rg finds no reference outside tools/blender and docs) |
| Workbench | `module.workbench` | Sprite only. Only a role/priority label `workbench` in code (sim/crew/components.ts), not a module. | Art only | public/assets/1x/manifest.json; no def (rg finds no reference outside tools/blender and docs) |
| Armory storage | `module.storage_armory` | Sprite only (tools/blender/sprites/storage_set.py). | Art only | public/assets/1x/manifest.json; no def (rg finds no reference outside tools/blender and docs) |
| Cold storage | `module.storage_cold` | Sprite only. | Art only | public/assets/1x/manifest.json; no def (rg finds no reference outside tools/blender and docs) |
| Storage tank | `module.storage_tank` | Sprite only. | Art only | public/assets/1x/manifest.json; no def (rg finds no reference outside tools/blender and docs) |
| Freight container (alt) | `module.storage_container` | Sprite only under this id; the def `module.cargo_container` should use it (see above). | Art only | public/assets/1x/manifest.json; no def (rg finds no reference outside tools/blender and docs) |
