# Catalog: ships, factions and ship generation

Hand-made ship templates (starter picks and test hulls), the eight generator styles (`faction.*`, `src/content/factions/`), the eleven galaxy
factions (`src/content/galaxy.ts`) that decide who holds space, and the generated hull families. Two layers exist: a *galaxy faction* (reputation, territory,
fleets, stations) picks one or more *generator styles* to build its hulls. Only three hand-made ships are playable starts; every other ship in the game is generated
(`src/sim/shipgen`, see `docs/SHIPGEN.md`).

## Ship templates (`content.ships`)
| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Wayfarer (Spine Hauler) | `ship.wayfarer` | Balanced start: gun, shield, shuttle, lounge, 4 crew | In game | src/content/ships/wayfarer.ts:11; offered by starterShips.ts / ui/title/ShipPick.svelte |
| Prospector (Claw) | `ship.prospector` | Miner start: big hold, ore refinery, mining pod, 3 crew | In game | src/content/ships/prospector.ts:11; starterShips.ts |
| Lancer (Dart) | `ship.lancer` | Fighter start: missile + 2 lasers, Mk II shield, 4 crew | In game | src/content/ships/lancer.ts:10; starterShips.ts |
| Starter ship | `ship.starter` | Original starter; the default for `newGame()` and the sim tests, not offered in the picker | Debug only | src/content/ships/starter.ts:9; sim/newGame.ts default |
| Debug hull | `ship.debug` | Roomy test hull (55x33): the Wayfarer's systems in three columns of rooms off a 2-wide corridor, with bare floor to spare; `?scenario=stasis` starts on it, `?starter=debug` starts any game on it | Debug only | src/content/ships/debugShip.ts; not in starterShips.ts; app/scenarios/index.ts scenarioStarters, saves.ts starterOf |
| Raider | `ship.raider` | Hand-made hostile used by debug spawns | Debug only | src/content/ships/raider.ts; main.ts:242, scenarios/log.ts, boardingScenario.ts. Real raiders are generated |
| Raider (boarders) | `ship.raiderBoarder` | Raider variant with a boarding doctrine | Debug only | src/content/ships/raider.ts; main.ts:242 |
| Rogue AI shipyard | `ship.rogueShipyard` | Hall run by an AI core: reactor, robot fabricator, bays, one gun | Debug only | src/content/ships/rogue.ts; ui/DebugPanel.svelte only; the galaxy fields no rogue ships (#427) |

## Generator styles (`content.factions`, ship generator input)

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Scrapper | `faction.scrapper` | Salvage hulls welded from donor sections: raider, hauler, gunrunner families | In game | src/content/factions/scrapper.ts:11; sim/shipgen/scrapGrammars.ts, scrapDonors.ts |
| Raider clan | `faction.raider` | Scrapper hulls with a boarding loadout | In game | src/content/factions/pirates.ts:27 |
| Cartel | `faction.cartel` | Scrapper hauler hulls, cargo-heavy | In game | src/content/factions/pirates.ts:60 |
| Zealot | `faction.zealot` | Scrapper hulls crewed by augmented zealots | In game | src/content/factions/pirates.ts:123 |
| Mercenary | `faction.mercenary` | Scrapper hulls, hired guns | In game | src/content/factions/pirates.ts:90 |
| Drones | `faction.drones` | Machine hulls: picket, lancer, swarm; sealed pods on crawlways | Partial: generator only | src/content/factions/drones.ts:9; galaxy rogue faction has `ships: []` (#427), so none spawn in a normal game; scrappers use drone sections as donors |
| Navy | `faction.navy` | Standard-section hulls: corvette, frigate, cruiser, carrier (hangar bays) | In game | src/content/factions/navy.ts:48; sim/shipgen/navyGrammars.ts, topoNavy.ts |
| Civilian | `faction.civilian` | Freighter, liner, mining ship and station hull families | In game | src/content/factions/civilian.ts:9; sim/shipgen/civilGrammars.ts |

## Galaxy factions (`content.galaxy.factions`)

Territory, standing (reputation), fleets, traffic, speciality stock and which structures they own. Relations between pairs are in `src/content/galaxyRelations.ts`.

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Concord Navy | `galaxy.factions.navy` | Government; military stations; sells defence blueprints | In game | src/content/galaxy.ts:16 |
| Meridian Combine | `galaxy.factions.meridian` | Corporation; storage/cargo/vehicle blueprints, cheap fuel | In game | src/content/galaxy.ts:27 |
| Helix Biosystems | `galaxy.factions.helix` | Corporation; life, medical, farming | In game | src/content/galaxy.ts:38 |
| Vantor Heavy Industries | `galaxy.factions.vantor` | Corporation; power, engines, industry, best shipyards (numbers provisional, #125) | In game | src/content/galaxy.ts:49 |
| Free Traders | `galaxy.factions.traders` | Civilian traffic, no territory | In game | src/content/galaxy.ts:61 |
| Scrapper Clans | `galaxy.factions.pirates` | Pirate; scrapper hulls, hostile by default | In game | src/content/galaxy.ts:68 |
| Raider Clans | `galaxy.factions.raiders` | Pirate; boarders | In game | src/content/galaxy.ts:79 |
| The Cartel | `galaxy.factions.cartel` | Pirate; guards routes | In game | src/content/galaxy.ts:88 |
| Zealots of the Signal | `galaxy.factions.zealots` | Niche; only beside machine territory | In game | src/content/galaxy.ts:98 |
| Free Lances | `galaxy.factions.mercenaries` | Pirate; standing starts neutral | In game | src/content/galaxy.ts:108 |
| Rogue AI | `galaxy.factions.rogue` | Always hostile; territory kept for the map but fields no ships, fleets or traffic | Partial: switched off (#427) | src/content/galaxy.ts:117 |

## Hull families (generated)

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Corvette | `navy.corvette` | Small navy escort | In game | src/content/factions/navy.ts hullFamilies |
| Frigate | `navy.frigate` | Mid navy hull | In game | src/content/factions/navy.ts |
| Cruiser | `navy.cruiser` | Heavy navy hull, more depth | In game | src/content/factions/navy.ts |
| Carrier | `navy.carrier` | Navy hull with 3 hangar bays and point defence | In game | src/content/factions/navy.ts |
| Freighter | `civilian.freighter` | Truss/hold hull, many crates | In game | src/content/factions/civilian.ts:30 |
| Liner | `civilian.liner` | Crew-heavy passenger hull | In game | src/content/factions/civilian.ts |
| Mining ship | `civilian.mining` | Ore barge hull | In game | src/content/factions/civilian.ts |
| Station hull | `civilian.station` | Civilian station ring/hub (also built by stationGen) | In game | src/content/factions/civilian.ts |
| Scrapper raider | `scrapper.raider` | Gun hull from navy hulks and drone guns | In game | src/content/factions/scrapper.ts:31 |
| Scrapper hauler | `scrapper.hauler` | Barge and pod-string hold hull | In game | src/content/factions/scrapper.ts |
| Scrapper gunrunner | `scrapper.gunrunner` | Weapon-heavy, scales with depth | In game | src/content/factions/scrapper.ts |
| Drone picket | `drones.picket` | Spoke-shaped machine hull | Partial: generator only | src/content/factions/drones.ts:26 |
| Drone lancer | `drones.lancer` | Truss machine hull | Partial: generator only | src/content/factions/drones.ts |
| Drone swarm | `drones.swarm` | Cluster machine hull | Partial: generator only | src/content/factions/drones.ts |

## Other generated vessels and sites

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Derelict wreck / ruin | `sim/shipgen/ruin*.ts` | A ship hull stripped, aired out and looted; hosts alien egg sacs and salvage | In game | sim/shipgen/ruin.ts; sim/salvage/*; sim/scene/derelicts.ts |
| Asteroid field | `sim/asteroids/*` | Rock fields with ore, mined by pods; outposts dug into big rocks | In game | sim/asteroids/gen.ts |
| Outposts (surface and dug) | `sim/outposts/*` | Station kinds built on or inside rocks; dug pirate bases are hidden until found | In game | sim/outposts/gen.ts; kinds trading, farming, mining, pirate (criminal and covert reuse the pirate station) |
| Alien nests / egg sacs | `sim/aliens/*` | Derelicts with hatching aliens | In game | sim/systems/eggSacs.ts; content/creatures.ts |
| Sealed containers | `sim/shipgen/containerCells.ts` | Detachable cargo containers on freighters | In game | sim/containers/*; content modules container.2x4, container.3x6 |
| Rogue robots on derelicts | `-` | Machine points in the ruin pass, run by an emergency core | Planned | issue #310 |
| Shipgen backlog | `-` | Navy notch, scrapper size, carrier length, drone layout, truss glitches | Planned | issues #119, #103, #129 (engine capacity), #122 (room layout audit) |
