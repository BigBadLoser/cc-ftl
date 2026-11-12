# Game catalog: what exists and how far it is wired

This catalog lists everything in the game and says, for each thing, how far it actually goes: a content def, the system that uses it, whether it can appear or be built in play,
and whether it has art or UI. It exists because people and agents kept mistaking a sprite or a design note for a feature (cryo pods are the standing example: the sprite exists,
`DESIGN.md` says "already in the game", and there is no module def or system). When in doubt, trust this catalog over `DESIGN.md`, and trust the code over both.
It was built on 2026-11-11 from the code at `main` (a read-only survey with ripgrep and a registry dump), not from the docs; statuses were spot-checked against the code.
Entries cite `file:line` of the def plus the system or render file that uses it; line numbers drift, ids do not.

## Status legend

Every entry has exactly one status.

- **In game:** a content def exists, the sim uses it, it can actually appear or be built in play, and it has art or UI where that applies.
- **Partial:** some of that holds; the status text says what is missing (for example "buildable only", "tag only", "never spawned").
- **Art only:** a sprite or manifest entry with no def and no system.
- **Defined, unused:** a def or component that nothing references.
- **Debug only:** reachable only through debug commands, scenarios or dev tools.
- **Planned:** only in docs or open issues. Listed briefly at the end of an area, with the issue number.

## Areas

Counts are table rows per status (each row is one entry, so a row that groups several things counts once).

| Area | Covers | In game | Partial | Art only | Defined, unused | Debug only | Planned |
|---|---|---|---|---|---|---|---|
| [modules](catalog/modules.md) | Modules, furniture, containers, tiers; module art with no def | 41 | 12 | 9 | 0 | 0 | 0 |
| [items](catalog/items.md) | Items, recipes, ship weapons, hand weapons, crops, ores; item sprites with no def | 67 | 8 | 32 | 0 | 0 | 0 |
| [crew](catalog/crew.md) | Species, roles, skills, backgrounds, traits, needs, mood, breaks, bonds, schedules | 95 | 8 | 0 | 0 | 0 | 4 |
| [ships-factions](catalog/ships-factions.md) | Ship templates, generator styles, galaxy factions, hull families, derelicts | 36 | 5 | 0 | 0 | 4 | 2 |
| [stations](catalog/stations.md) | Station kinds, services, shipyard, black markets | 15 | 6 | 0 | 0 | 0 | 1 |
| [combat](catalog/combat.md) | Ship combat, boarding, capture, hand weapons, cover | 29 | 3 | 11 | 0 | 0 | 0 |
| [drones-vehicles-robots](catalog/drones-vehicles-robots.md) | Drones, shuttles, pods, robots | 13 | 1 | 0 | 0 | 0 | 4 |
| [research-upgrades](catalog/research-upgrades.md) | Research, blueprints, weapon upgrades | 28 | 5 | 0 | 0 | 0 | 1 |
| [economy](catalog/economy.md) | Trade, traders, jobs, contraband, hauling, production | 37 | 0 | 0 | 1 | 0 | 3 |
| [events-story](catalog/events-story.md) | Events, scenes, goals, lessons, story engine | 27 | 0 | 0 | 0 | 0 | 5 |
| [galaxy-starmap](catalog/galaxy-starmap.md) | Map generator, structures, jumps, fleets, wars, heat, starmap UI | 21 | 2 | 0 | 0 | 0 | 2 |
| [environment](catalog/environment.md) | Air, power, fire, heat, light, rooms, hull, roof | 20 | 0 | 0 | 0 | 0 | 4 |
| [ui](catalog/ui.md) | Windows, panels, menus, kit | 26 | 4 | 0 | 1 | 1 | 1 |
| [dev-tools](catalog/dev-tools.md) | Scenarios, debug commands, labs, profilers, test tools | 0 | 0 | 0 | 0 | 36 | 0 |
| [art](catalog/art.md) | Manifest families, art-only sprites, render systems | 9 | 0 | 13 | 0 | 0 | 3 |
| **Total** | | 464 | 54 | 65 | 2 | 41 | 30 |

## Commonly confused

Things people believe exist and do not (or only partly), and the reverse.

- **Cryo pods** (`module.cryo_pod`): sprite only. No def, no system. Prisoner holding is issue #116. `DESIGN.md` ("Holding prisoners") wrongly says "already in the game".
- **Prisoners:** captured crew get a `PrisonerC` (`sim/capture/prize.ts`) but there is nowhere to hold them and no ransom or sale.
- **Workbench, comms console, medical console, sensor console, armory/cold storage, storage tank:** sprites only (workbench is issue #320; `workbench` in code is a work-priority label).
- **Rogue AI faction:** the faction, its ship generator (`faction.drones`), a shipyard template and a terminal event exist, but the galaxy fields no rogue ships (`ships: []`, issue #427). You do not meet machine fleets in a normal game.
- **Black markets:** only `bm.lesser` is ever attached to a station. The cartel market, machine bazaar and hiring hall are defined and tested but never spawned. `item.ai_core`, `item.robot_parts`, `item.drone_tech` are sold there and consumed by nothing.
- **Station fuel and repair services:** listed as tags on trade and military stations; no code implements a repair service, and fuel is simply bought as an item.
- **Agri station:** the station kind exists but has no hydroponics beds.
- **Ten hand weapons with art** (laser pistol, shotgun, SMG, plasma cutter...): no item defs (issue #49). Likewise about 32 goods with item sprites (copper, nanites, stim, torpedo, artifact...). Research costs use `item.parts` and `item.rare_ore` as stand-ins for data cores and artifacts.
- **Cover in combat:** targets do get cover from solid modules, but crew never seek it (issue #50).
- **Lessons:** the engine is general, but only two lessons exist (combat, hail).
- **Research module:** buildable but placed on no ship, so research needs the player to build one first. Same for the scrapper, radiator and large hydroponics bed ("buildable only").
- **Freight container art:** `module.cargo_container` points at an asset that is not in the manifest (the sprite is `module.storage_container`), so it draws a placeholder.
- **Zealot "augmented" crews:** a stand-in body; real implants are phase 7 (issue #311).
- **Construction pods and drones, logistics robot, water purifier, arcade/recovery pod:** planned only, even though `module.pod_bay` text mentions construction pods.
- **Trader profile `trader.corp`:** matches `faction.corp`, which nothing uses. The corporations trade through navy and civilian profiles.
- **Starter ships:** the picker offers Wayfarer, Prospector and Lancer. `ship.starter`, `ship.raider` and `ship.rogueShipyard` are test or debug hulls; real enemies are generated.
- **Hyperlane gates, mining/farming/pirate "structures":** the map has gateway nodes and port kinds, not separate gate or structure objects for these.
- **Engine Mk II and III:** work in play but use a tinted outline as placeholder art (issue #105). Reactor and shield Mk II/III have real art.
- **Habit traits** (drinker, stim-hooked) and the three phobias (fire, dark, spacewalk): defined but not rollable; only the phobias have effect code.

## Keeping it current

A PR that adds, removes or changes the wiring of content (a module, item, weapon, species, trait, faction, station kind, event, UI window, scenario, or the art that backs one)
updates its line in the matching `docs/catalog/<area>.md` in the same PR, including the status when it changes (a sprite getting a def moves it from "Art only" to "Partial" or "In game").
New areas get a file here and a row in the table above. Counts in the table above are row counts; recount when rows change. Docs-only fixes to this catalog go straight to `main`.
If a statement here disagrees with the code, the code wins: fix the catalog.
