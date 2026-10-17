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
  open.
- **Danger awareness:** crew read tile fields (fire, vacuum, heat) and avoid or flee unless their job,
  species or gear allows.
- **Species** are base bodies (organic, synthetic, hybrid) with real sim effects (no breathing, fire
  resistance, fast repair…). **Implants** add on top, with trade-offs: power draw, maintenance,
  stability, vulnerability to EMP/ion and hacking.
- Relationships (friends, rivals, grief) later.

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
  - The **AI core** runs **point defence** automatically. Its tier sets how much else it can
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
- **Fog of war (later):** an enemy ship's interior is hidden unless sensors reveal it. Shield
  generators, hull-mounted weapons and engines always show on top of the fog, so they can still be
  seen and targeted.
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
- **Gritty industrial with a cyberpunk edge:** muted metals and grime, hazard stripes, and neon
  accents.
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
