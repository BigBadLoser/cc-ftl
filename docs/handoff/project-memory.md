# Starter project memory (add these entries in Project settings > Memory, or ask a thread to remember them)

## What we're making
- **The game:** Space Haven *with depth*. A persistent, isometric ship-colony game in the browser, with FTL's tactical combat,
  weapon variety, crew species and encounters.
- **The four pillars:**
  1. **Depth from systems interacting.** Fire eats O2, breaches vent rooms, EMP blinds cyber-eyes, darkness slows crew. These
     come from shared state, not scripts.
  2. **One ship you get attached to.** There are no runs: you keep building, refitting and crewing the same ship.
  3. **Readable.** Every important state is visible. If the player can't see why something happened, that's a bug.
  4. **Builds matter.** Layout, modules and weapons, and crew (species and implants) make distinct play styles, and refits
     change them without restarting.
- **Setting:** gritty industrial with a cyberpunk edge: corporations, salvager clans, augmentation cults, militaries. Neon is
  both mood and information:
  - cyan: power;
  - orange: heat;
  - magenta: data;
  - red: emergency.
- **Structure:**
  - **Sandbox:** a persistent sandbox with normal saves, in an endless procedural galaxy.
  - **Danger tiers:** danger rises as you push outward. Pressure comes from choosing to go deeper for better loot, tech and
    species, never from a chasing fleet.
  - **Pacing:** real time with pause, one deck per ship.
  - **Long-term goals:** faction wars that move territory, story arcs that unlock with depth, and end-tier threats.
- **Combat:** FTL decisions with physical consequences. There is no maneuvering, and distance only sets projectile travel time.
  - Consoles, not manned weapons: weapons, helm and shields. The AI core runs point defence.
  - Hits breach walls, burn modules and hurt crew, and the ship's systems take it from there.
  - Endings: destroy, flee, capture by boarding, or negotiate. A fight lasts roughly 1 to 3 minutes.
- **Events:** events are data. They have requirements and visible odds, their outcomes are physical, and persistent flags let
  stories return. Story events happen in transit only.
- **Art:** pre-rendered from Blender into 2:1 isometric pixel art (64x32 tiles). Clean toon shading with neon in a glow layer.
  Crew sprites are composited from layers driven by sim state. Art never blocks gameplay.

## The plan (`docs/PROGRESSION_PLAN.md`)
- **Progression:** blueprints gate everything. You buy them at stations by type, salvage them, or research them. Tiers are
  module defs that reuse the base art with a variant.
- **Phase order:**
  1. Blueprints and tiers: done.
  2. Research (phase 3): done.
  3. Shipyard and hull growth (phase 5): done, now with the hull plan brushes and the 3-wide rule.
  4. Faction stock and the pirate factions and black markets (phases 2 and 2b): done. The named markets wait on station
     generation.
  5. **Next: upgrade slots,** weapons first (phase 4). An example is a nuclear warhead in the missile launcher.
  6. Then construction pods and drones, so your crew can grow the hull anywhere (phase 6).
  7. Then implant tiers (phase 7).
  8. Then story missions: self-contained arcs after the tutorial goal chain (phase 8).
- **Current focus (2026-10-28): a gap-closing pass** before more content. The game has plenty of content and systems, but how it
  feels to play needs work, and there are holes to fill. An agent play audit of the first hour and the user's own playtest
  notes feed a ranked gap list, turned into issues by theme:
  - onboarding and goals;
  - feedback;
  - core loop and pacing;
  - economy;
  - missing loops (loss, crew, long term);
  - QoL.
- **Open design questions:**
  - mood and breakdown severity;
  - a recoverable failure mode (escape pods, salvaging back);
  - lore specifics.

## Systems and decisions

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
