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

FTL's decision-making, with physical consequences.

- **No movement, no range, no firing arcs.** Engines + pilot give **evasion** and charge the FTL drive
  for escape.
- Weapons **charge** and fire **volleys**; **shields** are layers that regenerate; **power** is limited.
  The core puzzle is timing and targeting.
- You target a **module/room**; shots land on real tiles near the aim point (spread by accuracy).
- Hits apply **effects to tiles**: pierce hull (breach), ignite, ion, EMP, spawn boarders… The field
  systems take it from there.
- Weapons are **heavy and rare** overall; Gatling turrets and point defence are deliberate fast
  exceptions. Point defence counters missiles and drones.
- **Endings:** destroy (the wreck persists as a lootable derelict; how you fought decides what
  survives), disable and board to **capture**, negotiate (bribe, surrender), or flee.
- **Boarding** uses the same crew sim. Defence: crew, doors, turrets, venting rooms on purpose.
- **Enemy AI** from the first combat milestone: target priorities, power management, crew response,
  retreat. Factions have doctrines (pirates board, military snipes weapons).
- **Feel:** readability first (visible projectiles, enemy charge bars, telegraphed volleys, combat log,
  optional auto-pause on key events), then punch (hit-stop, light shake, sparks, decals, visible
  smoke). Fights last roughly 1–3 minutes.
- Fleet combat is **not** a core feature.

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
