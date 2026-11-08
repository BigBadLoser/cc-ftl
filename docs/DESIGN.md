# Design

## Index

One line per section; read the index, then only the sections your task touches.

- [Pillars](#pillars): Depth from systems interacting. A few simulation systems that multiply each other beat many
- [Setting](#setting): Gritty industrial with a cyberpunk edge: corporations, salvager clans, augmentation cults, militaries.
- [Structure](#structure): Persistent sandbox with normal saves. A recoverable-failure mode (escape pods, salvaging back)
- [Ship & building](#ship--building): Tile grid, full-tile walls, no roof. Walls are low bevelled blocks that autotile by neighbour
- [Crew](#crew): Roles (engineer, gunner, medic, security, pilot…) give a default priority set; a per-crew
  - [EVA and spacesuits](#eva-and-spacesuits): Suits live at the airlock. There is no locker module and no suit item. Each airlock holds a few suits (a...
  - [Robots and the rogue AI](#robots-and-the-rogue-ai): Robots are not crew, androids will be. A robot is a moving module run by its ship's AI core: not an...
- [Ship systems (M3 decisions)](#ship-systems-m3-decisions): Power: one network per ship for now, with module priorities deciding what loses power in a
- [Combat](#combat): FTL's decision-making with physical consequences, in a shared sector.
- [Exploration & events](#exploration--events): Away teams board derelicts and stations (they're grids in the same world).
  - [Salvaging derelicts (user decisions, 2026-11-01; not built yet)](#salvaging-derelicts-user-decisions-2026-11-01-not-built-yet): Salvage is one order from the inspector. The crew then run it on their own, like any other work.
  - [Air, away sites and salvage (#286; built)](#air-away-sites-and-salvage-286-built): Rebuilds salvage on general systems: suit air as a crew drive (crew AI Phase 3), away sites with passage jobs, crew rotation and shuttle round trips; salvage becomes an away site plus its jobs. Issue #286.
- [Starmap and factions](#starmap-and-factions): Galaxy: endless, generated in chunks as you push outward, shaped by a terrain of dense filaments, nebula...
- [Economy](#economy): General model from day one: items with tags and stack sizes, storage, recipes (inputs, outputs,
  - [New modules: comfort, medical, gear, food (user decisions, 2026-11-04; not built yet)](#new-modules-comfort-medical-gear-food-user-decisions-2026-11-04-not-built-yet): Arcade, recovery pod, workbench, water purifier, hydroponics crops and meals...
  - [Trade](#trade): Credits are a separate currency, shown in the top bar. You can also barter: items for items, no credits.
- [Progression (user decisions, 2026-10-26; not built yet)](#progression-user-decisions-2026-10-26-not-built-yet): Depth should pay off: better gear, a bigger ship and new stories come from going further out, so credits...
  - [Core loop direction (user decisions, 2026-11-08; issue #52)](#core-loop-direction-user-decisions-2026-11-08-issue-52): Emergent goals, research over buying plus drop-only loot, danger is distance, no empty nodes, escape pods later. Each gets its own design discussion.
  - [Weapon upgrades and flak (user decisions, 2026-11-04; not built yet)](#weapon-upgrades-and-flak-user-decisions-2026-11-04-not-built-yet): Upgrades are items slotted into ship weapons, one slot each...
  - [Drones (user decisions, 2026-11-04; slice 1, inside the ship, built)](#drones-user-decisions-2026-11-04-slice-1-inside-the-ship-built): Small flying robots run by the AI core, inside and out: defence, repair and medic...
  - [Where blueprints are sold (user decision, 2026-10-26)](#where-blueprints-are-sold-user-decision-2026-10-26): Each station type has its own reason to visit:
  - [Pirate factions and the black market (user decisions, 2026-10-26 and 2026-10-27; the factions (slice 1, #135) and the black-market services (slice 2, #136) are built; spawning the named markets is not)](#pirate-factions-and-the-black-market-user-decisions-2026-10-26-and-2026-10-27-the-factions-slice-1-135-and-the-black-market-services-slice-2-136-are-built-spawning-the-named-markets-is-not): Today there is one pirate faction (the Scrappers) and the pirate den, a hostile station built to be...
  - [Contraband inspections in the world (user decisions, 2026-11-08; issue #138, built)](#contraband-inspections-in-the-world-user-decisions-2026-11-08-issue-138-built): navy and corporation inspectors board by shuttle (or EVA), search the hold, carry contraband off, and the fine or bribe is settled with the lead inspector through an alert; a patrol hails you mid-jump to stop for them; refusing turns a patrol hostile, and fighting them turns their side on you.
  - [Prisoners and prizes (user decisions, 2026-10-27; issue #116)](#prisoners-and-prizes-user-decisions-2026-10-27-issue-116): End of a fight with every enemy crew member subdued: you choose "let them go" or "take prisoners".
  - [Faction specialities (phase 2 stock)](#faction-specialities-phase-2-stock): Station kind still decides what a station sells (see "Where blueprints are sold"); the owner faction...
  - [Ship growth](#ship-growth): Early: expanding the hull needs a refit at a station (a shipyard service): pay, dock, and the station...
  - [Money](#money): No crew wages. Credits are mostly for buying things: gear, upgrades, materials, fuel, station repairs,...
  - [After the tutorial: story missions](#after-the-tutorial-story-missions): Self-contained stories, not one overarching plot. Each mission is a short arc with its own setup and...
- [Art direction](#art-direction): Isometric pixel art in the spirit of Space Haven: 2:1 isometric, 64x32 px tiles, detailed and
- [UI](#ui): Layout: a full-screen game view with Svelte panels over it.
  - [Combat view (user decisions, 2026-10-29)](#combat-view-user-decisions-2026-10-29): It replaces the colony HUD during a fight: the nav strip, node strip, drawers, build tools, inspector and...
  - [UI soft rules (user decisions, 2026-10-28)](#ui-soft-rules-user-decisions-2026-10-28): These are soft rules. They set the default direction. An agent or session should always feel free to suggest
  - [Trade window and station panel (user decisions, 2026-11-05; built)](#trade-window-and-station-panel-user-decisions-2026-11-05-built): one floating trade window for every partner; the station panel as an open comms channel with a contact per service and a live sensor view.
  - [Boarding in ship combat (user decisions, 2026-10-29; not built yet)](#boarding-in-ship-combat-user-decisions-2026-10-29-not-built-yet): The sim already boards both ways (shuttle, dock at an airlock, crew fight aboard, hold the bridge to...
  - [Lessons: the tutorial system (user decisions, 2026-10-29)](#lessons-the-tutorial-system-user-decisions-2026-10-29): The goal chain (src/sim/story/goals.ts) says what to do next; lessons teach how a feature works. They are a
- [Open questions](#open-questions): Mood and breakdown severity.
- [Generated ships](#generated-ships): Enemy ships are generated at encounter time from a faction (src/content/factions/.ts, satisfies FactionDef).


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
  - **Food** is data: an item with `food: { nutrition, mood? }`. The best food in storage is eaten first, so cooked meals (60 / 70 / 80
    nutrition) go before `item.ration` (50), which is the emergency fallback printed at the galley from water (`recipe.ration`, 2 water makes
    3 rations); use the usual make-N / keep-N orders. Meals and crops: "Hydroponics and the galley" under New modules. The starter ships
    start with 12 rations, 16 good meals, 6 greens and a planted bed (the food indicator starts green: about an hour for four crew).
  - **Mood** (0..100) is 50 plus named factors, shown on the crew card as "Hungry -10, Company +3". Factors: hunger
    (starving -25, hungry -10, peckish -3, well fed +4), rest (exhausted -15, tired -8, rested +4), a hot galley meal
    +6 for 5 minutes (a ration at the galley +3; a cooked meal +5 bland, +9 good, +13 fine, set by `food.mood` on the item), the last sleep in a bed +5 or on the floor -6 for 10 minutes, the room (dark -5, stale air -8, thin
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
  - The tank lasts 10 game minutes of thin air (a breached room, the airlock, the hull outside). It does not drain in breathable air, and refills only when the
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
  - **Logistics** (user, 2026-11-04): rolls on the floor like a roomba and only hauls materials, from the floor to storage
    or from storage to a build site.
  - Flying drones are not a robot class: they are their own system ("Drones", below), not crew on the job scheduler.
    NPC robots keep their own roles.
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
- **Events are data:** trigger context, signal text, remote actions with **requirements** (species, implant, skill,
  module, item, reputation), scene specs and outcome rules as data.
- **Persistent flags and arcs:** the pirate you spared comes back; the corp you robbed puts out a bounty.
- **Skill checks show their odds** (scans and remote reads).
- Event pools are weighted by danger tier and faction territory (the current node's, set on every jump).
- **Presentation:** a signal pauses in a small window; flavour and optional leads arrive in-world and can be ignored.

### Physical encounters (user decisions, 2026-11-03; not built yet)

Issue #173. Build after #287, which generalises away-site owners. Scenes replace the stubbed `physical` outcome.

**Principle: emergent objectives.** The game creates situations, constraints and opportunities, and the player decides what to do.
An encounter is a part of a living world, not a quest dressed as a scene. The scene says what exists and under what conditions.
It never says how it ends.

**Flow.** Signal, investigate, scene, consequences.
1. **Signal (transit only).** A hop of a hyperspace trip may draw an encounter (never the interdicted hop). A window opens with what the
   sensors caught.
2. **Remote actions only:** scan, hail, or ignore. A scan or hail may reveal facts (crew count, cargo, a lying story) and nothing else
   happens. Ignore continues the trip, and nothing was spawned.
3. **Investigate.** Any other answer drops the ship out mid-lane into a temporary pocket scene (the event grid `enterEvent` opens today).
4. **Scene.** The player acts through interactions the game already has. The sim decides what happens.
5. **Leave.** The trip resumes at the same hop. Leaving is **blocked while crew or a shuttle are away**. There is no universal penalty
   for leaving. What it costs depends on what you committed to (a passenger you promised to carry, a repair you began). Explicit
   abandonment comes later.

**Three parts, kept separate.**
- **(a) Triggers.** Which encounter is offered. Today the transit draw (`storyAtHop`, `drawEvent`). Later the in-node pool of #300
  (flares, nebula blackouts, arrivals and departures), which never draws transit events and is never drawn by them.
  **Danger tiers decide which encounters can appear** (a derelict at danger 0 to 3, an ambush at 1 or more, raiders around a
  freighter only deeper). They do not scale every ship, crew or reward.
- **(b) Scene specs (new).** Data saying what exists and its conditions. One spec, shared by story encounters and fleet encounters;
  `enterEvent` and `leaveEvent` are generalised from Fleet and Encounter to take it, and a fleet encounter becomes a spec built from the fleet.
  - **A spec holds:** ships (faction, role, crew, cargo, stance: hostile, neutral, helpless, and a story the crew tell); derelicts (ruin
    level, cause, infestation); drifting containers; boarders; a patient; optional timers.
  - **Seeding.** A scene id is built from the world seed, the event id and the hop, so the same signal gives the same scene on a reload.
    Names, hulls and cargo come from the existing generators (`spawnContact`, `spawnShip`, `spawnDerelict`, `spawnDriftingContainer`).
- **(c) Outcome observer (new).** It watches sim events (repaired, boarded, captured, destroyed, traded with, salvaged, left, patient
  boarded or died). Reputation, flags and log lines come out of it, by rule data per scene (`on: captured -> rep -X, flag Y`). No script says
  "if you chose help, then...". Trading, boarding, capture, salvage and combat already emit what it needs; gaps are filled by new events,
  not new interactions.

**Interactions reused.** Hail and trade (`trade.hail`, couriers, deals); boarding and capture (`orderLaunch`, `capturePrize`, surrender,
rescue); a salvage or explore order on an away site (`away.open`, owner generalised by #287); combat; the pickup and rescue jobs.

**Persistence.**
- **Transient** (traders, ambushes, a freighter): wiped on leave. Ships still alive go back to the map as descriptors, as fleet encounters
  do today. Salvage not taken is lost. What you took stays with you.
- **Persistent discovery** (derelicts, facilities): **cleared on leave for now.** The scene id is stable and the spec records "discovery",
  so it can later get a node record and a map marker, and be regenerated from its seed plus a saved diff **(new, later)**.

**Passengers (new state).** A rescued person aboard who is not crew. A passenger can ask for transport to a place, pay on arrival, leave
at a port, or offer to join. They need a bed and air, and can die. Hiring today is port-only; the offer is the only way they become crew.

**Timers (new, optional).** A scene may carry timers (a reactor, raiders on the way, a bleeding patient). The sim reads them; they are not
scripts. Not every scene has one.

**Order of building, each checked in play before the next:** 1. shared scene infrastructure and the outcome observer; 2. trader skiff;
3. derelict (the first major gameplay milestone); 4. pirate ambush; 5. distress freighter; 6. medical pod with passengers.

**First batch.**

- **Trader skiff** (`trader_swap`). Eligible: any danger.
  - Signal: an unknown skiff on the lane, transponder on.
  - Remote: hail (opens a trade preview of its stock), scan, ignore.
  - Scene: one neutral skiff, a small odd stock, a crew of 1 to 3. If hailed, it holds station.
  - Approaches: trade; barter; board and rob it; fire on it; wave and leave.
  - Observed: traded -> small reputation with traders; boarded or captured -> reputation loss, flag; destroyed -> a wreck to strip, reputation loss.
  - Persistence: transient. Timer: no.
- **Derelict** (`derelict_sighting`, `notice_beacon` lead). Eligible: danger 0 to 3, an EVA shuttle stowed. **Built (#173 step 3).**
  - Signal: a dead hull, power signature unclear.
  - Remote: scan (make, condition and cause, air and fires, jammed doors, life signs or machine signatures, loose cargo); a hacking scan (hacking 2)
    is a deep read with counts, gives no items (user ruling, 2026-11-04); ignore. With practice (`derelicts_found` 2 or more) any scan reads counts.
  - Scene: one derelict from the derelict generator, ruin level and cause rolled, infested half the time (aliens in a living faction's wreck);
    torn-off containers drift beside it. Hazards are conditions of the hull (thin air, fires, jammed doors), not set pieces.
    Rogue robots at the ruin pass's machine points are deferred (#310); loose containers stay scenery until container pickup exists.
  - Approaches: run a salvage order (the away site does the rest); explore by hand, with no explore order (user ruling): draft crew, take them
    out in the shuttle, hover beside the wreck, crew out (EVA), order them around inside, force jammed doors (tile inspector), Back to shuttle,
    return; strip the hull; leave it.
  - Observed: salvaged -> items, `derelicts_found` (read by the scan); infestation killed -> `infestations_cleared`; crew lost -> log; left ->
    flag `derelicts_left` only.
  - Persistence: **persistent discovery**, cleared on leave for now. Timer: no.
- **Pirate ambush** (`pirate_returns`, once, after sparing a pirate; flag-queued, still waits for transit). **Built (#173 step 4).** Rulings taken in the build, open to the user: the flag is the existing `spared_pirate` (set by letting the scout of `pirate_captive` go); both variants ask to dock after the same delay with the same request (user ruling): a trap's party turns 10 s after landing and refusing it turns the trap hostile at once; an honest skiff, let in, sends a party of 1-2 unarmed, pays (the `delivered` rule: +4 missiles on the floor just inside the airlock for the haulers, `items` effect `at: 'visitAirlock'` (user ruling), reputation +2, `spared_pirate` cleared), stays about 6 s, goes home in its shuttle and jumps away; refused it pulls away with the debt unpaid (flag cleared, no hostility, no missiles); strike first = fire on the skiff (any shot is the ordinary provocation); a scan's rows sharpen with gunnery (guns), piloting (craft) and hacking (crew, transponder slip).
  - Signal: a skiff hails you, claiming a debt owed. The story sometimes does not add up (a name that changes, a transponder that lags).
  - Remote: scan (sensors show weapons, a boarding craft, extra crew, and your crew's skills sharpen the read), hail for more talk, ignore.
  - Scene: the pirate's skiff, trap or honest (set by the scene seed). A trap has a boarding party of 3 and a shuttle, not yet hostile.
  - Approaches: trade and listen (+4 missiles if honest); keep crew at the airlock; strike first; refuse docking and run.
  - Observed: honest and traded -> reputation, flag cleared; ambush boarded -> flag; boarders killed or subdued -> reputation with pirates falls,
    their loot; skiff destroyed or captured -> flag.
  - Persistence: transient. Timer: no (the boarding comes when you let them dock). Needs a boarding trigger outside combat **(new)**: a docked party turns hostile.
  - Later (not built): once relationships and crew interactions exist, this encounter may be slightly expanded, for example the visiting pirate chatting with crew he met before, or a crew member's read of him.
- **Distress freighter** (`distress_call`).
  - Signal: a drifting freighter's call, cause uncertain (reactor, raid, drive).
  - Remote: hail (get the crew's story and what they offer), scan (hull and cargo, whether raiders are near), ignore.
  - Scene: a crippled freighter (traders, helpless) with crew and cargo. Deeper, raiders may already circle it (scene seed).
  - Approaches: repair it; rob it; capture it; attack it; leave with a promise; take survivors.
  - Observed: repaired -> reputation, gift by hail; boarded and robbed -> reputation loss; captured -> prize rules; destroyed -> wreck; left
    while repairing -> its fate follows its own timer.
  - Persistence: transient. Timer: **yes** (a failing reactor, or raiders on an arrival clock when present).
  - **User rulings (2026-11-06):**
    - **Aid by hail.** Help is agreed in the comms window (offer help, they accept). The away party then goes aboard as invited guests
      and does not provoke while it works. Going aboard without that agreement is boarding, as today.
    - **Reactor: fires, then it blows.** As the clock runs down, fires break out and spread aboard the freighter. At zero it becomes
      a wreck (salvageable), and anyone still aboard is in danger. Repairing the failing reactor in time stops the clock.
    - **Raiders, by seed, deeper only:** some scenes have them already circling the freighter when you drop out, others have them
      jump in on a clock that the scan warns about.
    - **Survivors later,** with passengers (medical pod, step 6). The freighter is built without them.
    - **Round 2 (2026-11-06):** its crew cannot repair (a per-crew work block, the general mechanism traits will use); the clock starts at
      deploy and runs 150-165 s, fires in its last 30 s (a party sent at once finishes with 17-81 s to spare over 12 seeds; the slow ones
      are reactors in hot rooms, where the party fetches suits first); the reactor blast is real (module damage,
      breach, crew hurt by distance, fire), then the ship goes dark and wrecks, and guests aboard face fire and vacuum, not instant death;
      enemy AI targets a recent attacker first, then its prey, then other foes, so raiders turn on a player who shoots them.
- **Medical pod** (`medical_emergency`). Eligible: a bed aboard.
  - Signal: a pod beacon with a faint life sign.
  - Remote: scan (patient's injury, species, skills hinted), ignore.
  - Scene: a drifting pod and its one patient (named, hurt, species, 1 to 3 skills).
  - Approaches: fetch the pod by shuttle or crew; treat them; bring them to a port; sell them; leave them.
  - Observed: boarded -> passenger state; treated -> reward and goodwill; died -> log; delivered -> payment; offers to join -> recruit prompt.
  - Persistence: transient. Timer: **yes** (a bleeding patient).
  - **Built (#345):**
    - The pod is a vehicle, `vehicle.escape_pod` (`VehicleDef.escape`, `src/sim/vehicles/escape.ts`): one seat, no pilot, the 3x3 pod
      bay. Asked in, it flies to a free airlock and docks; crew carry the patient to a bed; it casts off empty. Occupants inside a vehicle
      take vitals (bleeding runs aboard). Later: pod bays on ships, enemy crews ejecting, the player's own abandon ship.
    - A passenger is a lodging guest, not a new system: a `ConsentC` grant on the player's ship `by: 'passage'` with `lodge`. They own a
      bed, eat and sleep, pitch in on chores at the lowest priority, are never drafted or armed, and flee fights. `roleOf`
      (`src/sim/consent/roles.ts`) is the one place that says what a person is to a ship (crew, recruit, station, passenger, guest).
    - Rules fire after the scene's pocket is gone (`fireRules`, `scene/rules.ts`; per-person memory on `Grant.carry`): `helpedPerson`
      (getting up pays their purse, +1 standing with their faction, and posts a passage card), `personDied`, `personDelivered`.
    - Passage job: a port of their faction within 3 jumps, fare 50 + 45 per jump, due in 6 + 3 per jump turns; refused, they get off at the
      next port. The handover is the recruit run, generalised (`galaxy/handover.ts`).
    - Join offer: on delivery, or while aboard, a passenger whose mood is above 60 may ask to join (an alert with Accept / Decline, lapses
      after 2 minutes; no handover moves them meanwhile). Accept makes them crew as recruits become crew. Mood 60 is meant to need great care.
    - Not built: selling a patient (waits for a prisoner hand-over service, #116), fetching by EVA with a spare suit, crew first aid.

**Settled (user, 2026-11-03).**
- A persistent derelict gets a map marker as soon as it is found.
- A passenger's transport request shows as a job card in the jobs panel, to accept or refuse.
- Observer rules are shared by default (one "helped a ship in trouble" rule for every encounter where you help a ship), and an
  encounter may add or override a rule when it has a reason (robbing the pirate you once spared sets a "betrayed" flag). The world
  reacts the same way to the same action wherever it happens.

### Salvaging derelicts (user decisions, 2026-11-01; not built yet)

Rebuilt on general systems (#286): see [Air, away sites and salvage (#286; built)](#air-away-sites-and-salvage-286-built). The salvage teams below are what #277 built; since #286 slice 3 an away site does their work.

Salvage is one order from the inspector. The crew then run it on their own, like any other work.

- **The order:** select a derelict. Its inspector has a salvage panel: tick any or all scrap types, then click **Salvage**.
  That is the whole player flow. The build tools never work on derelicts.
- **Scrap types.** Each module yields one type; tiles that aren't modules yield Hull Scrap. How much a part yields scales
  with its build cost, and stripping gives back less than building it cost, so salvage never beats mining and trade for
  bulk materials. A rare extra is a chance roll per batch, which makes stripping a big wreck worth it.

  | Type | Stripped from | The scrapper gives | Rare extra |
  |---|---|---|---|
  | **Hull Scrap** | hull plating, walls, beams, floors | metal | none |
  | **Tech Scrap** | consoles, computers, sensors, shield and medbay modules, doors (#312) | electronics, some spare parts | drone tech |
  | **Energy Scrap** | reactors, batteries, engines, power conduits | spare parts, electronics, metal | fuel |
  | **Weapons Scrap** | turrets, launchers, magazines, armouries | spare parts, metal | a missile, or a hand weapon |
  | **Comfort Scrap** | furniture, beds, kitchens, lounge and storage fittings | polymer, cloth | none |

  The order only strips the parts that yield a ticked type.
- **Cloth** is a new item. Comfort Scrap is its first source; a later loom-type module will make it.
- **Robots are not part of salvage.** Robot wrecks and rogue AI hardware will get their own flow, tied into research
  (design to come). Salvage leaves them alone for now.
- **Stripping:** crew deconstruct the wreck's parts the way they deconstruct anything else, but the yield is scrap of
  that part's type. The wreck visibly comes apart, and it is gone when nothing is left.
- **EVA work:** most derelicts are breached, so salvage is a spacesuit job. The shuttle ferries crew out to the wreck,
  hauls packed scrap back to the ship (into the scrap bins) and brings crew home when they need rest, food and so on.
  Walking across through a docked airlock is not part of it: the deploy screen never places a derelict that close.
- **Aliens first:** a derelict can't be salvaged while anything hostile is aboard: a living, non-surrendered hostile, an
  egg sac or a nest. Once the wreck is cleared, the salvage panel opens.
- **Suit air:** crew refill their suits at the hovering shuttle, or at an airlock on the wreck that hasn't been stripped yet.
- **Processing:** a new **scrapper** module turns scrap into materials (electronics, metal and so on). It is crew work,
  like any crafting module.
  It is buildable from the start; the starter ship doesn't come with one. Scrap goes into the existing **scrap bin**
  asset (the industrial tip bin made for the refinery).
- **The scrap types replace the generic `item.scrap`.** Events and trades that use it switch to other items. The
  fabricator recipes that turned scrap into metal, electronics or polymer give way to the scrapper. Rations will use
  hydroponics output once that works. Starting crates hold basic metal, electronics and polymer instead of scrap.

### Air, away sites and salvage (#286; built)

Salvage had its own crew controller: team picking with builder/hauler roles, suits tied to a shuttle, refill trips,
emergency pickups, cargo-run riders. This replaced it (built in #286 slices 0 to 3) with three general pieces that other off-ship work can use later.
A door that cannot open (a derelict's unpowered airlock) is never a way through, for any crew member (#292).

#### 1. Air as a need

- **The air need is a drive**, like recharge for robots: when the tank gets low the crew member goes to a source, fills up
  and comes back. It exists only while they wear a suit in thin air (when the tank drains). Robots and other `airless`
  bodies never have it and never take a suit.
- **Times, not steps.** Every air decision uses real travel-time estimates (*travel time*):
  - walking: each tile at the walker's move speed (suit multiplier, traits), diagonals √2;
  - doors: their opening time;
  - airlocks: one cycle (`cycleSec`);
  - shuttle drifts: distance over `floatSpeed`;
  - shuttle flights: distance over the vehicle's speed, plus dock or launch time.
- **When it fires.**
  - *Refill* when the air left is under the larger of 30% of a tank and 1.5 × the travel time to the nearest source + 30 s.
    The crew member leaves the job at its next safe point (a hauler puts the load down first), refills and comes back to
    the **same job**, which stays theirs. Progress on a job is never lost; it lives on the job.
  - *Critical* when the air left is under 1.2 × that travel time + 10 s, or under 10%. **Survival overrides every task class,
    `finish` included.** A rescuer carrying a patient sets them down on the nearest tile where they are safe, if one is
    within a few steps (else where they stand); the patient keeps their bed claim and the rescue job is posted again. Then
    the rescuer refills.
  - The drive ends when the tank is full.
- **Partial work.** The scheduler doesn't need a whole job to fit in one tank. It admits a suited (or suiting) crew member
  for a job if the travel time there, plus at least one *work stint* (60 s of work, or what is left of the job if less), plus
  the travel time from the job to its nearest source, plus 30 s, fits in the air they have. A fresh suit counts as a full
  tank. Long jobs are then done in stints with refill trips in between. A job whose site no source can be reached from is
  never admitted for a suited walker.
- **Sources** are found by reachability on the crew member's grid:
  - **An airlock's suit tile.** The airlock holds a finite **air store**, by default 3 full tanks (30 min). A refill draws
    from it. On a ship with working life support the store refills slowly (1 tank per 5 min). On a derelict it does not.
    An empty store is no longer a source (the module inspector shows it); suits can still be stowed there.
  - **A player shuttle hovering beside the grid**, within float range of a hull tile they can reach. They drift to the
    hatch, swap tanks and drift back (one drift out and back, no boarding). The shuttle has its own **air store**, by default
    6 tanks. It is refilled to full in its home bay or while docked at a player airlock with air in its store. A shuttle with
    less than one tank left is no longer a source and heads home on its next trip (see *Round trips*).
  - A player shuttle docked at an airlock on that grid counts through the airlock's tile and draws from its own store.
- **No source reachable: ask early.** As soon as a suited crew member in thin air has no reachable source, they are
  *out of air reach*, while the tank still has air:
  - their card shows it and an alert fires with the time left;
  - a **pickup request** goes out: the site's shuttle (or any free player shuttle with EVA, including one hovering beside
    the home ship) moves its hover point to within float range of them, and they float aboard;
  - if no shuttle can come, the alert says so. If the tank then runs dry, the **hazard** interrupt takes over (thin air
    with an empty suit is a hazard): its escape aims for breathable air or any source. If that fails, they go down and the
    normal rescue path takes them to a bed.
  - Crew rescue can't help someone who can't reach a source: the rescuer couldn't reach them either. Only a shuttle can.
- **Hostile rooms (user ruling 2026-11-06).** A room past a hazard line a suit keeps out (thin air; heat over 55°C up to the suit's
  90°C rating) is suited work: crew going to a job there suit up first, as for vacuum, and stay while their tank lasts and it is
  within the rating. Fire is never: a suit does not make standing in fire safe, and firefighting, breaches and rescues go at once.
- **Suits belong to wherever they are.** A worn suit is the wearer's; a stowed one is part of that airlock's or shuttle's
  stock. Stowing anywhere adds to that stock (already true of `doffSuit` and the float-back). `SuitC.vehicle`, `detached` and
  `SuitC.airlock` go. The rule that no shuttle strands anyone comes from the away party (below), not from suit ownership.
- **Built (slice 1):** the drive, its thresholds, the nested refill, the critical override and the pickup request with its alert
  (the shuttle that answers it came with slice 2b). Salvage teams keep their own refill until salvage moves onto away sites
  (slice 3, user decision 2026-11-02): under the drive they would draw on the shuttle's finite store before shuttles head home
  for more (slice 2b).
- **Home ship hull work** gets all of this for free: a crew member sealing a breach from outside refills at the airlock
  instead of running dry after the `suit.airLow` warning.

#### 2. Away sites

Built in slices 2a and 2b (#295); ARCHITECTURE.md "Away sites and the air drive" lists where the code differs. Salvage moves onto sites in slice 3.

- **An away site** is any grid other than the player's ship and bases where the player wants crew to work: a derelict, a
  prize, later a station or an event location. It is a mark on the site's ship entity plus a shuttle that serves it. A site
  **runs continuously** until it closes. There are no shifts: people come and go one at a time.
- **Who goes: passage jobs.** When the shuttle is at home and the site wants workers, it offers one **passage** job per free
  seat at the bay's boarding tile. A crew member takes a passage like any other job: at their priority level for its work
  category, compared with every open job at home, nearest crew first. The player steers it with the priority grid; nobody is
  a builder or a hauler.
  - A passage is only open to crew rested and fed enough to stay a while (rest, hunger, a robot's charge at least 60).
  - Seats beyond the shuttle's suits are passages for crew who don't breathe (robots, #284).
  - A passage costs its walk plus the estimated flight time, so a home job of the same level and urgency nearby still wins.
- **Which categories the seats get.** The site knows how much work of each category is waiting (or coming: salvage counts
  the loot its open stripping jobs will drop). Seats are split by that demand, the same way every time:
  - with fewer seats than categories, the categories with the most demand get one seat each (ties in the priority grid's
    column order);
  - otherwise every category with demand gets one seat, and the rest are shared by largest remainder (same tie order).
- **Home cover follows real needs.** There is no fixed reserve. Crew are held back only for what the home ship needs right
  now:
  - consoles that need an operator now (an open `operate` job);
  - open emergencies that still need hands: fires, hull breaches, downed or wounded crew.

  Passages rank below those jobs: nobody who could take one of them leaves while it is open. With no emergency there is no
  reserve, so a crew of 4 can send everyone eligible. Crew at a console never take a passage. Passengers who have boarded
  but not left yet step out again if an emergency they rank above their passage opens at home.
- **Getting there.** The shuttle waits up to 60 s for the passengers on their way, then flies itself (autopilot, like ferry
  runs). At the site it docks at a free working airlock if there is one, else hovers. Passengers go out (airlock, or `eva.out`
  in the shuttle's suits) and are then **ordinary crew on that grid**: the scheduler hands them the site's jobs by their
  normal priorities. While idle there they wait near the shuttle instead of wandering or stowing their suit.
- **Going home, one at a time.** While a crew member is away, a **return** drive wants them back aboard the site's shuttle:
  - *not urgent*: rest under 25 or hunger under 35. This is earlier than the sleep and eat drives, so they get home before
    they drop.
  - *urgent*: hurt (health under 50%, or carried aboard downed), a robot's charge critical, or air critical with no other
    source.

  Everyone else works on.
- **Waiting aboard.** Boarding ends the return task: the crew member is a passenger, out of the crew loop, and their needs
  keep running as they do for anyone aboard a shuttle. A non-urgent passenger waits for the next trip. If they fall to the
  sleep or eat thresholds while waiting (rest 20, hunger 10), they turn urgent. So waiting is bounded both by the trip
  timeout and by their own needs, and nobody sleeps or starves in a seat.
- **Round trips, batched.** The shuttle serving a site goes back and forth, and each trip carries as much as it can. It
  leaves the site:
  - **at once** for an urgent passenger, or to serve a pickup (a pickup moves the hover point; it needs no trip unless the
    person is hurt);
  - **otherwise only when** one of these holds (and once the shuttle has loaded what the staging zone holds, below):
    - the hold is full;
    - rotation is due: non-urgent passengers fill half the seats, or free seats exist that crew at home would take;
    - the trip timeout (5 minutes since the last trip, with anyone waiting aboard);
    - its own air store is under one tank.

  At home it drops off those going home, unloads the hold (the existing cargo hauls) and refills its air. Meanwhile it
  offers passages for the free seats, then flies back with the replacements. Cargo and crew always share the trip.
- **Staging and loading** (user design, 2026-11-03; built in slice 3). Crew don't carry loot into the hold one stack at a time:
  - each away site has a **staging zone**, a few floor tiles beside the shuttle's drop-off point (the hatch drop point when it
    hovers, inside the airlock when it docks), holding about two hold loads. It belongs to the away site, not to salvage, so
    mining and boarding loot can use it too;
  - the party hauls loose loot into the zone, whether the shuttle is there or away. Hauling **gathers** everywhere, the home ship
    included: a hauler picks up several nearby loose stacks up to their carry capacity and walks to the destination once. A full
    stack in the zone overflows to the next tile; the crates show it filling;
  - while the shuttle is at the site it **loads** the zone into its hold, one crate every 2 s;
  - trips are for crew (rotation, needs, hurt) or a full hold. A batch trip first finishes loading; an urgent trip goes at once.
    No trip waits on a haul or drops it: the loads go into the zone, which stays;
  - away crew no longer use the wreck's lockers. The ordinary ferry keeps its rule elsewhere.
- **The shuttle never strands anyone.** It may leave the site only if every party member staying out is safe, as defined in
  ARCHITECTURE.md ("Away sites and the air drive", "Departure check"). In short, each staying worker must either have another source they can reach (an airlock with
  air left, another shuttle) or enough air to last the whole round trip with a margin. The shuttle settles that before it
  goes:
  - first a *last call*: anyone short refills at the shuttle;
  - then anyone still short *rides*: they board and wait out the round trip aboard, and go back out when it returns;
  - if someone short can't get aboard either, the shuttle stays.

  While it is away it keeps checking. If any staying worker's margin runs out (a slow unload, a delayed flight), it skips
  whatever is left at home and flies straight back. Every trip goes through this check, urgent ones included. An urgent
  trip that can't pass it (a worker who is unsafe and can't board: downed out of reach, boxed in) waits. The urgent
  passenger stays aboard, where nothing harms them further, while the rescue or pickup brings that worker in.
- **The whole party comes home only** when the site closes (its work done, or cancelled), in a combat evacuation (a fight
  starts in the node), or on the player's recall. Then the return drive is full for everyone, the shuttle takes everyone
  aboard, and after 90 s it lifts anyone still out (downed with nobody able to carry them, boxed in). That lift is the one
  shuttle rule no crew system can replace.
- **Hurt crew.** A downed party member is a normal rescue job; on a site with no bed the rescue carries them to the shuttle
  (that counts as handing them in), and they go home on the next trip, which leaves at once.
- **Failures.**
  - *Shuttle destroyed*: the party stays on the site with their suits. Every worker who now has no source gets a pickup
    request, and the site asks for any other free player shuttle (a pickup run). With none, an alert says crew are stranded.
  - *Home bay lost*: the shuttle docks at a free airlock on the home ship and the crew walk in. With no usable airlock it
    hovers there and the crew float to the hull. Only with neither do they stay aboard, with an alert.
  - *Jump with crew away*: the jump confirm already lists crew and shuttles left behind; nothing new.

#### 3. Salvage on top

- A salvage order opens an away site on the wreck and closes it when the order is done or cancelled. The order, the panel,
  the planner (stage order, reach filter, floors last and farthest first), yields, the hostile block and wreck removal stay.
- The order tells the site its demand: stripping (construction) and loot (hauling, including the loot its open jobs will
  drop), so the first trip already has a hauling seat.
- The panel's "no shuttle" and "no crew" come from the site (no free shuttle with suits; passages open but untaken for a while).
- The wreck stays until the party has left its side, then goes as today.
- **Throughput.** Scrap brought home per game hour is held to the bench's baseline (ARCHITECTURE.md "Away sites and the air drive", "Throughput check"). With staging (slice 3) it was re-based: 6 crew bring home about 380 units a game hour (the salvage teams: about 370), and more crew is never slower.

#### How the general design covers each salvage special case

| Failure that shaped the salvage code | Covered by |
|---|---|
| Worker stranded on the wreck with no way to refill | Air drive by reachability. Admission needs a reachable source from the job. Floor order kept. An early pickup request while there is still air. |
| Low-air worker cut off (`needsRescue`, `carryAboard` below 10%) | The critical air drive overrides every task class. A pickup request as soon as no source is reachable. Hazard escape as the backstop. |
| Suits lost when the shuttle left on a cargo run (`detached`) | Suits belong to whoever wears them; nothing is tied to the shuttle. |
| Riders left behind on a cargo run (`mustRide`, 70% rule) | The departure check: last call, then ride, then stay. One exact rule for every trip, not a salvage rule. |
| Cargo run turning back for someone low or down (`needsShuttleBack`) | The watch while away: the shuttle turns back when any staying worker's margin runs out. A downed worker is never "safe", so it applies to them too. |
| Shuttle leaving with crew outside | `crewOutside` reads the party. The shuttle leaves only through the departure check. |
| Shift ending with a worker still on the wreck (Codex r4) | No shifts. A closing site ends only with everyone aboard, or with the lift. |
| Team must cover building and hauling | Passages split by demand, including expected loot. |
| One tired member ending the whole shift | Per-person return; batched round trips. |
| Busy shuttle taken by ferry, courier or boarding | The `SiteRunC` marker, checked by `ferryFree`, the courier and the launch. |
| Team member stowing their suit at the wreck when idle | Idle away crew wait by the shuttle, suited. |
| Hold could not be unloaded at home (`noRoom`) | The hold stays loaded and the trip carries on; loot waits on the site. The panel shows "no room at home". |
| Emptying the ship (half-the-crew cap) | Dynamic home cover: crew needed for open emergencies and unmanned consoles stay. |
| Robots never join (#284) | Robots take passages: no suit, no air drive. |
| No home bay (#284) | The home leg docks at an airlock, else hovers and the crew float in. |

#### Decisions (user, 2026-11-02)

- **Pilot:** the shuttle flies on autopilot, as ferry runs do. No crew member has to be its pilot.
- **Numbers:** start with these and tune in play:
  - refill at 30% or 1.5 × travel + 30 s; critical at 10% or 1.2 × travel + 10 s; a 60 s work stint;
  - home at rest 25 / hunger 35 (not urgent), health 50% (urgent); waiting passengers turn urgent at rest 20 / hunger 10;
  - passages only at 60 or more;
  - departure margin 1.25 × round trip + 30 s; trip timeout 5 min; rotation due at half the seats;
  - airlock store 3 tanks (refilling 1 per 5 min with life support), shuttle store 6 tanks.
- **A general "send a party here" order** comes only when a second feature needs it. Until then `away.open` is a debug
  command.
- **Follow-up (#287):** boarding launch and recall run on away sites (user decisions via the orchestrator, 2026-11-03): the
  player's pick is the site's named party, a boarding site carries on through its fight (`fight: 'stay'`), the party lands
  drafted, `crew.recall` calls members home on the site's run (an urgent trip; the run comes back for those who stay), and the
  site closes when nobody of the party is left. The boarding shuttle flies itself (no pilot pick). The shipyard's contractors
  are an away site on the player's ship (owner 'yard', the station's shuttle, the contractors its party) and draw air like
  anyone: a crew member draws a docked shuttle of their own side or run before the airlock's store.
---

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

### New modules: comfort, medical, gear, food (user decisions, 2026-11-04; not built yet)

Every new module feeds a system that already exists and changes play. None is decoration.

- **Arcade (game table).** A solo game cabinet that gives one player at a time a mood boost.
  - **Leisure spots and taste.** The leisure drive, a crew member on a break, picks a leisure module to use. Each module type
    gives its own mood factor ("Played the arcade +N"). Traits set preferences, and variety helps: using the same thing every
    break is worth less. No new need.
  - This is the frame for more comfort modules later (viewport, bar, gym).
- **Recovery pod.** A powered bed. A hurt crew member lies in it and heals to full over time with no medic, but is out of
  action meanwhile. Downed crew carried there are stabilised and heal. The medic drone only patches and stabilises where crew
  fall; the pod is where they get well.
  - Injuries are left for later: the pod works on HP, built so lasting injuries (and surgery) can slot in.
- **Workbench** (art already in the sheets: `module.workbench`). Crew make and repair personal gear here: suits, sidearms,
  tools, armour. The fabricator keeps ship-scale things (missiles, parts).
- **Water purifier.** Turns ice into water, a small dedicated alternative to the refinery's split-ice recipe.
- **Hydroponics, wired up (#59; built).** You pick a crop per bed. A crew member plants it (a farming job, own "Farm" priority column), the bed
  uses water and power, and the crop grows over time and is harvested as an item. Built numbers (content/crops.ts, first pass): greens 6 per 4:00,
  1 water; protein beans 18 per 10:00, 2 water; medicinal herbs 4 per 6:00, 1 water; grain 10 per 6:00, 1 water (price 5). The water is delivered
  to the bed for the planting job; growth runs only while the bed is powered. An empty bed draws no power (`ModuleDef.drawsWhen: 'planted'`; shown as Idle), a planted one draws 2. Two sizes: the 2x1 bed, and the buildable large bed (2x3, 3x the yield for 2x the water and power: 4 power, so the big bed is the efficient one); after a harvest the bed is sown
  again with the same crop unless the ship already holds that crop's stock cap. A crop in the soil is not disturbed by changing the pick.

  | Crop | Grows | Used for |
  |---|---|---|
  | Greens | Fast, small yield | Meals |
  | Protein beans | Slow, big yield | Meals |
  | Medicinal herbs | Medium | In stock, the med bed (built: x2 heal for the stay, one herb per treatment) and later the recovery pod heal faster |
  | Grain | Medium | A trade good for now; brewed into drinks later (bar, Drinker habit) |

- **Galley: meals by cook quality (#59; built).** Cooking produce with water into a meal is a cooking job (`recipe.meal_greens`, `recipe.meal_beans`:
  6 produce and 2 water make 2 meals), which makes the Cooking priority column work; so does printing rations. The cook's new `cooking` skill
  sets the quality (0 bland, 1-2 good, 3+ fine; medics start at 1) and the quality sets nutrition and the mood boost. Water-only rations stay
  as the emergency fallback. A medical bed (`medical`) is for patients only: they take it before an ordinary bed and sleepers never do.

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

### Core loop direction (user decisions, 2026-11-08; issue #52)

Each point below gets its own design discussion before it is built.

- **What next after the tutorial: emergent goals.** No captain's log or goal list (#172 is dropped). The world gives the
  player reasons to want things: better gear, bigger hulls and better jobs further out. Story missions as self-contained
  arcs (see "After the tutorial: story missions") are welcome alongside.
- **Research is the main path to better gear,** ahead of buying. Blueprints sold at stations were a stopgap from before
  research and can stay, but research gets fleshed out, together with **drop-only loot** (gear you can only find).
  Recurring money sinks are not the answer.
- **Research (discussion 1, user decisions, 2026-11-08):**
  - **Materials gate research, not credits.** New research materials that come from going out: data cores (derelicts,
    wrecked enemy computers), samples and alien tissue (anomalies, alien ships), artifacts (rare, deep space only, for the
    top tiers). They replace today's stand-ins (spare parts, rare ore).
  - **What the tree holds:** scanners and cloaking join it. No hull or armour research. Drones are research only, never
    known from the start.
  - **Drop-only loot:** unique named items with special effects, and prototype or alien versions of normal gear that
    research can't reach.
  - **The tree grows with discovery:** a solid baseline tree, plus projects added by finds (an alien artifact opens new
    projects).
  - **Ship weapons:** the burst laser and the mass driver are known from the start; missiles, ion, flak and incendiary are
    researched. Enemies carry the locked ones by faction: pirates flak and incendiary, navy and mercenaries missiles and ion
    (salvage from them is an early, risky way to get one).
  - **Implants (#311):** basic implants are researched; unique ones are found only.
  - **Scanners and cloaking:** a scanner sees enemy roofs, modules and crew, and what a node holds before the jump. A cloak
    is a combat ability (dodge fire for a few seconds, on a cooldown) and may slip past patrols and inspections.
  - **How finds add projects:** a find (an alien artifact, a prototype) is studied as a research project of its own, and
    the study reveals one or more new projects.
  - **Pace:** a project keeps one crew member busy researching for an extended time; research is a standing job on the
    ship, not a quick unlock. Rough targets in game time for one researcher: tier 2 about 30-45 minutes, tier 3 about 1.5-2
    hours, studying a find 20-40 minutes; science skill and a second lab speed it up. The baseline tree takes several hours.
- **Danger is distance.** No global threat clock. Deeper space is harder; the design work is giving players reasons to
  go there (research materials, drops, jobs and gear found only deeper).
- **No empty nodes.** Most nodes hold at least a few asteroids or smaller derelicts, so every hop has something to do
  (#171).
- **Losing the ship:** plan for escape pods (survivors reach a station with a worn starter hull, and the wreck can be
  salvaged back). Not urgent.

### Weapon upgrades and flak (user decisions, 2026-11-04; not built yet)

Upgrades are items slotted into ship weapons. Build plan: PROGRESSION_PLAN step 4.

**Rules.**
- **One slot per weapon.** Some upgrades are general and fit any weapon; others fit one weapon type only.
- **What they change.** General upgrades are small stat boosts and pure gains. Weapon-specific upgrades change how the weapon
  behaves, and each one carries a cost.
- **Fitting is a crew job.** You pick the upgrade in the module inspector. An engineer fetches the item and installs it, like a
  repair, and the weapon is offline while that happens. Removing an upgrade puts the item back in cargo intact.
- **Sources.** Bought at stations (the shady ones on the black market), found in salvage, researched (a blueprint, built
  at a fabricator).
- **Enemies carry them by faction.** Navy upgrades are precise, pirate ones crude, zealot ones fire-based. A scan shows them
  on the enemy card. Stripping an enemy weapon module that wasn't destroyed drops its upgrade; a damaged one may lose it, with
  a chance scaled by damage.
- **Visuals.** The upgrade's item icon shows on the weapon card and in the inspector. Behaviour upgrades change the shot's
  effect (tint, trail, blast). Small add-on art (a bolt-on part on the bay) only where it earns its place; no new bay models.

**First batch.** Numbers are a starting point for tuning.

| Upgrade | Fits | Does | Cost |
|---|---|---|---|
| Coolant jacket | any | −30% heat per volley | — |
| Quick capacitor | any | −15% charge time | — |
| Hardened housing | any | The weapon takes half damage from hits and ion | — |
| Prism splitter | burst laser | 5 shots instead of 3, each −40% damage | +50% heat |
| Heavy focus | burst laser | 2 shots, each pierces 1 shield layer | Slower charge |
| Frag slug | mass driver | Bigger blast radius, more crew and module damage | Loses shield pierce |
| Rail coil | mass driver | Pierces 2 layers; much faster shot | Runs very hot |
| Nuclear warhead | missiles | Huge blast; heavy hull, module and crew damage; fires across the blast | 2 missiles a shot; black market only |
| Chain coil | ion cannon | The ion arcs from the hit module as lightning into nearby crew | +40% heat |
| Thermite | incendiary | Real hull damage on top of the ignite, so it breaches as well as burns | More heat |

No radiation system: the nuke is blast plus fire, built from existing effects.

**Flak cannon (new weapon).** It fires scrap: one hull scrap item from cargo per volley, the way missiles use missile items.
Each volley is a spread of many weak pellets. Every pellet that hits a shield strips a layer, so flak knocks shields down for
the other guns. It does little hull damage and is inaccurate at range. It reuses an existing bay model, told apart by a tint.

### Drones (user decisions, 2026-11-04; slice 1, inside the ship, built)

**What a drone is.** A small flying machine that works inside the ship and launches into space. Drones are their own entity
(a drone component on a free body), run by one drone system, not crew on the job scheduler: no priorities, no orders, no crew
panels. Each drone type's job list is a direct target query. They share the low-level work with crew and robots (the repair,
extinguish and stabilise code, flying navigation, charging, the AI core link) and use the vehicles' free-body movement in space.

**Rules.**
- **The AI core runs them,** like robots. Its tier sets how many drones can be active at once (Mk I: 2, Mk II: 4, Mk III: 6).
  If the core goes down, every drone goes inert (it drops or drifts) until the core is back.
- **Drone bay (new module).** It holds and recharges 2 drones. Drones launch into space through a ceiling hatch, like the
  weapon hatches, so the bay doesn't have to touch the hull. Drones fly out of it into the ship as well.
- **Fully automatic.** The player gives no orders. Each drone does its job: defence drones launch when a fight starts,
  repair drones go to damage, medic drones go to the wounded.
- **Supplies.** A drone type may carry a small load of one item (the repair drone: 4 metal), topped up from the ship's storage while it
  is docked in a powered bay. A seal costs the wall's metal from that load; a drone without enough does not take breach work (module repair
  stays free). Medic supplies and drone ammo can use the same rule later.
- **Battery.** It drains while flying, faster while working, and recharges in the bay. Drones rotate home on their own when low.
- **Built, kept, lost.** Each type has a researched blueprint and is built at a fabricator from parts and electronics. Tech
  stations also sell them ready-made. A destroyed drone leaves scrap.
- **Jumping and leaving.** Charging a jump, or leaving a scene, recalls every drone. The departure waits a few seconds for
  them (longer the more there are: they dock one after another), the way leaving waits for crew. A drone that can't make it back in time is left behind and lost.
- **Weaknesses.** Ion or EMP near a drone or on its bay knocks it out for a while; a flying drone drops. Losing the core
  stops them all. In space, only point defence and enemy defence drones can hit a drone; ship guns (flak included) can't
  track one.
  - **Range in practice.** Fights are 40 to 100 tiles apart, and the first batch of drones stays near your own ship. At that
    range enemy point defence only covers its own ship, so in practice drones mostly
    fight drones. A combat drone that flies to the enemy (later) would be exposed to its point defence, so tune it then.
- **Enemies have drones too,** on the same system: rogue AI and navy ships.

**First batch.**

| Drone | Where | Does |
|---|---|---|
| Defence | Orbits your ship in space | Shoots down incoming missiles and enemy shuttles. Never fires at ships, so it can't provoke anyone. |
| Repair | Inside and outside | Seals hull breaches from outside (no crew on EVA), repairs damaged modules (slower than an engineer), puts out small fires. |
| Medic | Inside | Flies to the wounded and downed: stops bleeding, stabilises the downed so they don't die, heals slowly. Real treatment still needs the medbay and a medic. |

Later: combat drones that fly to the enemy and shoot (DESIGN "Combat drones": they build on the core's tier and the EMP effect),
and salvage drones.

**Slice 1 (built, #318): inside the ship.** The drone bay (2x2, two pads), the repair and medic drones, the core cap, inert on core loss,
ion knockouts, blueprints, fabricator recipes and station stock. The user's rulings (2026-11-04):
- Bays fill themselves: a free pad takes a drone item from the ship's storage, no order needed.
- The medic drone patches the downed (the bleeding stops) but does not get them up: rescue to a bed and a medic still do that.
- Only the Mk I AI core exists; the cap table already has Mk II (4) and Mk III (6) for when the core tiers come.
- Nothing damages a drone yet besides ion and core loss: drone damage comes with slice 2.
**Slice 2a (built on `drones/space-318`, awaiting review): space.** The ceiling hatch launch and landing, the defence drone (circles the
ship while a ship at war with it is in play; shoots incoming missiles, enemy drones and shuttles, never a ship), the recall on a jump, a
flee or leaving a scene (the departure waits 6 s, plus 1.5 s for each drone after the first, since they dock one at a time; drones still out are lost and logged), and drone damage (fire, hand weapons, and in
space point defence and enemy defence drones). Slice 2b (built, #318): enemy drones (navy and rogue AI ships carry a bay with one or two defence drones from sector depth 3; they guard their ship and shoot our missiles, shuttles and drones) and the staggered return (recalled drones dock one after another). Outside breach repair is built: a repair drone with 2 metal in its load seals a hull breach from outside. Code: ARCHITECTURE.md "Drones".

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

### Contraband inspections in the world (user decisions, 2026-11-08; issue #138, built)

Replaces the contraband scan pop-up (`InterdictModal`, #136) with inspectors who come aboard. Built in three steps: the
station dock inspection, then the patrol version, then refusing and fighting.

- **Where:** docking at a navy or corporation station sends its inspectors over by shuttle to a free airlock. A patrol
  that hails you mid-jump asks you to stop: comply and you drop out beside it and it sends a shuttle; run and you take a
  standing hit with that faction, and the patrol may give chase.
- **The search:** the inspectors walk to each storage module and search it for a few seconds. They also find contraband
  on crew they pass and anything fitted in a module (the `heldItems` list). The search takes real time, so the player can
  still move goods while it runs (into a shuttle, out an airlock): an emergent choice, allowed on purpose.
- **Seizure:** what they find, they carry back to their shuttle by hand, with the same carry jobs crew use.
- **Settling:** when the search is done, the lead inspector waits aboard and an urgent alert says so ("Inspector
  waiting: fine or bribe"). Clicking it jumps to the inspector and opens the options: pay the fine (with the standing
  hit), offer a bribe (it may fail), or refuse. No pop-up.
- **Refusing:** refusing the inspectors sends them home with what they seized, never turns anyone hostile (losing the goods is punishment enough):
  at a station, no service there and a standing hit; at a patrol, a bigger standing hit (user ruling 2026-11-08, replacing "a patrol turns hostile").
  Jumping away while any inspector is still aboard your ship carries them off: that counts as fighting them.
- **Fighting:** attacking the inspectors turns that faction hostile with a big standing hit; the patrol or the station's
  defences engage, and the inspectors fight back as boarders.
- **No way to dock** (no working or free airlock): the inspectors board by EVA, in suits, through any working door or
  breach, like boarders, and then search as usual. If there is no way in at all, they wait with an alert ("Inspectors
  can't board") until there is.
- **The pop-up goes:** `InterdictModal` is removed once both triggers play out in the world.

**As built (step 1, the station dock):**
- Opening trade with a navy or corporation station sends two inspectors (once per scan cooldown per node). Trade waits only while they search or wait
  for an answer; a clean search opens it at once.
- They search every storage module (sealed containers too) and every module with an upgrade fitted, about 5 seconds each, and take contraband off crew and
  floors within 2 tiles of them.
- The answers sit on the alert ("Inspector waiting: fine or bribe"); clicking its text jumps to the lead. The fine costs standing and the goods. A bribe is
  taken 60% of the time: the goods are handed back by the shuttle door; turned down, it costs standing and is not offered again. Refusing costs standing and
  the station's service for 10 turns (they keep what they took). Leaving the node while they search or wait counts as refusing.
- With no airlock free they cross in suits and land on the hull; with no way in they wait there under an "Inspectors can't board" alert.
- Inspectors show as visitors ("Inspector"), not hostiles (step 3 adds the Attack button).

**As built (step 2, the patrol hail):**
- A navy or corporation patrol hails only a ship its scan flags (contraband aboard); a clean ship gets the old passing scan. The hail stops the trip in
  hyperspace and opens a comms window: the captain on video, their demand, the patrol ship on the sensors. Their scan reads "Suspicious" and names
  nothing, so the hail does not tell you what they know.
- Comply: you drop out at the node you reached, the patrol stays there, and once you deploy its ship sends two inspectors by shuttle from where it
  arrived (about 100 tiles out, user decision: the flight gives you a little time). The search and the answers are step 1's.
- Run: a standing hit (3), and the trip goes on. Half the time the patrol chases you for 4 turns and hails again if it catches you; the chase is light on
  purpose (it follows like a hunter, one hop behind). Leaving before its inspectors come over counts as running, without the chase.
- Refusing a patrol's inspectors costs standing only (step 3 raised it to 8; no hostility, user ruling).
- The scan pop-up is gone.

**As built (#363, pirate interdictions in the comms window):** every hail that stops you mid-jump uses the same comms window. An interdiction shows the
pirate captain on video (a machine faction has no face: static), their demand (varied by faction, and by hunters, a route guard's toll or a plain raid),
their lead ship on the sensors with the ship count and strength, and Evade (odds), Bribe (price, disabled with the reason when short) and Fight. The numbers
are unchanged. After the answer the window stays open with how it ended and the caller's reply, and closes on Close channel. `InterdictModal` is removed.

**As built (step 3, refusing and fighting):**
- Refusing (the answer on the alert) sends the inspectors back to their shuttle with what they took, and nobody turns hostile. At a station it costs
  4 standing and the station's service for 10 turns; at a patrol, which has no service to bar, 8 standing.
- Leaving the node is keyed on whether an inspector is aboard your ship at the jump, whatever the phase (searching, waiting for the answer, or
  walking back after a fine, a bribe or a refusal). With one aboard it is an attack: everything under Fighting, and they come along as boarders. With
  none aboard before the answer (still on the way, or back on their shuttle) it is a refusal as above; after the answer it costs nothing more.
- Fighting: an inspector's panel has an Attack button for your drafted crew (the panel only, never a right-click order, so it is a choice). Attacking
  them, or firing on the ship that sent them while they are at work, costs 10 standing; the inspectors go over to their faction's side and fight as
  boarders; the ship that sent them turns on you with its group: a patrol and its fleet engage, and a station's own guns do (stations carry weapons).
  A station also refuses service for 30 turns.
- The fight ends when none of them still stands on your ship; the downed stay as ordinary hostile crew (to be taken prisoner). Jumping away mid-fight
  takes the ones aboard with you, still hostile, and they fight on. Leaving after the fight follows the usual rules (hostile faction, chases).
- There is no "refuse" answer at the hail itself: running is the way to refuse a patrol before it boards (step 2).


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

### Comms window (user decisions, 2026-11-05; #173)

- **The incoming-signal window** (a story signal with a scene behind it) is a centred, forced decision in three equal columns: VIDEO (HAIL, key H;
  static "NO VIDEO" until hailed, then the caller's portrait with LIVE, name, ship, faction and a status pill), COMMS (the transcript: narration in
  grey italics, each quoted line behind a cyan bar with its speaker) and SENSORS (SCAN, key S; static "NO SCAN" until scanned, then a hologram of the
  actual generated ship with callouts on its parts, and a label-over-value readout). The footer is Drop out and Fly on side by side.
- **Show, don't tell for tells:** the name tell flickers the caller's name (and the scan's transponder ID) to a second value every few seconds; the
  lag tell makes the video stutter. No text says so.
- **Reusable:** the pieces live in `src/ui/comms` and take plain props; adapters in `src/app/comms` build them from a source (a story signal today;
  trade hail, station hail and the in-scene panel later).

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
7. **Colour roles (2026-11-05).**
   - **Cyan** marks anything actionable: buttons, links, hover and selection. It is not a general accent, so headings, quotes, progress bars and borders aren't cyan.
   - **Green and red** are for confirm and deny actions, and for good and bad state: friend and rival, gain and loss.
   - **Amber** means warning.
   - **Gold** is for credits and rewards.
   - The build menu and the research screen keep their own black-and-amber look on purpose.

### Trade window and station panel (user decisions, 2026-11-05; built)

Mocks: `docs/refs/mocks/trade-window-k.png` and `docs/refs/mocks/station-panel-w2.png`.

**One trade window for every partner.** Trade leaves the station panel. A station and a trader ship open the same trade
window. It is a floating window that can be moved and pinned, not a modal, so it can stay open while shuttles fly.

- **Layout ("K").** One market list with a row per item: icon, name, aboard, what they pay, their stock, their price,
  and a −/+ quantity picker. A positive amount buys and a negative one sells, and the word BUYING or SELLING shows
  under the picker. Columns and headers are centred on each other, and the window is sized to its content (about
  1010px).
- **Quantities.** Click ±1, Shift ±5, Ctrl ±10, type a number, Alt for the max.
- **The deal slip** sits at the top of the right column. It reads the deal back: "Buy 20 rations − ₵280",
  "Sell 12 electronics + ₵372", with a red minus and a green plus before the gold amount. Then the total, where your
  credits end up, the shuttle trips, and Clear and Propose.
- **Queued deals.** Agreed deals queue in a Deliveries list pinned to the bottom of the right column, each with its
  trip progress and a Call off. You can build the next deal while a shuttle flies. This needs the sim to allow
  several deals per partner.
- Black market and truce are chips in the title bar, not paragraphs. Credits are gold.

**The station panel is an open channel ("U3" with the "W2" sensor column).** Three panes, as in the comms window:

- **Left, video:** a live feed of the contact for the open service, with LIVE, signal, call timer and a CONNECTED
  status word. Each service has its own person: dock control (the station overview), the quartermaster (trade), the
  job broker (jobs), the recruiter (crew), the archivist (blueprints) and the yard master (shipyard). Switching
  service switches the call, with a short static cut. Hailing plays static, then CONNECTING, then dock control. The
  channel stays open while you are nearby.
- **Middle, comms:** a line of narration, the contact's quote drawn from the real state ("Two runs on the board. The
  Fenix one pays, if you've got the guns for it."), then the service's content (job cards, recruits, blueprints,
  yard).
- **Right, sensors:** a hologram of the station with callouts (docks free, defence) and live traffic drawn on it:
  your ship in green holding off, your shuttle as an amber mark with its trip count, other ships faint. Under it, a
  three-line traffic log, newest first ("Shuttle left airlock 2 with 8 rations", "Yard crew 12 of 40 tiles laid").
  Then the owner and the services as decision buttons; Trade opens the trade window.
- **Art:** the hologram is the station's 48px starmap icon, scaled up and tinted cyan with scanlines in code
  (`StationSensors.svelte`). The user preferred it to dedicated hologram sprites (2026-11-08), so none are planned.

### Boarding in ship combat (user decisions, 2026-10-29; not built yet)

The sim already boards both ways (shuttle, dock at an airlock, crew fight aboard, hold the bridge to capture). The combat
HUD from #184 does not show or drive it. Offence is the focus; defence stays automatic (crew fight boarders, the player
drafts) and only gains visibility: an alert when boarders dock and intruder marks on the inset.

- **Launch from the HUD.** A BOARD action (B) opens a party picker: the shuttle and its seats, crew with weapon and
  health (default: armed crew not on a console), and the target airlock, clicked on the enemy in the main view or the
  nearest one. Crew sent leave their stations, and the STATIONS tags show it.
- **The flight is the risk.** Enemy point defence shoots the shuttle. Shields have **no effect** on docking: they stop
  projectiles, not a shuttle; boarding is a way around a heavily shielded ship.
- **Aboard.** The enemy is already the main view, so the party is commanded there with the existing crew orders. The
  enemy card gains a party section (members, health, status).
- **Objectives.** Capture: subdue the crew, then hold the bridge (a visible "holding bridge" bar); the result is a prize
  with prisoners. **Sabotage:** order boarders to wreck a module (weapons, shields, reactor) from inside, then recall;
  a reason to board a ship you don't want. Recall: back to the shuttle and home.
- **Friendly fire is on.** Your weapons hit tiles, so they can hurt your own boarders. The enemy card warns "Your crew
  aboard" and the rooms they are in are marked.
- **Stranded parties are lost.** If the enemy is destroyed with the party aboard, they die; if it jumps away, they go
  with it (a possible story hook later). The warnings make it fair; bad play loses.
- **Fix:** a near-capture must not turn into a wreck when boarders step off before the bridge hold completes.
- **Later:** a teleporter module, rarer, using the same picker with no flight and a cooldown.

### Lessons: the tutorial system (user decisions, 2026-10-29)

The goal chain (`src/sim/story/goals.ts`) says **what** to do next; lessons teach **how** a feature works. They are a
UI-layer system: they read the sim and its events, never change it, and are not part of the game save.

- **Just-in-time, not scripted.** A lesson fires the first time the player meets a feature: the first fight, the first
  build, the first trade. There is no scripted opening sequence; the goal chain gives direction, and a goal row can link
  to a lesson ("Show me how").
- **Coach marks.** Each step is a short callout pointing at the real thing: a UI element or an object in the world (a
  module, a station). A lesson is a few steps, a few lines each.
- **Step text** (user decisions, 2026-10-30 and 2026-10-31). One line of the instructor's dialogue, then plain lines
  that say what to do and what each thing is for, with keys from the key map. The text is as concise as it can be while
  still giving the player everything they need: don't cut useful information to save words, and don't pad.
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
- **Instructors** (user decisions, 2026-10-30). Lessons are spoken in character by a fixed instructor per category, not
  by the player's crew. The card shows the instructor's portrait on its left edge (the frame's left border breaks around
  it) with "NAME · ROLE" in the top label and the lesson name and step count on the right. Each instructor gets custom
  portrait art from the Blender pipeline; until it exists the portrait is drawn from a stand-in look.

  | Category | Instructor | Voice | Look |
  |---|---|---|---|
  | Combat, navigation (weapons, heat, flee, starmap, jumps, fuel) | **Vash**, Pilot | Cocky, restless, loves a fast exit | Buzz cut, headset, aviator jacket |
  | Engineering (power, building, repairs) | **Okafor**, Chief Engineer | Patient, proud of the ship, talks to machines | Grey beard, goggles pushed up, orange coveralls |
  | Crew care (needs, beds, food, medical) | **Dr. Lin Hale**, Medic | Warm but blunt about neglect | Tied-back hair, white coat over a ship suit |
  | Trade and stations (deals, hiring, markets) | **Marguerite Sol**, Quartermaster | Shrewd, counts everything twice | Sharp bob, glasses on a chain, high collar |
  | Boarding and EVA (suits, shuttles, sabotage) | **Kade**, Boarding Lead | Loud, fearless, a little reckless | Shaved head, heavy suit with a cracked visor at the neck |
  | Factions and the black market | **"Ghost"**, Fixer | Quiet, wry, never answers a direct question | Hooded, half-shadowed face, one cybernetic eye |

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
