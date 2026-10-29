# Design

A persistent, isometric ship-colony game in the browser. Space Haven is the target; FTL supplies the
tactical combat, weapon variety, crew species, encounters and build variety. The goal is Space Haven
**with depth**.

## Pillars

1. **Depth from systems interacting.** A few simulation systems that multiply each other beat many
   isolated features. Fire eats O2, breaches vent rooms, EMP blinds cyber-eyes, darkness slows crew.
   Interactions should emerge from shared state, not be scripted one by one.
2. **One ship you get attached to.** No runs. You keep building, refitting and crewing the same ship
   for as long as you play.
3. **Readable.** Every important state is visible: neon colour language, overlays, tile inspector,
   alerts. If the player can't see why something happened, it's a bug.
4. **Builds matter.** Ship layout, modules/weapons and crew (species + implants) combine into distinct
   play styles, and refitting lets you change them without restarting.

## Setting

Gritty industrial with a cyberpunk edge: corporations, salvager clans, augmentation cults, militaries.
Cybernetic implants are everywhere. Neon is both mood and information.

## Structure

- **Persistent sandbox** with normal saves. A recoverable-failure mode (escape pods, salvaging back)
  may come later.
- **Endless galaxy**, procedurally generated in chunks. **Danger tiers** rise as you push outward; the
  pressure comes from choosing to go deeper for better loot, species and tech, not from a chasing fleet.
- **Terms:** a **node** is one playable location (one grid with its structures and ships; older text says "sector" for it). A
  **sector** is a group of nodes around a central body. A **cluster** is a named group of sectors held by one power (user decision,
  2026-10-22: "cluster", not "region"). Sectors are joined by **hyperlanes**, clusters by **gates**. See "Starmap and factions".
- **Long-term goals:** faction wars that move territory, story arcs that unlock with depth, end-tier
  threats (boss fleets, anomalies).
- **Real-time with pause**, adjustable speed.
- One deck per ship.

## Ship & building

- Tile grid, **full-tile walls**, no roof. Walls are low bevelled blocks that autotile by neighbour
  (4-bit mask); exterior hull on the camera-facing side draws as a dark translucent ghost (toggle: Ghosts).
- Modules (reactor, shields, weapons, life support, beds, stations…) are placed on the grid with
  footprints and access tiles.
- **Refitting** at stations or by crafting is the main way builds change.
- Every grid is the same kind of thing: your ship, enemy ships, stations, derelicts, wrecks.

## Crew

- **Roles** (engineer, gunner, medic, security, pilot…) give a default priority set; a per-crew
  **priority grid** allows manual override with "reset to role".
- **Autonomous by default** (utility-scored jobs with reservations), **Battle Stations** toggle swaps
  priorities for combat, **drafting** gives direct control.
- **Needs and mood** (hunger, rest, social, comfort, stability). How dramatic breakdowns get is still
  open. What exists:
  - **Hunger** (0..100, 100 = fed) falls 0.12 per second (half while asleep): hungry below 35 after about 9
    minutes, zero after about 14. Hungry crew drop their job and go to the **galley** (a powered `module.galley`, which
    is also a food printer), else to a crate that holds food, take one **ration** from storage and eat for 4 s (+50).
    Operators of a console hold their post until hunger is under 10. No food or no way there: they carry on and look
    again every second. At zero hunger they lose 0.05 hp per second (no regeneration) and an alert fires.
  - **Food** is data: an item with `food: { nutrition }`. `item.ration` is printed at the galley from scrap
    (`recipe.ration`, 2 scrap makes 3 rations); use the usual make-N / keep-N orders. The starter ship has 12 rations and
    a galley that keeps 12 in stock.
  - **Mood** (0..100) is 50 plus named factors, shown on the crew card as "Hungry -10, Company +3". Factors: hunger
    (starving -25, hungry -10, peckish -3, well fed +4), rest (exhausted -15, tired -8, rested +4), a hot galley meal
    +6 for 5 minutes, the last sleep in a bed +5 or on the floor -6 for 10 minutes, the room (dark -5, stale air -8, thin
    air -20, smoke -6, too hot or cold -6) and a light social term (company within 7 tiles +3, alone for 2 minutes
    -4). Under 35 work speed is x0.85, under 20 it is x0.7 and a "very unhappy" alert fires once.
  - **Robots** (any species without `hunger` / `mood`) neither eat nor have moods; enemy crews are exempt too.
  - **Open:** breakdowns. `breakdownRisk()` (mood under 10) is the hook; nothing calls it yet. Also open: beauty and
    room quality as a comfort factor, friends and rivals, whether drafted crew should starve quietly (they do now: they
    never stop to eat while drafted).
- **Damage control (#181):** crew deal with fires and hull breaches on their own, at the top priority. The `firefighting`
  work category (shown as "Dmg" in the priority grid: fires and breaches) is 1 for every working role (0 for roles that do no
  work), and the player can lower it in the grid. The auto-jobs system posts an `extinguish` job per burning tile and a wall
  `build` job (same category, so it outranks ordinary construction) on each hole in a player ship's hull, once the stock can pay
  for a wall. Crew pick them like any job (nearest free crew by walking distance, a suit first when the way is thin air), and
  materials are hauled to the site by the usual supply jobs. Crew manning a console never leave it for a fire or a breach (a
  console job is held, not picked); that includes the shield console, which could leave "when nobody else can reach" but doesn't
  yet. Doors and venting stay manual.
  - **Priority repair** (`module.priorityRepair`, a button in the module inspector) is the one manual lever: a flagged module's
    repair job beats every other for the crew who repair, until it is mended.
- **Danger awareness:** crew read tile fields (fire, vacuum, heat) and avoid or flee unless their job,
  species or gear allows.
- **Species** are base bodies (organic, synthetic, hybrid) with real sim effects (no breathing, fire
  resistance, fast repair…). **Implants** add on top, with trade-offs: power draw, maintenance,
  stability, vulnerability to EMP/ion and hacking.
- Relationships (friends, rivals, grief) later.

### EVA and spacesuits

- **Suits live at the airlock.** There is no locker module and no suit item. Each airlock holds a few suits (a content
  value on the airlock def: 3 for the docking airlock). Crew put one on at the airlock's inside tile (about 5 s) and take
  it off there on return (about 3 s), which stows it in *that* airlock. If an airlock has no free suit, nobody can start
  an EVA through it.
- **Automatic.** A crew member whose job can only be reached through thin air (breached or depressurised rooms) walks to
  the nearest airlock with a free suit, suits up, does the job, and walks back to take the suit off once idle, so the suit
  is free for the next one. They prefer jobs and routes that need no EVA, and never take a vacuum job when no suit is
  free. Drafted crew do none of this on their own: the player orders **Put suit on** and **Take suit off**.
- **Where EVA happens.** Ships never sit close to each other (they cannot move within a sector and are never deployed near
  enough), so **there is no ship-to-ship docking, thruster crossing or walking between ships**. Shuttles (and later cargo
  vehicles) carry crew and cargo between grids. EVA is:
  - Walking through breached or depressurised rooms.
  - Stepping out of an airlock onto the same grid's hull. Today the exterior is the ring of Space tiles touching the hull
    (`isEvaWalkable` in `structure.ts`); suited crew drift along it with the `eva_float` clip. Beams (`Struct.Beam`) join
    that rule when they land. Suited crew come back in through the airlock, or through a breach.
  - **From a hovering shuttle.** A shuttle can fly to another ship or a derelict and hold station 4.5 tiles off its
    hull (`vehicle.hover`) without docking. Its hatch works like an airlock for suits: the shuttle stows a few (a vehicle
    def value, 3), passengers suit up aboard and go out (`eva.out`), float (`eva_float`) across the gap to the nearest hull
    tile, then move on that grid like any suited crew: onto the hull, in through a breach or a depressurised room, or in
    through its airlock from outside. They return the same way: the player orders `eva.board` and they float back to the
    hatch, climb in and the suit is stowed. The float is short on purpose (6 tiles at most, 1.5 tiles/s), so the shuttle
    has to get close. The shuttle cannot leave while crew are outside.
- **Limits.**
  - The tank lasts 4 game minutes of thin air (a breached room, the airlock, the hull outside). It does not drain in breathable air, and refills only when the
    suit is stowed at an airlock.
  - A tank that runs dry hurts exactly like vacuum without a suit. The crew card and an alert warn at 25%, and a bar flashes
    over the wearer's head.
  - A suited crew member walks 20% slower, works 10% slower and lands 20% fewer hand-weapon hits.
- **Robots** never need suits: they do not breathe, and the suit commands refuse them.

### Robots and the rogue AI

- **Robots are not crew, androids will be.** A robot is a moving module run by its ship's AI core: not an individual with a
  face, a name to follow or needs. It still uses the crew job system and species machinery in the sim, but the crew bar and
  its portraits leave it out (the world view, inspector and priorities panel still list it). **Androids**, later, are the
  robot-like crew members: individuals who count as crew.
- **Robots** are a crew species with no needs (no air, food, sleep or mood) and no fear of vacuum or fire panic,
  though fire still damages them. They are **repaired, not healed**: crew with repair skill mend them using parts
  or metal, and a medbay does nothing for them. Ion and EMP **stun** them. They never surrender: at 0 hp they are
  **wrecked** and can be salvaged for parts.
- The **rogue AI** faction is crewed by robots and hostile to everyone. Its robots run off their ship's **AI core**.
  When a core is destroyed, unpowered or hacked, its robots go **inert**. To capture an AI ship, crewless or
  robot-crewed, take its cores down and hold the bridge (on AI ships, the cores count as the bridge). Crew with
  the hacking skill can hack a core; this is a job that takes time.
- **Hacking a core is a hold.** While the hacker stays at the core, its robots fight for the hacker's side. When the
  hacker leaves or is interrupted, the robots go back to their own side, inert.
- **Robots run on a battery** instead of sleeping. It drains faster while they work or fight. When the charge is
  low, or a robot is badly damaged, it goes to its **robot bay**: one robot per bay, like an assigned bed. The bay
  recharges it and slowly repairs it with parts or metal from storage. A crew mender is faster, and the robot holds
  still while being mended.
- **The player gets robots by assembling them in a robot bay.** You pick a robot type; the bay's materials (parts,
  metal, electronics) are delivered and worked over time. The new robot calls that bay home.
- **Security bots** use a heavy chassis: more hp, armour against crew damage, slower.
- **Planned: robot classes limit the work a player's robots can do** (user, 2026-10-26; not built). Robots are not
  crew: they are moving modules run by the AI core, with no individual sentience. They still use the crew job system,
  but each class can only take some work:
  - **Heavy** (security bots): can haul and is strong in combat, but does no skilled work.
  - **Medium**: does skilled labour (repair, construction, manning stations) and is average in combat, but carries
    little.
  - **Drone** (flying, more drone types planned): mostly repair. It can't haul or man stations.
  - The limits apply only to robots the player salvages or builds and sets to work on their ship. NPC and rogue-AI
    robots keep the full job set.
  - **Androids** (later) will be the robot-like crew members: real crew, with portraits and a crew-bar card.
  - Open UI question: once classes exist, the work-priorities grid shows only the categories a robot's class allows, and
    robots may get their own section there. Robots stay out of the crew bar.
- **Robot fabricators** stay the rogue AI's own spawner: no materials, just a live core and power, up to a cap.
  Rogue ships and shipyards also have robot bays, where their robots recharge.
- **Derelicts come in two kinds:**
  - Scrapper and other wrecks are abandoned and infested with hostile aliens.
    Egg sacs hatch when disturbed (a crew member close by in sight, damage, or a neighbour hatching); hunters (fast
    melee), brutes (tough, knock crew down) and spitters (ranged, keep away) come out. Aliens don't need air, so vented
    decks don't stop them; they stay on their own wreck. Crew can destroy sacs before they hatch.
  - AI-faction derelicts are rogue AI shipyards and factories (fabricators, cores, robots).
- **Combat drones** (a launched weapon class) come later. They will build on the AI core's tier and the EMP effect.

## Ship systems (M3 decisions)

- **Power:** one network per ship for now, with module priorities deciding what loses power in a
  shortage. Conduits may come later; the code leaves a seam for them.
- **Atmosphere:** per tile, with gas spreading between tiles. Doors block gas when closed. Floor tiles
  next to space vent.
- **Injury:** at 0 HP a crew member is **downed** and bleeds out on a timer. Another crew member can
  carry them to a bed to stabilise them. If the timer runs out, they die permanently.
- The **economy** (items, storage, hauling, build costs) is its own milestone (M3b).

## Combat

FTL's decision-making with physical consequences, in a shared sector.

- **Nodes:** a node is a playable space holding ships, stations, asteroids and derelicts, all on one grid. On entering a node, a
  **deploy modal** (a simplified map of the node) lets you choose where your ship sits relative to the other objects.
- **No combat nodes:** a node becomes a fight when hostile ships are there, including a hostile ship that jumps into your node while
  you stay.
- **No movement, no maneuvering, no firing arcs.** Distance only affects **projectile travel time**,
  so a far deployment gives more time to react (shields, point defence). There is no accuracy penalty.
- **Combat view:** while a fight is on, a dedicated combat HUD replaces the colony HUD (see "Combat view" under UI). The camera
  frames both ships, and you pick targets by clicking the enemy's modules in the world.
- **Heat (user decision):** every combat ship has a heat meter (0-100); the player manages it entirely by hand, no auto-vent. Shots
  and shield hits add heat, and it only falls while the shields are down. **Vent** (G) dumps heat fast but drops the shields and holds fire.
  **Overcharge** boosts weapons, shields or engines for a few seconds, adds heat, then has a long cooldown. Hitting the maximum is a
  **thermal overload**: weapons and shields lock out for a few seconds. Tuning lives in `sim/combat/heatTuning.ts`.
- **Consoles, not manned weapons:**
  - The **weapons console** operator runs all weapons; their skill affects charge and accuracy. With
    no operator, weapons don't fire.
  - **Relief:** a weapons or helm console left empty for 12 s in a fight (its operator went to eat or sleep) is taken by idle crew of a role
    that relieves stations (engineers, medics, worker and repair bots), whatever their operating priority; priority 0 still opts out.
  - The **shield console** works unmanned at base strength; an operator speeds up recharge.
  - The **helm** pilot gives evasion and charges the FTL drive to flee. With no pilot, there is no
    evasion and no escape.
  - The **AI core** operates the **point-defence modules** automatically (they do nothing without a
    powered AI core whose mast is out; several modules stack). Its tier sets how much else it can
    automate later (drones, standing in for missing operators at reduced efficiency).
- **Physical systems:**
  - **Weapons and engines** are modules that must touch the hull.
  - **Shield generators** can sit anywhere inside the ship.
  - All of them are targetable, can burn, and need power.
- **Weapons** charge and fire in volleys (auto-fire at the chosen target, or hold and fire together).
  - **Burst laser:** strips shield layers, light hull damage.
  - **Mass driver:** pierces one shield layer and breaches hull.
  - **Missile:** bypasses shields and uses crafted ammo.
  - **Ion:** drains a shield layer or disables the module it hits.
  - **Incendiary:** starts fires.
- **Shields** come in layers set by generator power, and regenerate.
- **Roofed view (later):** enemy ships render with a roof (top hull) over their rooms, which hides
  the interior. Modules that should be visible from outside (weapons, shield generators, engines and
  similar) show a unique roof tile above them instead of the generic one, so they can still be
  identified and targeted. Enemy roofs can't be hidden without a scanning upgrade (planned research).
- **Aiming from the main view:** while a fight is on, selecting a weapon card (Q W E R) arms a
  left-click on an enemy ship in the main camera (right-click and Esc cancel; the right button stays with drafted-crew orders). A weapon with no aim of its own follows the ship target, shown as "Auto". A roof-visible
  module (weapons, shields, engines, AI core) is aimed at as that module; any other roof tile is a **blind tile aim**, and shots land near it
  with the usual spread. A bracket marks the aimed tile or module in the main view.
- **Hits** land on tiles near the aim point (spread by accuracy). Walls lose integrity and breach,
  modules lose HP, and crew get hurt. M3's systems take it from there: venting, fire, power loss,
  darkness.
- **Enemies run the same sim:** their own crew, power, fires and repairs, plus an AI doctrine for
  targeting, power and retreat.
- **Endings:**
  - **Destroy:** the wreck persists as a lootable derelict grid. A hostile ship whose whole crew is subdued (surrendered or downed) or dead is
    given up as a derelict too, unless the player's crew are aboard going for a capture (rogue AI ships are excluded: their fabricators replace
    robots).
  - **Flee:** charge the FTL drive.
  - **Capture:** via boarding, in M5.
  - **Negotiate:** via events, in M6.
- Fights last roughly 1 to 3 minutes. Fleet combat is not a core feature.

## Exploration & events

- Away teams board derelicts and stations (they're grids in the same world).
- **Events are data:** trigger context, text, choices with **requirements** (species, implant, skill,
  module, item, reputation, cost), outcomes as effect lists.
- Outcomes can be **physical**: spawn a derelict to explore, a fire, a boarding party, a combat.
- **Persistent flags and arcs:** the pirate you spared comes back; the corp you robbed puts out a bounty.
- **Skill checks show their odds.**
- Event pools are weighted by danger tier and faction territory (the current node's, set on every jump).
- **Story events happen in transit** only: a hop of a hyperspace trip may draw one (never the hop that is interdicted), and the trip is held until you answer. Nothing starts while the ship idles in a node. Hostile arrivals and NPC traffic are node-local happenings, not story events.
- **Presentation:** decisions pause in a modal; flavour and optional leads arrive in-world and can be
  ignored.

## Starmap and factions

- **Galaxy:** endless, generated in chunks as you push outward, shaped by a terrain of dense filaments, nebula clouds and **rifts** (voids).
  Space is grouped three ways: nodes make a **sector** (6 to 12 nodes around a **central body**: a star, red dwarf, blue giant, gas giant,
  nebula or black hole; the nodes take a layout such as a cloud, streak, ring, fork or corridor), sectors make a **cluster**, clusters
  make the galaxy.
- **Clusters** are named, have one owner (or nobody) and a type that tells you what to expect: core worlds, border march, corporate
  holdings, trade lanes, pirate haven, machine dominion, frontier, rich and contested. Each has a **hub** sector, a crossroads with
  more nodes and lanes. Clusters sit apart, and borders follow the rifts. Space a cluster barely reaches is **wild**: no owner.
- **Lanes:** routes join nodes inside a sector; hyperlanes join sectors between gateway nodes that face each other. Between two
  clusters only a few **gates** cross the border (usually one, sometimes two or three, sometimes none and you go around). Where a
  sector can only be reached across a void, a long **rift lane** crosses it. Some hyperlanes carry a mid-lane event.
- **Danger** rises with distance from the start: a tier about every two sector spacings outward (tiers 0 to 9). It sets enemy depth,
  event pools and how often hostile ships show up.
- **Node contents:** structures (asteroid fields; trade, military and research stations; old derelicts), the owner, a resources hint
  and the ships present. Structures are descriptors until nodes become grids.
- **Travel:** every jump costs **fuel** (an item) and **FTL charge**. Longer jumps cost more; hyperlanes are cheaper per distance but
  need a full charge; a gate costs extra fuel and twice the days. The planner picks the least fuel, then the shortest time, through
  space you have seen.
- **Sensors** show nodes within 3 jumps and your whole sector. **Arrivals:** while you stay, hostile ships may jump in (more often at
  higher danger and in hostile territory; never at danger 0).
- **Factions:** the Concord Navy (government, holds the core where you start), the corporations (Meridian Combine: trade; Helix
  Biosystems: research; Vantor Heavy Industries: industry), the Free Traders (civilians, no territory), the Scrapper Clans (pirates) and
  the Rogue AI (drones; always hostile). The navy holds the start, corporations the middle band, pirates and the machines farther out.
- **Standing** = base standing + reputation + a share of reputation with related factions. Reputation is kept per faction (`navy`,
  `meridian`, `helix`, `vantor`, `traders`, `pirates`, `drones`), the same numbers trade prices and hailing use (a station or ship
  trades on its owner's standing). Hostile below -2, friendly from 3. Who is at war and who shares standing is a pairwise table.
- **The starmap view** (not built on `main` yet) has three zoom levels: **sector** (nodes, routes, exits, bodies, nebula), **cluster**
  (sectors as patches, for planning a route) and **galaxy** (clusters joined by gates and rift lanes).

## Economy

- General model from day one: items with tags and stack sizes, storage, recipes (inputs, outputs,
  station, time), hauling via the job system.
- **Start light:** scrap plus 3–4 resources and a few recipes. Full chains (mining → refining →
  crafting, food) are added later as data.
- **Terminology:** a **node** is one playable grid or location, a **sector** is a group of nodes, a **cluster** is a group of
  sectors, and sectors are linked by **hyperlanes**.

### Trade

- **Credits** are a separate currency, shown in the top bar. You can also **barter**: items for items, no credits.
- You trade with **stations** and with **ships in the same node** by **hailing** them. Non-hostile ships answer; hostile ones refuse.
  Whether a ship answers depends on its faction's relation to you plus your reputation with that faction (the reputation events
  already track), and a ship with its guns on you never answers.
- Prices: every item has a base price. A trader sells above it and buys below it (so a round trip loses money), tilted by the
  faction, the kind of trader (freighter, liner, mining ship, station; corp, navy and pirates are placeholders) and your reputation:
  friends sell cheaper and pay more.
- Traders hold stock and a wallet that are fixed by the world seed and the ship, not by when you hail them.
- **Goods travel by shuttle.** Once you accept, a shuttle carries the cargo between the two ships' airlocks: the seller sends its
  shuttle if it has one, otherwise yours goes over (it flies itself: no pilot or crew needed). Your own crew load and unload it at the docking
  airlock's unloaders. **Payment settles on delivery**; until then the credits are held in escrow. A shuttle shot down on the way
  voids the deal (credits back, goods lost).
- Stations have no grid yet, so their deliveries are instant (temporary).

## Progression (user decisions, 2026-10-26; not built yet)

Depth should pay off: better gear, a bigger ship and new stories come from going further out, so credits are worth saving
and risk is worth taking.

- **Where better gear comes from:**
  - **Bought:** station markets sell better gear in higher danger tiers.
  - **Salvaged:** tougher wrecks sometimes yield gear (a maybe, not the main source).
  - **Research:** a planned research system (see below).
- **What gets tiers:**
  - **Weapons:** only simple weapons at the start; better ones come with progress. Full weapon tiers may come later.
  - **Shield generators, engines, reactors:** tiered.
  - **Crew implants:** tiered.
- **Tiers plus upgrades:** both clean module tiers and **upgrade slots**.
  - Some modules, mostly weapons, take slotted upgrades that change how they work. For example, a "nuclear warhead"
    upgrade in a missile launcher instead of building a tier 2 launcher.
  - Upgrades are items: bought, found or researched.
- **Faction and territory gear:** some items are only available in certain faction territories or system types.
  Faction-specific gear only to an extent, without multiplying the art needed: reuse module art with variants or
  upgrades rather than a new model per faction.
- **Research:** done at a **research module** on the player's ship; later the player may build their own research
  station. Each research project has its own materials cost (data cores, samples, alien tissue, artifacts, components,
  depending on the project) and takes time. Projects unlock blueprints: module tiers, upgrades, implants,
  construction pods and drones. Build plan: `docs/PROGRESSION_PLAN.md`.

### Where blueprints are sold (user decision, 2026-10-26)

Each station type has its own reason to visit:

| Station | Sells blueprints for |
|---|---|
| **Research** (new station type) | Non-defence modules: reactors, engines, life support, production, storage, utility |
| **Military** | Defence: weapons, shields, point defence. The best gear, gated by standing |
| **Pirate / black market** | Weapons, a rougher or cheaper selection (see "Pirate factions and the black market") |
| **Trading** | No blueprints. Later: furniture, comfort and leisure objects |
| **Mining, farming** | Maybe their own speciality later (refinery or hydroponics upgrades) |

- Research stations are rarer than trading posts and more common in calm, settled space. They start as a generator layout
  built from existing modules; their art comes later through the pipeline.
- Researching a blueprint yourself (research module, phase 3) is the other way to get any of these, paying the project's
  materials cost.
- Shields count as Defence. Mk I is on the starter ship, so Mk II/III being hard to get early is fine (open to revisit).

### Pirate factions and the black market (user decisions, 2026-10-26 and 2026-10-27; the factions (slice 1, #135) and the black-market services (slice 2, #136) are built; spawning the named markets is not)

Today there is one pirate faction (the Scrappers) and the pirate den, a hostile station built to be conquerable.

**Factions**
- **Scrappers** (existing): junk ships, salvage, many weak guns, on the fringes.
- **Raider clan:** fast, light ships that favour boarding. They try to take your ship rather than wreck it.
- **Cartel / smugglers:** cargo-heavy ships with missiles and escorts. They are less aggressive, but they guard their routes.
- **Zealots:** a machine-god cult, allied with the Rogue AI (they never fight drones). They board to "free" your AI core:
  their boarders head for the AI core room, and if they hold it long enough the core is torn out and lost, and your robots
  go inert. They never surrender, so a fight with them ends in a derelict, never prisoners. Their crews are augmented and
  use fire weapons, and their territory lies next to the machines'. They will trade with you if your standing is high
  enough or enough of your crew are heavily augmented. The augmentation rule reads implants, so it only matters once
  implants land (phase 7).
- **Mercenaries:** professionals in well-equipped, balanced ships. They are neutral by default and appear as hired
  escorts and guns, for example "the cartel hired mercenaries to guard this route". Hiring them yourself comes later.

**Relations**
- Pirate factions are hostile to each other by default, except at black markets (the truce).
- The cartel is neutral with the Scrappers (it buys their salvage) and at war with the raiders.
- Mercenaries are neutral to all until hired.
- The navy and civilians are hostile to all pirates, as now.

**Standing**
- Standing is per faction (built, phase 2): each corporation has its own, and each pirate faction will.
- One scale: hostile and attacking on sight when low; neutral, so you can dock and trade, in the middle; discounts and
  better stock when high.
- Fighting a faction lowers your standing with it. Jobs against its rivals raise it.

**Black markets**
- **Three named markets per galaxy, each with its own speciality:**
  - a cartel market (the main one: best fence, most contraband);
  - a zealot machine bazaar (AI cores, robot parts, drone tech; zealot trade rules apply);
  - a mercenary hiring hall (the best shady crew, and later hired escorts).
- **Lesser services** at pirate-held and lawless stations: a smaller selection, no fence, worse prices.
- **Truce:** nobody starts a fight at a black market's node. Firing on or boarding anyone there breaks it. A breach
  means a ban: everyone there fires on you for 30 turns, and you take a standing hit with every pirate faction. The
  game never stops you travelling there.
- **Contraband:** an item tag for stolen job cargo, loot from captured ships and illegal weapons. It sells high at black
  markets. Navy and corporation stations scan you when you dock, and their patrols sometimes hail and scan you. If they
  find contraband, you either lose it and pay a fine with a standing hit, or pay a bribe. A shielded cargo module that
  hides contraband is a later blueprint.
- **Fence:** buys anything, contraband included, at about 50 to 60% of value, with no questions.
- **Shady crew:** better skills and a higher one-time hire cost (crew take no wages). Drawback traits may come later.
- **No navy-standing cost for visiting.** The risk comes from contraband scans instead.
- **Art:** a placeholder from the pirate den layout. The real station layout belongs to the shipgen session; liveries
  come later.

### Prisoners and prizes (user decisions, 2026-10-27; issue #116)

- **End of a fight with every enemy crew member subdued:** you choose "let them go" or "take prisoners".
  - Let them go: the ship becomes a derelict and the crew are gone.
  - Take prisoners: the ship becomes a prize, and its surrendered crew stay put as prisoners until moved.
  - Zealots never surrender, so they never offer this choice.
- **Holding prisoners:** they go into **cryo pods** (`module.cryo_pod`, already in the game), not a brig. Frozen, they need no food and can't
  escape. If a pod loses power, its prisoner thaws and turns hostile inside your ship. A shuttle or the boarding party
  escorts prisoners over.
- **What to do with prisoners:** recruit one over time (odds by faction and mood), ransom them to their faction (credits
  and a little standing), hand pirate prisoners to navy or corporation stations for a bounty (credits and standing), hand
  them over at a black market (credits, and cartel standing), or release them (standing with their faction).
- **What to do with a prize:** strip it (your crew deconstruct its modules and take its cargo), sell the hull at a
  shipyard or black market (`prizeValue`), or scuttle it. Keeping a prize as a second ship waits for a fleet system.

### Faction specialities (phase 2 stock)

Station kind still decides what a station sells (see "Where blueprints are sold"); the owner faction shifts what is more
common there, and the starmap hints at notable stock.

| Faction | Stocks more of | Note |
|---|---|---|
| Concord Navy | Weapons, shields | The best gear, gated by standing |
| Vantor Heavy Industries | Reactors, engines, refineries, fabricators | The best shipyards: bigger caps, cheaper per tile |
| Helix Biosystems | Medbay, life support, farming, later implants | |
| Meridian Combine | Storage, cargo, vehicles, fuel | Cheaper fuel |

### Ship growth

- **Early:** expanding the hull needs a refit at a station (a shipyard service): pay, dock, and the station builds the
  new hull sections.
- **Later:** build a construction pod or construction drones, and your crew can expand the hull anywhere.
- **Size:** maybe no cap, or a cap set by the AI core or reactor tier and upgrades, so growing the ship is tied to
  progression.
- **Cost of size:** each engine supports a set number of hull tiles (more for Mk II and III). Over capacity, a jump is
  blocked unless you overcharge the hyperdrive, which risks engine damage and fires. There is no fuel scaling by size (see
  phase 5 in `docs/PROGRESSION_PLAN.md`).

### Money

- **No crew wages.** Credits are mostly for buying things: gear, upgrades, materials, fuel, station repairs, refits and
  hull expansion, and hiring.

### After the tutorial: story missions

- **Self-contained stories**, not one overarching plot. Each mission is a short arc with its own setup and ending, and
  arcs can tie into each other through shared factions, characters or places.
- The first ones can start when the goal chain sets `goals.done`.

## Art direction

- **Isometric pixel art in the spirit of Space Haven:** 2:1 isometric, 64x32 px tiles, detailed and
  readable at a glance. The ship looks great as a whole.
- **Made by pre-rendering 3D,** not hand-pixelled. Models are built in Blender and rendered to pixel
  sprites with a fixed palette and outlines. Every direction and frame stays consistent, and
  mix-and-match crew parts always line up.
- **Clean pixel art:** the 3D source uses clean, simple shapes with smooth shading quantised into a few
  flat tone bands (toon-like). No faceting and no surface noise; detail comes from deliberate shapes
  (panel seams, bolts, stripes, lights).
- **Gritty industrial with a cyberpunk edge:** muted metals, wear shown through shapes and colour,
  hazard stripes, and neon accents.
- **Neon colour language:** cyan = power, orange = heat or overload, magenta = data or hacking,
  red = emergency. Neon lives in a separate glow layer. With the power out, the ship goes dark and the
  glow is what you read.
- **Crew** are composited from layers: species body, hair, eyes, flesh or cyber arms, implants,
  clothing and role gear. Appearance is derived from sim state, so installing a cyber-arm or losing an
  arm shows.
- **Species to come:** rock (glowing orange magma cracks), robot (screen face, panel seams) and slime
  (translucent, gear floating inside).
- **Lighting is a sim field.** Lights need power, and darkness has gameplay effects.
- **Art never blocks gameplay.** Placeholders are fine, and art gets timeboxed sessions.

## UI

- **Layout:** a full-screen game view with Svelte panels over it.
  - **Top:** the crew bar and the node strip.
  - **Top left:** drawer buttons (starmap, ship, crew, build and so on).
  - **Top right:** the time controls, with the ship's log above them and the goals and alerts below them.
  - **Bottom left:** a context panel for the selection.
  - **Bottom right:** a tool bar.

  The layout that grew in play replaced the original plan (a top bar, a crew roster on the left, one right-hand drawer).
- **Overlays and inspection:** field overlays (O2, heat, power, light, damage) and a tile inspector.
- **Keyboard:** Space pauses, 1–3 set speed, backtick opens the debug menu, plus drawer hotkeys. In a fight: Q W E R select weapons 1-4 (R only when there is a fourth weapon, else it stays crew draft), V volley, H hold fire, G vent, F flee.
- **Starmap:** it is its own view.
- **Platform:** desktop only.

### Combat view (user decisions, 2026-10-29)

- **It replaces the colony HUD during a fight:** the nav strip, node strip, drawers, build tools, inspector and goals give way. The ship's log,
  the clock and time controls, and urgent alerts stay; the crew bar shrinks to portraits. The camera frames both ships, clear of the HUD bands.
- **Enemy card (top left, red hostile theme):** name, faction and class, hull (green, amber, red at 60% and 30%), shield pips, evasion,
  heat, and a charge bar per weapon with the commit notch (red once it has committed an aim).
- **Your strip (bottom):** defence block (hull, shields, evasion) and station tags (WPN, SHD, HELM manned; ENG online when an engine is
  powered), four weapon slots (card: key badge, charge, target or "Auto"), Volley and Hold fire, the heat block (gauge with the net
  %/s rate, Vent, three Overcharge buttons with active and cooldown rings), and a docked Flee tab on the right edge whose drive charge fills upward.
- **Thermal overload:** a dark overlay with a red THERMAL OVERLOAD label and a countdown covers the strip and its hotkeys.
- **No Hail and no colony inspection in a fight.**

### UI soft rules (user decisions, 2026-10-28)

**These are soft rules.** They set the default direction. An agent or session should always feel free to suggest
breaking one, or to ask whether it should apply in a given case. Say why, and let the user decide.

1. **Nothing happens only in the UI.** Story and interactions play out in the world wherever possible. For example, navy
   inspectors dock and come aboard (#138) rather than a dialog doing the search.
2. **Show, don't tell.** State is shown in the world first: sprites, effects, overlays, and small floating feedback where
   it happens (for example "+245 ₵" rising off the station). Text on screen is the fallback, not the default.
3. **Numbers on demand.** These games tend towards dense, number-heavy UI, and that overloads the player. Dense
   information lives behind an action: inspect a tile, crew member or module, or open a drawer from the top-left
   buttons. The always-on HUD stays sparse.
4. **The ship's log** (above the time controls) is the full, persistent record of everything notable: trades and
   payouts, combat, deaths, story beats, production. It can be scrolled back, and each entry jumps to its subject when
   clicked. Events that also raise an alert are logged as well.
5. **Alerts** (under the clock) are for urgent, actionable things only. Every alert is clickable and takes you to its
   subject:
   - combat goes to the enemy;
   - a downed crew member goes to them;
   - a fire or breach goes to the room;
   - a shortage opens the relevant panel.

   Alerts clear themselves once resolved. Anything that isn't urgent goes to the log, not the alerts.
6. **The Esc menu:** Esc first cancels the active tool or aim. When there is nothing to cancel, it opens a medium-sized
   menu (about the size of the ship stock panel, or smaller) with resume, save and load, new game, controls and settings.

### Lessons: the tutorial system (user decisions, 2026-10-29; not built yet)

The goal chain (`src/sim/story/goals.ts`) says **what** to do next; lessons teach **how** a feature works. They are a
UI-layer system: they read the sim and its events, never change it, and are not part of the game save.

- **Just-in-time, not scripted.** A lesson fires the first time the player meets a feature: the first fight, the first
  build, the first trade. There is no scripted opening sequence; the goal chain gives direction, and a goal row can link
  to a lesson ("Show me how").
- **Coach marks.** Each step is a short callout pointing at the real thing: a UI element or an object in the world (a
  module, a station). A lesson is a few steps, a few lines each.
- **Pause.** The game pauses while a lesson is open and resumes when it closes. A step that needs time to pass (watching
  shields recharge) says so and runs the game during that step.
- **Completion per step.** A step either waits for the player to do the thing ("Press Q to arm a weapon", done when they
  do) or just needs "Got it".
- **One at a time.** Lessons queue, with a cooldown between them, and wait while something urgent is on screen.
- **Remembered per profile, not per save.** Seen lessons are kept in the browser profile. Settings has "Reset
  tutorials", and every lesson can be replayed from Help (#167), whose index is built from the same definitions.
- **Content, like everything else.** Lessons are TS objects (`satisfies LessonDef`) referenced by string ID. UI elements
  carry a `data-lesson` anchor from a typed list, so a missing or renamed anchor fails the typecheck. World anchors use
  the screen projection the module quick panel uses.

## Open questions

- Mood and breakdown severity.
- Lore specifics: factions, species list, story arcs.
- Recoverable failure mode.

## Generated ships

Enemy ships are generated at encounter time from a **faction** (`src/content/factions/*.ts`, `satisfies FactionDef`).
Each faction picks a building style, its **motif**; the generator (`src/sim/shipgen`) varies the layout within it.
It is deterministic from a seed, which is stored on the ship (`Ship.gen`) together with the faction and depth; the
grid itself is saved, so nothing is regenerated on load. The player's starter ship stays hand-made.

- **Faction def:** motif id and art variants (hull, wall, roof, livery, signature modules; looked up by the renderer
  later), hull grammar, chunk library, weighted room pool and required rooms, per-room fill, weapon and shield pools,
  crew roles and species, doctrine and boarding, and a **budget scaled by sector depth** (pods, i.e. hull length,
  weapons and heavy-weapon chance, shields, engines, reactor cap, point defence, crew).
- **Silhouette:** a straight corridor along x with pods on both sides, the bow chunk at the west end and the engine
  block at the camera-facing east end, plus bolted-on nubs. Chunks are hand-made ASCII (floor letters name rooms:
  fixed roles or free slots).
- **Rooms:** fixed-role letters keep their role (bridge, engine, reactor…); slots get the required roles first,
  enough gun rooms for the weapon budget, then the weighted pool. Symmetric motifs give mirrored slots one role.
- **Modules:** engines (rot 1, stern hull), helm and consoles, shuttle bay (boarders), airlock, AI core and point
  defence, weapons, shields, beds and life support (living crews only), room fill, reactors to cover the demand, then
  lights. Each placement hugs walls, keeps door sides, access tiles and chairs open, keeps a clear tile between
  roof-mounted modules (turrets, dishes, masts) and keeps every walkable tile connected.
- **Validation** repeats the layout tests' checks on the template (floor and hull placement, overlaps, chairs and
  access, reachability, power, helm, engines on the stern, reactor). A failed layout is reseeded, up to 24 tries.
- **Motifs so far:** *Scrapper raiders* (lopsided, nubs and gaps, crates, cheap guns, a shuttle; they board),
  *Drones* (mirror-symmetric, one repeated pod, AI core, no beds or life support) and *Navy* (mirrored hull with a
  tapered nose and broad engine block, rooms may differ side to side, heavy weapons and shields).
- **Try it:** `npm run shipgen -- <faction|all> --from 1 --count 12 --depth 4` writes PNG contact sheets, ASCII dumps
  and validation summaries to `tools/shipgen/out/`; `/tools/shipgen/` on the dev server rerolls live. In game,
  the debug panel has *Gen scrapper / drone / navy*, and `?shipgen=1` (or `=navy`…) with `&depth=N` makes
  *Spawn raider* generate one.
- **Follow-ups:** drones are captured by disabling the AI core (needs a sim rule); a robot species (drone crews spawn
  as humans and breathe for now); motif art variants; real sector encounters picking faction and depth.
