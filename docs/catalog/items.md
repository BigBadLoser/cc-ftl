# Catalog: items, recipes, weapons, crops and ores

Resources, trade goods, hand weapons, the fabricator/scrapper/refinery/galley recipes, ship weapons (`weapons.ts`), crops and ores.
Module upgrade items (`item.upg_*`) and their recipes are in `research-upgrades.md`. Items declare what they turn into with fields
(`vehicle`, `drone`, `hand`, `cargo`), which is why a plain id search misses some of their uses.
Sprites exist for many goods that have no item def (copper, alloy, nanites, stim, medkit, torpedo, artifact and about 25 more): see "Art only" at the end.

## Items
| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Hull scrap | `item.scrap_hull` | Stripped from derelicts | In game | src/content/items.ts:7; flak ammo; scrapper -> metal. sim/shipgen/salvage.ts, recipes.ts |
| Tech scrap | `item.scrap_tech` | Stripped from derelicts | In game | src/content/items.ts:8; scrapper -> electronics, parts |
| Energy scrap | `item.scrap_energy` | Stripped from derelicts | In game | src/content/items.ts:9; scrapper -> parts, electronics, metal |
| Weapons scrap | `item.scrap_weapons` | Stripped from derelicts | In game | src/content/items.ts:10; scrapper -> parts, metal |
| Comfort scrap | `item.scrap_comfort` | Stripped from derelicts | In game | src/content/items.ts:11; scrapper -> polymer, cloth |
| Cloth | `item.cloth` | only recipe.scrap_comfort outputs it | Partial: produced, no consumer | src/content/items.ts:13; no recipe, module or trade list uses it |
| Metal | `item.metal` | core building material | In game | src/content/items.ts:14; costs.ts, modules cost, trade, refinery output |
| Electronics | `item.electronics` | core component | In game | src/content/items.ts:15; refinery (rare ore), scrapper output, trade |
| Polymer | `item.polymer` | building material | In game | src/content/items.ts:17; scrapper output, trade; flammable |
| Spare parts | `item.parts` | fabricator output | In game | src/content/items.ts:19; drone and repair costs; robots repair with it |
| Iron ore | `item.iron_ore` | mined (mining pod) -> refinery -> metal | In game | src/content/items.ts:21; ores.ts |
| Rare ore | `item.rare_ore` | mined -> refinery -> electronics | In game | src/content/items.ts:22 |
| Energy crystal | `item.energy_crystal` | mined | In game | src/content/items.ts:24; reactor fuel (modules.ts reactor fuel); trade |
| Ice | `item.ice` | mined -> refinery -> water + oxygen | In game | src/content/items.ts:25 |
| Water | `item.water` | refined from ice | In game | src/content/items.ts:27; hydroponics planting water; galley input |
| Oxygen | `item.oxygen` | refined from ice | In game | src/content/items.ts:28; life support o2Supply, airlock refills (sim/eva/air.ts) |
| Ration | `item.ration` | galley (water -> ration) | In game | src/content/items.ts:31; crew eat; stations/food.ts |
| Greens | `item.greens` | hydroponics crop | In game | src/content/items.ts:33; galley cooks it |
| Protein beans | `item.beans` | hydroponics crop | In game | src/content/items.ts:34; galley cooks it |
| Medicinal herbs | `item.herbs` | hydroponics crop | In game | src/content/items.ts:35; med bed heals faster with it in stock (sim/crew/treatment.ts) |
| Grain | `item.grain` | crop.grain yields it | Partial: trade good only | src/content/items.ts:36; only trade.ts lists it; nothing consumes it ("A trade good for now") |
| Bland meal | `item.meal_bland` | galley output at low cook skill (recipes.ts:7 tiers) | In game | src/content/items.ts:38 |
| Good meal | `item.meal_good` | galley output | In game | src/content/items.ts:39; greens/beans recipes |
| Fine meal | `item.meal_fine` | galley output at high skill | In game | src/content/items.ts:40; debug farm scenario spawns it |
| Fuel | `item.fuel` | FTL jump fuel | In game | src/content/items.ts:44; sim/galaxy/fuel.ts, ftl/*; trade |
| Missile | `item.missile` | ammo for the missile launcher | In game | src/content/items.ts:45; fabricator recipe; trade |
| Cargo crate | `item.cargo_crate` | delivery-job crate, sim/galaxy/crate.ts | In game | src/content/items.ts:47; no shop entry, by design |
| Shuttle | `item.shuttle` | fabricator makes it | In game | src/content/items.ts:49; vehicle bay turns it into a shuttle (vehicle.assign); sellable |
| Stasis slab | `item.stasis_slab` | An empty stasis slab: crew seal a prisoner into one; a new stasis wheel holds ten; fabricator recipe, sold at trade stations and navy depots | In game | src/content/items.ts; sim/stasis/jobs.ts (seal source), freeze.ts; recipe.stasis_slab |
| Repair drone | `item.drone_repair` | needs research.drone.repair | In game | src/content/items.ts:51; fabricator -> drone bay; sold at research stations |
| Medic drone | `item.drone_medic` | as repair drone | In game | src/content/items.ts:52 |
| Defence drone | `item.drone_defence` | as repair drone | In game | src/content/items.ts:53 |
| Sidearm | `item.sidearm` | hand weapon | In game | src/content/items.ts:56; default human kit; fabricator; sim/fight/arms.ts |
| Rifle | `item.rifle` | hand weapon | In game | src/content/items.ts:57; fabricator; role loadouts |
| Ion pistol | `item.ion_pistol` | no recipe | Partial: loot and trade only | src/content/items.ts:59; shipgen ruinLoot and trade.ts only |
| Blade | `item.blade` | melee hand weapon | In game | src/content/items.ts:60; fabricator; pirates carry them |
| Stolen goods | `item.stolen_goods` | contraband | In game | src/content/items.ts:63; spilled by a broken delivery crate; inspections seize it (sim/inspect) |
| Looted goods | `item.looted_goods` | contraband from captured ships | In game | src/content/items.ts:65; black-market sale (sim/blackmarket/services.ts) |
| Disruptor | `item.disruptor` | illegal hand weapon sold only at black markets (blackMarkets.ts) | In game | src/content/items.ts:67 |
| AI core | `item.ai_core` | sold by the machine bazaar (bm.zealot) | Partial: black-market ware only | src/content/items.ts:69; no recipe, module or system consumes the item (module.aiCore is separate) |
| Robot parts | `item.robot_parts` | sold by bm.zealot | Partial: black-market ware only | src/content/items.ts:70; nothing consumes it (robots repair with item.parts) |
| Drone tech | `item.drone_tech` | sold by bm.zealot | Partial: black-market ware only | src/content/items.ts:71; 5% scrapper extra (recipes.ts:33); nothing consumes it |

## Recipes

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Machine spare parts | `recipe.parts` | Metal + electronics -> spare parts | In game | src/content/recipes.ts:12; sim/items/craft.ts, systems/craftJobs.ts |
| Stasis slab | `recipe.stasis_slab` | Metal + electronics -> an empty stasis slab (fabricator) | In game | src/content/recipes.ts; sim/items/craft.ts |
| Reclaim hull scrap | `recipe.scrap_hull` | Hull scrap -> metal | In game | src/content/recipes.ts:21; sim/items/craft.ts, systems/craftJobs.ts |
| Reclaim tech scrap | `recipe.scrap_tech` | Tech scrap -> electronics, parts (5% drone tech) | In game | src/content/recipes.ts:28; sim/items/craft.ts, systems/craftJobs.ts |
| Reclaim energy scrap | `recipe.scrap_energy` | Energy scrap -> parts, electronics, metal | In game | src/content/recipes.ts:36; sim/items/craft.ts, systems/craftJobs.ts |
| Reclaim weapons scrap | `recipe.scrap_weapons` | Weapons scrap -> parts, metal | In game | src/content/recipes.ts:44; sim/items/craft.ts, systems/craftJobs.ts |
| Reclaim comfort scrap | `recipe.scrap_comfort` | Comfort scrap -> polymer, cloth | In game | src/content/recipes.ts:52; sim/items/craft.ts, systems/craftJobs.ts |
| Refine iron ore | `recipe.refine_iron` | Iron ore -> metal | In game | src/content/recipes.ts:61; sim/items/craft.ts, systems/craftJobs.ts |
| Refine rare ore | `recipe.refine_rare` | Rare ore -> electronics | In game | src/content/recipes.ts:69; sim/items/craft.ts, systems/craftJobs.ts |
| Split ice | `recipe.refine_ice` | Ice -> water + oxygen | In game | src/content/recipes.ts:78; sim/items/craft.ts, systems/craftJobs.ts |
| Print rations | `recipe.ration` | Water -> ration | In game | src/content/recipes.ts:89; sim/items/craft.ts, systems/craftJobs.ts |
| Cook greens | `recipe.meal_greens` | Greens + water -> meal | In game | src/content/recipes.ts:98; sim/items/craft.ts, systems/craftJobs.ts |
| Cook protein beans | `recipe.meal_beans` | Beans + water -> meal | In game | src/content/recipes.ts:107; sim/items/craft.ts, systems/craftJobs.ts |
| Assemble missiles | `recipe.missile` | Metal + electronics -> 2 missiles | In game | src/content/recipes.ts:116; sim/items/craft.ts, systems/craftJobs.ts |
| Build shuttle | `recipe.shuttle` | Metal, electronics, polymer -> shuttle | In game | src/content/recipes.ts:123; sim/items/craft.ts, systems/craftJobs.ts |
| Build repair drone | `recipe.drone_repair` | Parts + electronics -> repair drone (blueprint) | In game | src/content/recipes.ts:131; sim/items/craft.ts, systems/craftJobs.ts |
| Build medic drone | `recipe.drone_medic` | Parts + electronics -> medic drone (blueprint) | In game | src/content/recipes.ts:139; sim/items/craft.ts, systems/craftJobs.ts |
| Build defence drone | `recipe.drone_defence` | Parts + electronics -> defence drone (blueprint) | In game | src/content/recipes.ts:147; sim/items/craft.ts, systems/craftJobs.ts |
| Assemble sidearm | `recipe.sidearm` | Metal + electronics -> sidearm | In game | src/content/recipes.ts:155; sim/items/craft.ts, systems/craftJobs.ts |
| Assemble rifle | `recipe.rifle` | Metal, electronics, polymer -> rifle | In game | src/content/recipes.ts:162; sim/items/craft.ts, systems/craftJobs.ts |
| Forge blade | `recipe.blade` | Metal -> blade | In game | src/content/recipes.ts:169; sim/items/craft.ts, systems/craftJobs.ts |

## Ship weapons

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Burst laser | `weapon.burstLaser` | Three light shots, each strips a shield layer or chips hull | In game | src/content/weapons.ts:9; module.burstLaser; render/turretView.ts |
| Mass driver | `weapon.massDriver` | One heavy slug, pierces one shield layer, breaches walls | In game | src/content/weapons.ts:15; module.massDriver; used by raiders and navy, not by any starter |
| Missile | `weapon.missile` | Guided, ignores shields, point defence can shoot it down, uses item.missile | In game | src/content/weapons.ts:24; module.missileLauncher; Lancer starter |
| Ion cannon | `weapon.ion` | Drains a shield layer, or disables the module hit for 10 s | In game | src/content/weapons.ts:33; module.ionCannon; sim/systems/ion.ts |
| Incendiary | `weapon.incendiary` | Little damage, ignites the impact tile and neighbours | In game | src/content/weapons.ts:39; module.incendiaryLauncher; sim/systems/fire.ts |
| Flak cannon | `weapon.flak` | Scrap-shot spread, each pellet strips a shield layer | Partial: blueprint gated | src/content/weapons.ts:46; module.flakCannon; needs research.weapon.flak; no ship fields it |

## Crops

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Greens | `crop.greens` | Fast, small yield; cooked into meals | In game | src/content/crops.ts:9; sim/farm/* |
| Protein beans | `crop.beans` | Slow, big yield; cooked into meals | In game | src/content/crops.ts:10; sim/farm/* |
| Medicinal herbs | `crop.herbs` | Heals faster in a med bed | In game | src/content/crops.ts:11; sim/farm/* |
| Grain | `crop.grain` | Trade good only | Partial: trade good only | src/content/crops.ts:12; sim/farm/* |

## Ores

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Iron | `ore.iron` | Mined from asteroids by mining pods: iron ore | In game | src/content/ores.ts:8; sim/mining/*, sim/asteroids/* |
| Ice | `ore.ice` | Mined from asteroids by mining pods: ice | In game | src/content/ores.ts:9; sim/mining/*, sim/asteroids/* |
| Rare metals | `ore.rare` | Mined from asteroids by mining pods: rare ore | In game | src/content/ores.ts:10; sim/mining/*, sim/asteroids/* |
| Energy crystal | `ore.crystal` | Mined from asteroids by mining pods: energy crystals | In game | src/content/ores.ts:12; sim/mining/*, sim/asteroids/* |

## Art only (item sprites with no def)

No def, no reference in `src/` (only manifest and `tools/blender`). Not obtainable in play.

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Ai chip | `item.ai_chip` | Sprite only | Art only | public/assets/1x/manifest.json |
| Alien tissue | `item.alien_tissue` | Sprite only | Art only | public/assets/1x/manifest.json |
| Alloy | `item.alloy` | Sprite only | Art only | public/assets/1x/manifest.json |
| Ammo cells | `item.ammo_cells` | Sprite only | Art only | public/assets/1x/manifest.json |
| Artifact | `item.artifact` | Sprite only | Art only | public/assets/1x/manifest.json |
| Carbon | `item.carbon` | Sprite only | Art only | public/assets/1x/manifest.json |
| Circuit | `item.circuit` | Sprite only | Art only | public/assets/1x/manifest.json |
| Consumer goods | `item.consumer_goods` | Sprite only | Art only | public/assets/1x/manifest.json |
| Contraband | `item.contraband` | Sprite only | Art only | public/assets/1x/manifest.json |
| Coolant | `item.coolant` | Sprite only | Art only | public/assets/1x/manifest.json |
| Copper | `item.copper` | Sprite only | Art only | public/assets/1x/manifest.json |
| Data core | `item.data_core` | Sprite only | Art only | public/assets/1x/manifest.json |
| Explosive | `item.explosive` | Sprite only | Art only | public/assets/1x/manifest.json |
| Gas canister | `item.gas_canister` | Sprite only | Art only | public/assets/1x/manifest.json |
| Glass | `item.glass` | Sprite only | Art only | public/assets/1x/manifest.json |
| Gold | `item.gold` | Sprite only | Art only | public/assets/1x/manifest.json |
| Implant | `item.implant` | Sprite only | Art only | public/assets/1x/manifest.json |
| Luxury food | `item.luxury_food` | Sprite only | Art only | public/assets/1x/manifest.json |
| Luxury goods | `item.luxury_goods` | Sprite only | Art only | public/assets/1x/manifest.json |
| Medkit | `item.medkit` | Sprite only | Art only | public/assets/1x/manifest.json |
| Nanites | `item.nanites` | Sprite only | Art only | public/assets/1x/manifest.json |
| Plasma cell | `item.plasma_cell` | Sprite only | Art only | public/assets/1x/manifest.json |
| Power cell | `item.power_cell` | Sprite only | Art only | public/assets/1x/manifest.json |
| Robot scrap | `item.robot_scrap` | Sprite only | Art only | public/assets/1x/manifest.json |
| Sensor | `item.sensor` | Sprite only | Art only | public/assets/1x/manifest.json |
| Servo | `item.servo` | Sprite only | Art only | public/assets/1x/manifest.json |
| Silicon | `item.silicon` | Sprite only | Art only | public/assets/1x/manifest.json |
| Stim | `item.stim` | Sprite only | Art only | public/assets/1x/manifest.json |
| Textiles | `item.textiles` | Sprite only | Art only | public/assets/1x/manifest.json |
| Titanium ore | `item.titanium_ore` | Sprite only | Art only | public/assets/1x/manifest.json |
| Torpedo | `item.torpedo` | Sprite only | Art only | public/assets/1x/manifest.json |
| Wreck core | `item.wreck_core` | Sprite only | Art only | public/assets/1x/manifest.json |

Other gaps: `item.drone_tech`, `item.ai_core`, `item.robot_parts` are sold but not consumed; `wallprop.*` and most `prop.*` sprites are also unused (see `art-and-render.md`).
