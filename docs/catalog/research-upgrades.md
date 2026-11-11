# Catalog: research, blueprints and module upgrades

Two ways to unlock content: **research** (a research module works a queued project, paid from stock, `src/sim/research`) or a **blueprint** bought at a research or
navy station (`sim/galaxy/blueprintShop.ts`). Mk II/III core modules, drones, the flak cannon and the weapon upgrades are gated this way. Weapon upgrades are
items that go in a weapon module's slot (`sim/upgrades`). Research cost items are stand-ins: data cores are `item.parts`; artifacts and alien tissue do not exist as items.
Planned: research overhaul with materials from the world and finds that add projects (issue #380).

## Research projects (`content.research`, 19)
| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Reactor Mk II | `research.reactor.mk2` | Unlocks module.reactor.mk2 | In game | src/content/research.ts:25-39 (project()); sim/research/*; ui/ResearchTree.svelte |
| Reactor Mk III | `research.reactor.mk3` | Unlocks module.reactor.mk3 (needs Mk II) | In game | src/content/research.ts:25-39 (project()); sim/research/*; ui/ResearchTree.svelte |
| Shield gen Mk II | `research.shieldGen.mk2` | Unlocks module.shieldGen.mk2 | In game | src/content/research.ts:25-39 (project()); sim/research/*; ui/ResearchTree.svelte |
| Shield gen Mk III | `research.shieldGen.mk3` | Unlocks module.shieldGen.mk3 (needs Mk II) | In game | src/content/research.ts:25-39 (project()); sim/research/*; ui/ResearchTree.svelte |
| Engine Mk II | `research.engine.mk2` | Unlocks module.engine.mk2 | Partial: placeholder art | src/content/research.ts:25-39 (project()); sim/research/*; ui/ResearchTree.svelte |
| Engine Mk III | `research.engine.mk3` | Unlocks module.engine.mk3 (needs Mk II) | Partial: placeholder art | src/content/research.ts:25-39 (project()); sim/research/*; ui/ResearchTree.svelte |
| Repair drone | `research.drone.repair` | Unlocks recipe.drone_repair | In game | src/content/research.ts:48; sim/research/*; ui/ResearchTree.svelte |
| Medic drone | `research.drone.medic` | Unlocks recipe.drone_medic | In game | src/content/research.ts:53; sim/research/*; ui/ResearchTree.svelte |
| Defence drone | `research.drone.defence` | Unlocks recipe.drone_defence | In game | src/content/research.ts:58; sim/research/*; ui/ResearchTree.svelte |
| Flak cannon | `research.weapon.flak` | Unlocks module.flakCannon | In game | src/content/upgrades.ts:60; sim/research/*; ui/ResearchTree.svelte |
| Coolant (upgrade) | `research.upgrade.coolant` | Unlocks recipe.upg_coolant | In game | src/content/upgrades.ts:48; sim/research/*; ui/ResearchTree.svelte |
| Capacitor (upgrade) | `research.upgrade.capacitor` | Unlocks recipe.upg_capacitor | In game | src/content/upgrades.ts:52; sim/research/*; ui/ResearchTree.svelte |
| Housing (upgrade) | `research.upgrade.housing` | Unlocks recipe.upg_housing | In game | src/content/upgrades.ts:56; sim/research/*; ui/ResearchTree.svelte |
| Prism (upgrade) | `research.upgrade.prism` | Unlocks recipe.upg_prism | In game | src/content/upgradesBehaviour.ts; sim/research/*; ui/ResearchTree.svelte |
| Focus (upgrade) | `research.upgrade.focus` | Unlocks recipe.upg_focus | In game | src/content/upgradesBehaviour.ts; sim/research/*; ui/ResearchTree.svelte |
| Frag (upgrade) | `research.upgrade.frag` | Unlocks recipe.upg_frag | In game | src/content/upgradesBehaviour.ts; sim/research/*; ui/ResearchTree.svelte |
| Rail (upgrade) | `research.upgrade.rail` | Unlocks recipe.upg_rail | In game | src/content/upgradesBehaviour.ts; sim/research/*; ui/ResearchTree.svelte |
| Chain (upgrade) | `research.upgrade.chain` | Unlocks recipe.upg_chain | In game | src/content/upgradesBehaviour.ts; sim/research/*; ui/ResearchTree.svelte |
| Thermite (upgrade) | `research.upgrade.thermite` | Unlocks recipe.upg_thermite | In game | src/content/upgradesBehaviour.ts; sim/research/*; ui/ResearchTree.svelte |

## Module upgrade items (`item.upg_*`, 10)

Slot into a weapon module (`ui/module/UpgradePanel.svelte`). Built at a fabricator from the matching blueprint, sold at stations, carried by enemy ships.

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Coolant jacket | `item.upg_coolant` | 30% less heat per volley | In game | src/content/upgrades.ts:10; sim/upgrades/*; art in the `upgrades` sprite family |
| Quick capacitor | `item.upg_capacitor` | Charges 15% faster | In game | src/content/upgrades.ts:14; sim/upgrades/*; art in the `upgrades` sprite family |
| Hardened housing | `item.upg_housing` | Takes half damage from hits and ion | In game | src/content/upgrades.ts:18; sim/upgrades/*; art in the `upgrades` sprite family |
| Prism splitter | `item.upg_prism` | Five shots, each 40% weaker; more heat | In game | src/content/upgradesBehaviour.ts:20; sim/upgrades/*; art in the `upgrades` sprite family |
| Heavy focus | `item.upg_focus` | Two heavier shots, pass one shield layer; slower charge | In game | src/content/upgradesBehaviour.ts:28; sim/upgrades/*; art in the `upgrades` sprite family |
| Frag slug | `item.upg_frag` | Bigger blast, harder on crew and modules | In game | src/content/upgradesBehaviour.ts:36; sim/upgrades/*; art in the `upgrades` sprite family |
| Rail coil | `item.upg_rail` | Passes two shield layers, very fast, very hot | In game | src/content/upgradesBehaviour.ts:54; sim/upgrades/*; art in the `upgrades` sprite family |
| Nuclear warhead | `item.upg_nuke` | Huge blast with fire; two missiles a shot | Partial: black market only | src/content/upgradesBehaviour.ts:62; sim/upgrades/*; art in the `upgrades` sprite family; no recipe or research: only bm.lesser stock (12% chance) and tests |
| Chain coil | `item.upg_chain` | Ion arcs into nearby crew | In game | src/content/upgradesBehaviour.ts:81; sim/upgrades/*; art in the `upgrades` sprite family |
| Thermite | `item.upg_thermite` | Hull damage on top of the fire | In game | src/content/upgradesBehaviour.ts:89; sim/upgrades/*; art in the `upgrades` sprite family |

## Recipes for upgrades

Nine `recipe.upg_*` (coolant, capacitor, housing, prism, focus, frag, rail, chain, thermite) at `module.fabricator`, each gated by `blueprint.upg_*`. **In game**, `src/content/upgrades.ts:27-37` and `upgradesBehaviour.ts:104-114`.

## Blueprints and modules

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Blueprint shop | `-` | Buy blueprints; price grows with danger; Mk III needs standing | In game | sim/galaxy/blueprintShop.ts; ui/BlueprintList.svelte |
| Research module | `module.research` | Bench where crew work projects; several speed it up | Partial: buildable only | no ship template or room places one; see modules.md |
| Research bands | `researchBands` | Power, Defence, Propulsion, Automation tabs | In game | src/content/research.ts:45; ui/ResearchBand.svelte |
| Research overhaul | `-` | Materials from the world, locked weapons, finds that add projects | Planned | issue #380 |
| Reactor, shield, engine art tiers | `-` | Mk II/III art: reactor and shield have own sprites; engine tiers are tinted placeholders | Partial: engine placeholders | issue #105; render/tierArt.ts |
