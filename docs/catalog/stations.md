# Catalog: stations, outposts, services and black markets

Six station kinds (`content.stations`) built by the station generator (`src/sim/shipgen/stationGen.ts`, three size tiers each: outpost, station, hub),
placed in the galaxy as `structure.station_*` (trade, military, research) or as surface and dug outposts. Services are the things a docked player can do.
Station crews run on the shared crew AI with a director that posts patrol jobs (`sim/systems/stationDirector.ts`).

## Station kinds
| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Trade station | `station.trading` | Market core, big holds, many docks; recruits, jobs, yard | In game | src/content/stations.ts:84; trading hubs; trader profiles in content/trade.ts |
| Research station | `station.research` | Consoles and fabricator benches; sells blueprints | In game | src/content/stations.ts:93; structure.station_research (10% chance per node, lower with danger) |
| Mining station | `station.mining` | Refineries, ore stores; built as a surface mining outpost | In game | src/content/stations.ts:107; sim/outposts/gen.ts; trade profile; no structure.station_mining |
| Agri station | `station.farming` | Quarters, messes, plazas, ration stock | Partial: no hydroponics | src/content/stations.ts:120; chosen by a market profile (populateSpawn.ts:41); the room list has no hydroponics ("No hydroponics beds on stations") |
| Navy depot | `station.military` | Heavy guns, armouries, shipyard (with trade stations); sells defence blueprints | In game | src/content/stations.ts:132; structure.station_military; port kind depot |
| Pirate den | `station.pirate` | Scrappy welded modules, weak defences, loot; hosts lesser black markets | In game | src/content/stations.ts:143; dug into rocks (hidden) or open dens; also reused for criminal and covert outposts |

## Services and station systems

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Trade | `service: trade` | Buy and sell goods; prices by faction, standing and stock | In game | sim/trade/*; ui/TradeWindow.svelte, TradeMarket.svelte |
| Fuel | `service: fuel` | Listed on trade and military stations, but there is no separate fuel service: fuel is bought as `item.fuel` through trade | Partial: tag only | content/galaxy.ts:131-132; sim/galaxy/fuel.ts; no code reads the `fuel` tag |
| Repair | `service: repair` | Listed on stations; nothing implements a paid repair service (crew repair the ship) | Partial: tag only | content/galaxy.ts:131; no `repair` service code found |
| Crew for hire | `service: recruit` | Candidates drawn from hashes of the port; hire and pay | In game | sim/galaxy/recruit.ts; ui/RecruitList.svelte |
| Blueprints | `service: blueprints` | Buy module blueprints; Mk II/III gated by standing | In game | sim/galaxy/blueprintShop.ts; ui/BlueprintList.svelte |
| Job board | `jobs` | Deliveries, bounties, surveys, passage | In game | sim/galaxy/jobs.ts, jobOffers.ts; ui/JobsPanel.svelte |
| Shipyard | `yard` | Station pays contractors to build the hull you plan; trading and military stations of station/hub size | In game | content/yard.ts; sim/yard/*; ui/YardPane.svelte; vantor has a discount (numbers provisional, #125) |
| Docking | `dock` | Dock a shuttle or the ship at a station; station docks and airlocks | In game | sim/galaxy/dock.ts, sim/trade/stationDock.ts; ui/StationDock.svelte |
| Contraband inspections | `inspect` | Patrols board, search holds, seize contraband | In game | sim/inspect/*; scenarios inspect, patrol |
| Station alarm and guards | `alarm` | Intruders and attacks turn station crews hostile | In game | sim/systems/stationAlarm.ts, stationDirector.ts |
| Station food and fuel upkeep | `upkeep` | Station stocks of rations and fuel replenish over time | In game | sim/stations/food.ts, modules/energy.ts |
| Station districts, landmarks, hangar decks | `-` | Zoned rooms, set pieces, shuttle bays on stations | Planned | issues #131, #132, #130, #133; #379 (courts under furniture) is a bug |

## Black markets (`content.blackMarkets`)

Only the lesser set is ever attached to a station in play.

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Back-room dealer | `bm.lesser` | Stolen goods, looted goods, disruptors, rare nukes; fence; shady crew hire; truce | In game | src/content/blackMarkets.ts:13; attached to about a quarter of pirate or lawless stations (sim/galaxy/populateSpawn.ts:64) |
| Cartel market | `bm.cartel` | Bigger contraband stock, fence, truce | Partial: never spawned | blackMarkets.ts:21; the file header says the galaxy does not spawn the named markets yet; only tests attach it |
| Machine bazaar | `bm.zealot` | AI cores, robot parts, drone tech; zealot prices and hail rule | Partial: never spawned | blackMarkets.ts:29; sim/trade/augmentation.ts; no galaxy attach |
| Hiring hall | `bm.mercenary` | Shady crew for hire | Partial: never spawned | blackMarkets.ts:35; no galaxy attach |

Truce and breach rules: `sim/systems/truce.ts`, `sim/blackmarket/truce.ts` (**In game** wherever a lesser market exists).
