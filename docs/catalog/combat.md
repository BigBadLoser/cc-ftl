# Catalog: combat

Ship-to-ship combat, hand-weapon fighting, boarding, capture and the enemy AI. Ship weapons (`weapons.ts`) and their modules are in `items.md` and `modules.md`.
Everything below the pipeline marker runs from `src/sim/pipeline.ts` (combat block starts at `outpostSystem`). Fights are real-time with charged weapons;
the player's crew man consoles, boarders cross by shuttle, and the enemy AI issues ordinary commands.

## Ship combat systems
| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Combat state | `combatStateSystem` | Decides who is a combatant and whether consoles are needed | In game | sim/systems/combatState.ts; sim/combat/* |
| Targeting | `targetingSystem` | Weapon target validation and tile aiming | In game | sim/systems/targeting.ts, combat/targets.ts, shipAim.ts; ui/combat/WeaponBay.svelte |
| Weapon charge and fire | `weaponChargeSystem, firingSystem` | Charged volleys, ammo use | In game | sim/systems/weaponCharge.ts, firing.ts, combat/ammo.ts |
| Projectiles and impacts | `projectileSystem, impactSystem` | Flight, effects on hull, modules, crew, shields | In game | sim/systems/projectiles.ts, impacts.ts, combat/effects.ts |
| Point defence | `pointDefenceSystem` | Shoots missiles; AI core runs it; also hits drones and shuttles | In game | sim/systems/pointDefence.ts, vehicleDefence.ts |
| Shields | `shieldSystem` | Layers absorb shots, recharge; pierce and bypass rules | In game | sim/systems/shields.ts; tiers Mk II, III |
| Heat, vent, overcharge | `heatSystem, heatAiSystem` | Combat heat from volleys, lockout, radiators, overcharge buttons | In game | sim/systems/heat.ts, heatAi.ts; ui/combat/HeatGauge.svelte, OverchargeButtons.svelte |
| Ion | `ionSystem` | Disabled-module timers | In game | sim/systems/ion.ts |
| Helm, evasion, FTL charge | `helmSystem` | Evasion from engines, FTL charge for fleeing | In game | sim/systems/helm.ts, ftl/*; ui/FtlCharge.svelte, FleeButton |
| Enemy AI | `enemyAiSystem` | Doctrine (weapons, shields, random), targeting, boarding launches | In game | sim/systems/enemyAi.ts; ShipDef.doctrine |
| Ship state and wrecks | `shipStateSystem` | Hull and module damage, breaches, destruction into a wreck | In game | sim/systems/shipState.ts, combat/wreck.ts, hull.ts |
| Hopeless / subdued / idle | `combatStateSystem` | Enemies stop, surrender or flee when beaten | In game | sim/combat/hopeless.ts, subdued.ts, idle.ts |
| Fire and incendiary | `fireSystem` | Fires burn, spread, consume oxygen; incendiary rounds ignite | In game | sim/systems/fire.ts, itemFire.ts |
| Provocation and truce | `provocationSystem, truceSystem` | Boarding or firing on a neutral turns it hostile; black-market truce | In game | sim/systems/provocation.ts, truce.ts, combat/provoke.ts |
| Fight report | `-` | End-of-fight summary card | In game | app/fightReport.ts; ui/combat/FightReportCard.svelte |
| Cruise and chase | `-` | Pursuit, intercept, departure of fleeing ships | In game | sim/combat/cruise.ts, intercept.ts, departure.ts |

## Boarding and capture

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Boarding party | `boardingAiSystem, boardingSiteSystem` | Shuttles launch crew to an airlock; recall; stranded parties | In game | sim/boarding/*; sim/systems/boardingAi.ts; ui/combat/BoardPicker.svelte, BoardingCard.svelte |
| Boarding defence | `crewCombatSystem` | Crew on the boarded ship fight intruders | In game | sim/systems/crewCombat.ts; sim/fight/* |
| Sabotage orders | `sabotageResumeSystem` | Boarders sabotage modules; pause and resume with hostiles in sight | In game | sim/boarding/sabotage.ts, resume.ts |
| Capture a ship (prize) | `captureSystem` | Hold a subdued ship; claim it as a prize and strip loot | In game | sim/capture/prize.ts, control.ts; ui/PrizePanel.svelte |
| AI core raid | `coreRaidSystem` | Zealots tear out a core; the player can hold a core to capture robots | In game | sim/capture/coreRaid.ts |
| Surrender | `-` | Hurt or outnumbered crew surrender (cowards sooner; brave never) | In game | sim/fight/surrender.ts |
| Prisoners | `-` | Surrendered enemy crew get a `PrisonerC` on capture; crew seal them into stasis slabs and hold them in a stasis wheel (`stasis` hauling job; reserve and thaw) | Partial: held only on the ship they are on; no escort, ransom or sale | sim/capture/prize.ts sets it; sim/stasis/* holds them (#116 slice 1); app/stasisAlert.ts |
| Derelict boarding and salvage | `salvageSystem` | Strip wrecks into scrap by type; hostile egg sacs | In game | sim/salvage/*; ui/SalvagePanel.svelte |

## Hand weapons and personal combat

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Sidearm | `item.sidearm` | Ranged hand weapon, default human kit | In game | src/content/items.ts:56; sim/fight/arms.ts, equip.ts; render/handWeapon.ts |
| Rifle | `item.rifle` | Ranged hand weapon, security loadout | In game | src/content/items.ts:57; sim/fight/arms.ts, equip.ts; render/handWeapon.ts |
| Ion pistol | `item.ion_pistol` | Ranged hand weapon | Partial: loot and trade only | src/content/items.ts:59; no recipe; sim/fight/arms.ts, equip.ts; render/handWeapon.ts |
| Blade | `item.blade` | Melee weapon | In game | src/content/items.ts:60; sim/fight/arms.ts, equip.ts; render/handWeapon.ts |
| Disruptor | `item.disruptor` | Illegal strong rifle; black market only (uses rifle art) | In game | src/content/items.ts:67; sim/fight/arms.ts, equip.ts; render/handWeapon.ts |
| Breach axe | `crew.human.gear.hand.breach_axe` | Hand-weapon sprite and clips only | Art only | public/assets/1x/manifest.json; no ItemDef (issue #49: "Item definitions for the ten weapons that already have art") |
| Flamethrower | `crew.human.gear.hand.flamethrower` | Hand-weapon sprite and clips only | Art only | public/assets/1x/manifest.json; no ItemDef (issue #49: "Item definitions for the ten weapons that already have art") |
| Heavy repeater | `crew.human.gear.hand.heavy_repeater` | Hand-weapon sprite and clips only | Art only | public/assets/1x/manifest.json; no ItemDef (issue #49: "Item definitions for the ten weapons that already have art") |
| Laser pistol | `crew.human.gear.hand.laser_pistol` | Hand-weapon sprite and clips only | Art only | public/assets/1x/manifest.json; no ItemDef (issue #49: "Item definitions for the ten weapons that already have art") |
| Laser rifle | `crew.human.gear.hand.laser_rifle` | Hand-weapon sprite and clips only | Art only | public/assets/1x/manifest.json; no ItemDef (issue #49: "Item definitions for the ten weapons that already have art") |
| Plasma cutter | `crew.human.gear.hand.plasma_cutter` | Hand-weapon sprite and clips only | Art only | public/assets/1x/manifest.json; no ItemDef (issue #49: "Item definitions for the ten weapons that already have art") |
| Rail rifle | `crew.human.gear.hand.rail_rifle` | Hand-weapon sprite and clips only | Art only | public/assets/1x/manifest.json; no ItemDef (issue #49: "Item definitions for the ten weapons that already have art") |
| Shock baton | `crew.human.gear.hand.shock_baton` | Hand-weapon sprite and clips only | Art only | public/assets/1x/manifest.json; no ItemDef (issue #49: "Item definitions for the ten weapons that already have art") |
| Shotgun | `crew.human.gear.hand.shotgun` | Hand-weapon sprite and clips only | Art only | public/assets/1x/manifest.json; no ItemDef (issue #49: "Item definitions for the ten weapons that already have art") |
| SMG | `crew.human.gear.hand.smg` | Hand-weapon sprite and clips only | Art only | public/assets/1x/manifest.json; no ItemDef (issue #49: "Item definitions for the ten weapons that already have art") |

## Other

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Cover in combat | `sim/fight/los.ts` | Targets behind solid modules get partial cover (lower hit chance) | Partial: passive only | crew never move to cover; crouch and lean clips unused; issue #50 |
| Turret sprites | `turret.*` | 7 roof turret families, aimed in 8 directions | In game | render/turretView.ts; one per weapon module and point defence |
| Torpedo and other weapons | `item.torpedo (art)` | Sprites exist for item.torpedo; no def | Art only | manifest only |
| Combat tutorial | `lesson.combat` | Coach marks for the first fight | In game | ui/lessons/defs/combat.ts |
