# Catalog: debug scenarios and dev tools

Everything that exists for development and playtesting: URL debug starts, `debug.*` commands, the debug panel, render lab, layout lab, ship generator viewer, profilers, the Blender sprite pipeline.
Nothing here is part of the shipped game loop; "Debug only" is the status for all of it. Other URL parameters: `?seed=`, `?starter=<ship>` (skips the title), `?perf` (F3 profiler panel).

## URL scenarios (`?scenario=<name>`, `src/content/scenario/`)

Presets are files in `presets/`; `?scenario=<name>` takes the preset's own flags plus `&seed= &starter= &credits= &items=id:n,id:n &speed= &ticks= &hooks=a,b`. A start builds before the first frame and opens on the finished scene (`?scenario=ambush&signal` stops at the signal). Also here, not listed below: `stasis`, `vents`, `bar`, `lostcargo` and `start` (a plain new game: `&template= &populate &rolled`). `npm run profile:sim -- --scenario preset:<name>` runs any of them in the profiler. See ARCHITECTURE "Scenario builder".

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| log | `?scenario=log` | `?scenario=log`: a raider arrives, fire breaks out, speed 3 | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| ambush | `?scenario=ambush` | Pirate ambush from its signal or dropped on top; `&trap|&honest|&signal|&tell=|&event=` | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| freighter | `?scenario=freighter` | Distress freighter scene; `&signal&help&raiders=none|here|coming` | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| handover | `?scenario=handover` | Delivery job set-up | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| bounty | `?scenario=bounty` | Bounty job set-up | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| survey | `?scenario=survey` | Survey job set-up | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| tracker | `?scenario=tracker` | Jobs tracker full of cards | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| fight | `?scenario=fight` | A raider beside the ship, game running; `far` | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| boarding | `?scenario=boarding` | Boarding fight set-up | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| inspector | `?scenario=inspector` | Crew inspector with traits, XP, gear, mixed mood | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| breaks | `?scenario=breaks` | Four crew mental-break at once | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| bonds | `?scenario=bonds` | Friends and a rival around one crew member | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| drones | `?scenario=drones` | Drone bays, three drones, a fire, hurt crew; `&fight` | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| upgrades | `?scenario=upgrades` | Weapon upgrades and flak; `&enemy=navy&depth=` | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| damage | `?scenario=damage` | Fire, breach, damaged reactor | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| hullplan | `?scenario=hullplan` | Hull plan brushes next to a trading hub with credits | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| injuries | `?scenario=injuries` | Injured crew: fracture to treat, lost eye, scar, bleeding wounds for first aid (#601) | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| medpod | `?scenario=medpod` | Medical pod and passenger; `&passage` | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| inspect | `?scenario=inspect` | Station inspectors board and search; `&clean` | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| patrol | `?scenario=patrol` | Navy patrol hails you to stop | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| pirates | `?scenario=pirates` | Pirate fleet waits at the next node; `&hunt` | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| farm | `?scenario=farm` | Three hydroponics beds near a galley (#59) | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| prisoners | `?scenario=prisoners` | A raider beside the ship whose crew has surrendered, so the take-prisoners alert waits; `&taken` takes them, `&seal` adds a wheel and marks them for sealing (#116) | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| busy | `?scenario=busy` | Civilian ship, derelict and station: the profiling scene | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| business | `?scenario=business` | A trading outpost and an asteroid field in the player's node; a trader and a miner turn up and go about their business (`&patrol`: a navy patrol inspects them; `&stage=busy` for tests) (#603) | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| skirmish | `?scenario=skirmish` | Two fleets at war (`&a=`, `&b=` factions; default pirates and traders) fight in the player's node (#603) | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| stasis | `?scenario=stasis` | A stasis wheel, two hostile prisoners and two spare empty slabs (#116); `&unpowered` switches the wheel off once both are in; `&deals` adds a third prisoner and a station that bids (#116) | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| bar | `?scenario=bar` | A bar counter, corner and stools built as an L on the debug hull (#441) | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| lostcargo | `?scenario=lostcargo` | The node's lost cargo spawned beside the ship; `&cargoSeed= &tier= &cut` (#503) | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| vents | `?scenario=vents` | A door with its vent open and thin air on one side (#591) | Debug only | src/content/scenario/presets/ (the preset file of that name) |
| start | `?scenario=start` | A plain new game on the hull you name; `&template= &populate &rolled` | Debug only | src/content/scenario/presets/ (the preset file of that name) |

## Debug commands (`debug.*` in `src/sim/commands.ts`)

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Spawn things | ``debug.spawnCrew, spawnEnemy, spawnGenerated, spawnDerelict, spawnStation, spawnOutpost, spawnAsteroid, spawnModule, spawnItems, giveItems, spawnMarker`` | Place ships, stations, crew, modules, items | Debug only | src/sim/commands.ts; handlers in sim/*/handlers.ts; ui/DebugPanel.svelte |
| Set state | ``debug.setCredits, setCrew, setCharge, setField, setModuleHp, setPlot, setStruct, setUpgrade, notoriety, chargeFtl, ignite`` | Edit values and fields | Debug only | src/sim/commands.ts; handlers in sim/*/handlers.ts; ui/DebugPanel.svelte |
| Scenario helpers | ``debug.ambush, pirates, patrol, capture, imprison, surrender, bond, breakCrew, jobScenario, sceneArrivals`` | Stage encounters and crew states | Debug only | src/sim/commands.ts; handlers in sim/*/handlers.ts; ui/DebugPanel.svelte |
| Galaxy | ``debug.galaxyReveal, galaxyTeleport`` | Reveal the map and teleport | Debug only | src/sim/commands.ts; handlers in sim/*/handlers.ts; ui/DebugPanel.svelte |

## Tools

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Render lab | ``npm run lab -- --panel <id>`` | Screenshot any visual as a grid of stills; 25 panels: sprites, shield, drones, droneLaunch, marks, shots, upgrades, pods, hydroponics, ore, recovery, leisure, bench, bar, bunk, stasis, stasisface, slabuv, stasisload, floor-finishes, deck-marks, cable, tube, bayHandoff, station-hull | Debug only | tools/lab/*; docs/RENDER_LAB.md; dev page /tools/lab/ |
| Comms and kit labs | ``tools/lab/CommsLab.svelte, KitLab.svelte`` | UI kit and comms window samples | Debug only | tools/lab/commsLab.ts, kitLab.ts |
| Layout lab | ``/tools/layout/`` | Ship layout editor: grid, layers, palette (incl. Window tool, X: 2/3/4 tile windows on walls, saved in cases, shown in the preview; Room tool: a click inside a walled-in space fills it as a room, any shape; lights: floor light, cage lamp and light mast placed like any module, each with its own mark on the grid (Lights layer, key); Move tool, S: box-select an area and drag it (Alt: a duplicate), R/Shift+R turn, H/Shift+H mirror, arrows nudge, Delete clears, Ctrl+C/X/V copy, cut and paste, clipboard kept across reloads; Shapes panel: save the box as a named shape (Ctrl+Shift+C), click one to place it, kept in the browser; keyboard: [ ] step the tool option, arrows nudge the selected module or pan, +/- zoom, list in tools/layout/keys.ts), notes, preview (Pop out in its move menu), source picker (asteroid outposts as the game builds them, `?outpost=<kind>&seed=N`, their levelled ground shaded on the grid (Asteroid ground layer); opens a case from a file, `?case=<slug>` for the saved ones; station layouts include the station assembly's recipes, `assembly.<family>`) | Debug only | tools/layout/* |
| Ship generator viewer | ``/tools/shipgen/, npm run shipgen`` | Generate and draw faction ships and stations, benchmark metrics | Debug only | tools/shipgen/*; docs/SHIPGEN.md |
| Asteroid sheets | ``tools/asteroids/`` | Asteroid generation CLI and sheet drawing | Debug only | tools/asteroids/* |
| Profiler | ``npm run profile, profile:sim, profile:baseline, ai:diff`` | Per-system sim cost, headless-game profile, crew decision diffs | Debug only | tools/profile/*; docs/PROFILING.md; in-game ?perf |
| Sprite pipeline | ``npm run sprites, assets`` | Headless Blender renders sprite sheets into public/assets/1x | Debug only | tools/blender/* (about 400 sprite scripts) |
| Test harness and checks | `npm run check:fast`, `npm run check:push`, `npm run test:soak`, `npm run test:weights:ci` | Shared fixtures, near and branch checks, soak tests, and shard weights | Debug only | `test/support/` and [Test tiers](../ARCHITECTURE.md#test-tiers) |

Planned tooling: end-to-end browser regression tests (#157), Vite dependency scan limit (#53), room-layout solver (#193).
