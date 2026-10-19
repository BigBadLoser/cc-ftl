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
- **Robot fabricators** stay the rogue AI's own spawner: no materials, just a live core and power, up to a cap.
  Rogue ships and shipyards also have robot bays, where their robots recharge.
- **Derelicts come in two kinds:**
  - Scrapper and other wrecks are abandoned and infested with hostile aliens.
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

- **Sectors:** a sector is a playable space holding ships, stations, asteroids and derelicts, each its
  own grid at a world position. On entering a sector, a **deploy modal** (a simplified sector map)
  lets you choose where your ship sits relative to the other objects.
- **No movement, no maneuvering, no firing arcs.** Distance only affects **projectile travel time**,
  so a far deployment gives more time to react (shields, point defence). There is no accuracy penalty.
- **Combat overlay:** the camera stays on your ship, and an overlay panel shows the enemy ship live,
  where you pick targets. On phones it is an expandable sheet.
- **Consoles, not manned weapons:**
  - The **weapons console** operator runs all weapons; their skill affects charge and accuracy. With
    no operator, weapons don't fire.
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
  identified and targeted.
- **Hits** land on tiles near the aim point (spread by accuracy). Walls lose integrity and breach,
  modules lose HP, and crew get hurt. M3's systems take it from there: venting, fire, power loss,
  darkness.
- **Enemies run the same sim:** their own crew, power, fires and repairs, plus an AI doctrine for
  targeting, power and retreat.
- **Endings:**
  - **Destroy:** the wreck persists as a lootable derelict grid.
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
- Event pools are weighted by danger tier and faction territory.
- **Presentation:** decisions pause in a modal; flavour and optional leads arrive in-world and can be
  ignored.

## Economy

- General model from day one: items with tags and stack sizes, storage, recipes (inputs, outputs,
  station, time), hauling via the job system.
- **Start light:** scrap plus 3–4 resources and a few recipes. Full chains (mining → refining →
  crafting, food) are added later as data.

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

- Full-screen game view with Svelte panels over it: a top bar (resources, time), a bottom context panel
  (selection), side drawers (build, crew, priorities, starmap). Drawers become sheets on phones.
- Field **overlays** (O2, heat, power, light, damage) and a **tile inspector**.
- **Alert queue** with click-to-jump and per-type auto-pause.
- Keyboard: space pauses, 1–3 set speed, plus drawer hotkeys. Touch has buttons for everything.
- The starmap is its own view.
- Expect heavy refinement once it's playable.

## Open questions

- Mood and breakdown severity.
- Lore specifics: factions, species list, story arcs.
- Recoverable failure mode.
