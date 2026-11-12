# Catalog: starmap, nodes, sectors and the living galaxy

Terminology: a **node** is one playable grid, a **sector** is a group of nodes, **hyperlanes** link sectors; clusters (provinces) group sectors under a faction.
The map is generated lazily in chunks from the world seed (`sim/galaxy/generator.ts`) and is turn-based (a turn comes from a jump or from waiting).
Fleets of every faction persist, follow agendas, fight each other off-screen and can hunt the player. Code reads "sector" for a node in older places (rename pending).

## Node structures (`content.galaxy.structures`)
| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Asteroid field | `structure.asteroids` | Ore and ice rock field; can host a mining outpost | In game | src/content/galaxy.ts:130; sim/asteroids/*, galaxy/populateSpawn.ts |
| Trade station | `structure.station_trade` | Station with fuel, trade, recruit | In game | src/content/galaxy.ts:20 |
| Military station | `structure.station_military` | Navy depot; blueprints and yard | In game | src/content/galaxy.ts:20 |
| Research station | `structure.station_research` | Blueprints and trade; rare | In game | src/content/galaxy.ts:31 |
| Old derelict | `structure.derelict` | Wreck to salvage; may host a nest | In game | src/content/galaxy.ts:134 |
| Mining, farming and pirate stations as map structures | `-` | Appear only as port kinds, outposts or trader profiles, not as structures | Partial: no structure def | station.mining, station.farming, station.pirate are built through populateSpawn.ts and outposts |

## Map and world features

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Chunked map generator | `-` | Sites, sectors, routes, hyperlanes, gateway nodes, terrain density | In game | sim/galaxy/generator.ts, layout.ts, terrain.ts, sites.ts |
| Clusters (provinces) and territory | `-` | Faction-owned groups of sectors; gates between clusters cost extra fuel and time | In game | sim/galaxy/clusters.ts, territory.ts, costs.ts |
| Hyperspace jump and FTL | `galaxy.jump` | Route, fuel, FTL charge; the ship drops into the target node | In game | sim/galaxy/hyperspace.ts, travel.ts, route.ts; sim/ftl/*; ui/JumpConfirm.svelte |
| Fuel | `-` | Jump fuel, station fuel stock | In game | sim/galaxy/fuel.ts, costs.ts |
| Encounters and interdiction | `-` | Crossings, ambush odds, evade, bribe, fight | In game | sim/galaxy/encounters.ts, encounterOdds.ts, respond.ts; ui/StarmapEncounter.svelte |
| Fleets and NPC traffic | `-` | Persistent fleets with home ports, agendas, rebuilds | In game | sim/galaxy/fleets.ts, agenda.ts, roster.ts, rebuild.ts; content/galaxyFleets.ts |
| Off-screen wars | `-` | Hostile fleets that meet fight in a stats mini-sim; wrecks and news | In game | sim/galaxy/meetings.ts, clash.ts, wrecks.ts, news.ts |
| Heat (notoriety) and hunters | `-` | Kills and captures raise heat; factions send hunters | In game | sim/galaxy/heat.ts, hunters.ts, tuningHeat.ts |
| Stranding and distress tug | `-` | Broken fleets and the player can be towed | In game | sim/galaxy/stranded.ts; ui/StrandedBanner.svelte |
| Opening grace period | `-` | No fights until act one is done or a timer passes | In game | sim/galaxy/grace.ts |
| Event grids | `event:<id>` | Temporary deep-space pocket nodes | In game | sim/galaxy/eventGrid.ts |
| Sector archive and jump | `-` | Nodes persist as packets; the sector is swapped on arrival | In game | sim/sector/* |
| Faction relations | `-` | Pairwise war table and shared standing | In game | content/galaxyRelations.ts; sim/galaxy/relations.ts |
| Node population | `-` | Structures become real ships and stations on first visit | In game | sim/galaxy/populate.ts, populateSpawn.ts |
| Starmap UI | `-` | SVG/GPU map, nebula, clusters, POIs, route preview, drawer, news, stats, sell panel | In game | ui/Starmap*.svelte, ui/starmapGpu.ts; render/starmap/*; app/starmap*.ts |
| Backdrops | `backdrop.*` | Planets, stars, black hole, binary star backdrops behind the node | In game | render/backdrop.ts; 51 manifest assets |
| Hyperlane gates as structures | `-` | The generator uses gateway nodes; no separate gate object | Partial: no object | sim/galaxy/generator.ts:89 |
| Danger bands | `-` | Core, frontier, deep space with things only found there | Planned | issue #382 |
| Fewer empty hops and less dead waiting | `-` | Travel pacing | Planned | issue #171 |
