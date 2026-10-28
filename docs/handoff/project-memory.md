# Starter project memory (add these entries in Project settings > Memory, or ask a thread to remember them)

- **World model:**
  - One big grid per node. Ships, stations, derelicts and asteroids are regions of it, tagged by owner (ship id).
  - Ships never move inside a node and never dock with each other. Distance only changes projectile travel time.
  - On a jump, your ship and anything docked to it come along; captured prizes stay behind.
  - Mining, building in open space, welding structures together and ships breaking apart are planned, which is why the grid is shared.
- **Vehicles** (shuttles, later pods and cargo carriers) are free-moving entities (`BodyC`), not grids.
  - They dock sideways, with the side hatch extending a 4-ring tube to the airlock collar.
  - They carry all crew and cargo transfers.
  - EVA happens from a hovering shuttle onto a target hull, or around your own hull. Suits are stocked at airlocks and shuttles.
- **Starmap:**
  - An endless galaxy of sectors made of nodes, linked by hyperlanes.
  - Travel costs fuel plus FTL charge.
  - Nodes have fixed structures. "Combat node" is not a type: any node becomes one while enemies are present, including when one jumps in.
- **Economy:**
  - Credits are the currency, plus item-for-item barter.
  - You trade with stations and with ships in the same node by hailing them.
  - Goods are delivered by shuttle to the airlock unloaders.
- **Factions:**
  - Corporations (Meridian, Helix, Vantor) and the Concord Navy (government).
  - Also Free Traders and the Rogue AI (drones).
  - Five pirate factions:
    - the Scrappers (the main one, junk ships);
    - the raider clan, light ships that prefer boarding;
    - the cartel, which guards its routes and hires mercenary escorts;
    - the zealots, a niche machine-god cult allied with the drones that goes for your AI core and never surrenders;
    - the mercenaries, neutral by default.
  - Standing is per faction. A pairwise relations table spills standing between factions.
- **Black markets:**
  - Lesser markets sit at about 25% of pirate-held and lawless stations, and every market has a truce at its node.
  - Pirate stations without a market attack on sight.
  - Contraband is caught by navy and corporation scans: surrender it with a fine, or pay a bribe. The scan prompt is
    temporary until navy inspectors board in person (#138).
  - Only the cartel has a fence.
  - Three named markets wait on station generation.
- **Dropped:** teleporters.
- **Prisoners** go in the existing cryo pods (#116, planned). Wrecks still kill everyone aboard.
- **Hunger and events** are good enough for now. They grow with content.
- **UI direction:**
  - Desktop first, with cohesion as the priority.
  - A top bar, a crew roster on the left, one bottom context panel, one right drawer, an action bar, alert toasts, shared styling.
- **Ship generator:**
  - Assembly-driven, with a shared arranger and modular, tunable grammars.
  - Every ship must be one connected structure.
  - Scrappers are salvage built from donors joined by struts: lengthwise ties and diagonal or dogleg corner struts.
  - **The 3-wide rule:** no part of a ship's hull may be narrower than 3 tiles. The hull must equal its 3x3
    morphological opening. Struts and trusses (`Struct.Beam`) are exempt. Generators, stations and wrecks all obey it,
    because the hull art's sprite catalogue depends on it.
- **Hull and the shipyard:**
  - "Hull" means the ship's whole footprint, every tile.
  - Ship size is the area inside the outer hull, and engine capacity limits it. Any number of engines can be fitted,
    and there is no ship size cap.
  - NPC ships ignore engine capacity for now (#129).
  - You plan hull growth in Build > Hull plan with brushes: a rectangle of at least 3x3 that must touch the ship, erase,
    a line cut, and mirror. A yard then builds the plan.
  - Yard builds put scaffolding trusses on the whole plan first, for a planning fee. They then turn trusses into hull
    nearest-rows-first, up to the visit cap, sealing each section. Leftover trusses stay as visible scaffolding.
- **Combat:** walls and doors have 255 integrity, and a breach opens to space. The mass driver breaches a wall in one
  hit. A combat damage shader for walls is in the art thread. Most shots hit under the roof today, so making shots
  strike the outer hull first is an open question.
