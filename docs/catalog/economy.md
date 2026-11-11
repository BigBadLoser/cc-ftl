# Catalog: economy, trade, jobs and logistics

Credits, station markets (stock per trader profile, prices by faction and standing), the NPC economy (ports produce and consume stock), station jobs,
contraband, crew hire and the crew-run hauling that moves goods inside and between ships. Credits start at 500 (`trade.startCredits`).

## Trader profiles (`content.trade.traders`)

A profile is the stock, price modifiers and credits of a seller, matched by faction and role (or by side). 
| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Freighter | `trader.freighter` | Civilian freighter: metal, scrap, polymer, grain; has a shuttle | In game | src/content/trade.ts:43; sim/trade/traders.ts, pricing.ts |
| Liner | `trader.liner` | Civilian liner: food, electronics, some sidearms | In game | src/content/trade.ts:52; sim/trade/traders.ts, pricing.ts |
| Mining ship | `trader.mining` | Raw ore, ice, crystals | In game | src/content/trade.ts:60; sim/trade/traders.ts, pricing.ts |
| Trade station | `trader.station.trading` | Market hub | In game | src/content/trade.ts:70; sim/trade/traders.ts, pricing.ts |
| Mining station | `trader.station.mining` | Ore, refined metal | In game | src/content/trade.ts:86; sim/trade/traders.ts, pricing.ts |
| Agri station | `trader.station.farming` | Food | In game | src/content/trade.ts:94; sim/trade/traders.ts, pricing.ts |
| Research station | `trader.station.research` | Electronics, parts, blueprints | In game | src/content/trade.ts:98; sim/trade/traders.ts, pricing.ts |
| Navy depot | `trader.station.military` | Arms, missiles, rations | In game | src/content/trade.ts:110; sim/trade/traders.ts, pricing.ts |
| Pirate den | `trader.station.pirate` | Scrap, loot | In game | src/content/trade.ts:118; sim/trade/traders.ts, pricing.ts |
| Station (civilian hull) | `trader.station` | Civilian-faction stations built by the civilian generator | In game | src/content/trade.ts:126; sim/trade/traders.ts, pricing.ts |
| Corporate trader | `trader.corp` | Matches `faction.corp`, which no generator or ship uses; the galaxy corporations fly navy and civilian hulls and trade through those profiles | Defined, unused | src/content/trade.ts:137; sim/trade/traders.ts, pricing.ts |
| Navy quartermaster | `trader.navy` | Missiles, rifles, weapon upgrades | In game | src/content/trade.ts:141; sim/trade/traders.ts, pricing.ts |
| Pirate fence | `trader.pirate` | Scrapper-clan trader | In game | src/content/trade.ts:150; sim/trade/traders.ts, pricing.ts |
| Raider (side fallback) | `trader.raider` | Plain hostile templates | In game | src/content/trade.ts:159; sim/trade/traders.ts, pricing.ts |
| Raider clan | `trader.raider_clan` | Raider faction trader | In game | src/content/tradePirates.ts:18; sim/trade/traders.ts, pricing.ts |
| Cartel | `trader.cartel` | Cartel faction trader | In game | src/content/tradePirates.ts:22; sim/trade/traders.ts, pricing.ts |
| Zealot | `trader.zealot` | Zealot faction trader | In game | src/content/tradePirates.ts:29; sim/trade/traders.ts, pricing.ts |
| Mercenary | `trader.mercenary` | Mercenary faction trader | In game | src/content/tradePirates.ts:33; sim/trade/traders.ts, pricing.ts |

## Economy and job features

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Buying and selling | `-` | Player trades with ships and stations; spread 1.25 sell / 0.6 buy; standing moves prices | In game | sim/trade/deals.ts, pricing.ts; ui/TradeWindow.svelte, TradeSlip.svelte |
| NPC economy | `-` | Ports produce and consume stock over turns; shortages and news | In game | sim/galaxy/market.ts, marketLive.ts; content/galaxyMarket.ts; ui/StarmapNews.svelte |
| Trade deliveries to the ship | `-` | Bought goods arrive by shuttle and are hauled in | In game | sim/trade/trips.ts, queue.ts, courier.ts; sim/systems/trade.ts |
| Reputation and standing | `-` | One standing per faction; gates blueprints and prices | In game | sim/galaxy/standing.ts; ui/OpinionHover |
| Delivery job | `delivery` | Carry a sealed crate to another port | In game | sim/galaxy/jobs.ts, jobOffers.ts, crate.ts, handover.ts; scenario handover |
| Bounty job | `bounty` | Hunt a named ship; hand in proof | In game | sim/galaxy/jobs.ts; scenario bounty |
| Survey job | `survey` | Visit a node and report | In game | sim/galaxy/jobs.ts; scenario survey |
| Passage job | `passage` | A passenger wants a lift somewhere; consent and lodging | In game | sim/galaxy/passage.ts; sim/consent/*; scenario medpod |
| Escort, high-risk prisoner and classified cargo jobs | `-` | Later job types | Planned | issue #179 |
| Job tracker and board UI | `-` | Cards, tracker, due dates | In game | ui/JobsPanel.svelte, JobsTracker.svelte, JobCards.svelte |
| Contraband and inspections | `-` | Tagged items refused by honest traders, seized by patrols | In game | sim/inspect/*, sim/blackmarket/scan.ts |
| Crew for hire | `-` | Trade stations post candidates; first-hire goal | In game | sim/galaxy/recruit.ts, trade/recruitLand.ts |
| Joining offers | `-` | A rescued passenger asks to join the crew | In game | sim/galaxy/joinOffer.ts |
| Salvage selling and scrapping | `-` | Strip wrecks, scrap into materials, sell | In game | sim/salvage/*, content/recipes.ts |
| Fuel economy | `-` | Jump fuel price and burn | In game | sim/galaxy/fuel.ts, content/fuelEconomy tests |
| Crew-run hauling | `haulJobs, supplyJobs, cargoJobs` | Crew haul loose stacks, supply builds and crafts, load shuttles | In game | sim/systems/haulJobs.ts, supplyJobs.ts, cargoJobs.ts; sim/items/haul.ts |
| Crafting and production | `craftJobs` | Fabricator, scrapper, refinery, galley recipes | In game | sim/systems/craftJobs.ts, items/craft.ts; see items.md |
| Farming | `farmSystem` | Hydroponics beds: plant, grow, harvest | In game | sim/farm/*; ui/module/PlotPanel.svelte |
| Mining | `miningSystem` | Mining pods cut ore from asteroid fields | In game | sim/systems/mining.ts, sim/mining/*; ui/AsteroidPanel.svelte |
| Base logistics, ferry, transfer orders | `ferrySystem, logisticsSystem` | Shuttles move cargo and crew between the ship and claimed bases | In game | sim/ferry/*, sim/logistics/*; ui/TransferSection.svelte |
| Shipyard | `yardSystem` | Paid hull builds at stations | In game | see stations.md |
| Second income loop and real money sinks | `-` | Economy balance work | Planned | issues #174, #160 (cross-system integrity), #171 |
| Water purifier (ice to water) | `-` | Dedicated module | Planned | issue #321; the refinery already splits ice |
