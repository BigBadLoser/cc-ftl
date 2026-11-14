# Catalog: debug scenarios and dev tools

Everything that exists for development and playtesting: URL debug starts, `debug.*` commands, the debug panel, render lab, layout lab, ship generator viewer, profilers, the Blender sprite pipeline.
Nothing here is part of the shipped game loop; "Debug only" is the status for all of it. Other URL parameters: `?seed=`, `?starter=<ship>` (skips the title), `?perf` (F3 profiler panel).

## URL scenarios (`?scenario=<name>`, `src/app/scenarios/`)
| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| log | `?scenario=log` | `?scenario=log`: a raider arrives, fire breaks out, speed 3 | Debug only | src/app/scenarios/ambush.ts; registry in src/app/scenarios/index.ts |
| ambush | `?scenario=ambush` | Pirate ambush from its signal or dropped on top; `&trap|&honest|&signal|&tell=|&event=` | Debug only | src/app/scenarios/ambush.ts; registry in src/app/scenarios/index.ts |
| freighter | `?scenario=freighter` | Distress freighter scene; `&signal&help&raiders=none|here|coming` | Debug only | src/app/scenarios/ambush.ts; registry in src/app/scenarios/index.ts |
| handover | `?scenario=handover` | Delivery job set-up | Debug only | src/app/scenarios/jobs.ts; registry in src/app/scenarios/index.ts |
| bounty | `?scenario=bounty` | Bounty job set-up | Debug only | src/app/scenarios/jobs.ts; registry in src/app/scenarios/index.ts |
| survey | `?scenario=survey` | Survey job set-up | Debug only | src/app/scenarios/jobs.ts; registry in src/app/scenarios/index.ts |
| tracker | `?scenario=tracker` | Jobs tracker full of cards | Debug only | src/app/scenarios/jobs.ts; registry in src/app/scenarios/index.ts |
| fight | `?scenario=fight` | A raider beside the ship, game running; `far` | Debug only | src/app/scenarios/fight.ts; registry in src/app/scenarios/index.ts |
| boarding | `?scenario=boarding` | Boarding fight set-up | Debug only | src/app/scenarios/fight.ts; registry in src/app/scenarios/index.ts |
| inspector | `?scenario=inspector` | Crew inspector with traits, XP, gear, mixed mood | Debug only | src/app/scenarios/crew.ts; registry in src/app/scenarios/index.ts |
| breaks | `?scenario=breaks` | Four crew mental-break at once | Debug only | src/app/scenarios/crew.ts; registry in src/app/scenarios/index.ts |
| bonds | `?scenario=bonds` | Friends and a rival around one crew member | Debug only | src/app/scenarios/crew.ts; registry in src/app/scenarios/index.ts |
| drones | `?scenario=drones` | Drone bays, three drones, a fire, hurt crew; `&fight` | Debug only | src/app/scenarios/drones.ts; registry in src/app/scenarios/index.ts |
| upgrades | `?scenario=upgrades` | Weapon upgrades and flak; `&enemy=navy&depth=` | Debug only | src/app/scenarios/upgrades.ts; registry in src/app/scenarios/index.ts |
| damage | `?scenario=damage` | Fire, breach, damaged reactor | Debug only | src/app/scenarios/damage.ts; registry in src/app/scenarios/index.ts |
| hullplan | `?scenario=hullplan` | Hull plan brushes next to a trading hub with credits | Debug only | src/app/scenarios/hullplan.ts; registry in src/app/scenarios/index.ts |
| medpod | `?scenario=medpod` | Medical pod and passenger; `&passage` | Debug only | src/app/scenarios/medpod.ts; registry in src/app/scenarios/index.ts |
| inspect | `?scenario=inspect` | Station inspectors board and search; `&clean` | Debug only | src/app/scenarios/inspect.ts; registry in src/app/scenarios/index.ts |
| patrol | `?scenario=patrol` | Navy patrol hails you to stop | Debug only | src/app/scenarios/patrol.ts; registry in src/app/scenarios/index.ts |
| pirates | `?scenario=pirates` | Pirate fleet waits at the next node; `&hunt` | Debug only | src/app/scenarios/pirates.ts; registry in src/app/scenarios/index.ts |
| farm | `?scenario=farm` | Three hydroponics beds near a galley (#59) | Debug only | src/app/scenarios/farm.ts; registry in src/app/scenarios/index.ts |
| prisoners | `?scenario=prisoners` | A stasis wheel, two hostile prisoners and two spare empty slabs (#116); `&unpowered` switches the wheel off once both are in | Debug only | src/app/scenarios/prisoners.ts; registry in src/app/scenarios/index.ts |
| busy | `?scenario=busy` | Civilian ship, derelict and station: the profiling scene | Debug only | src/app/scenarios/busy.ts; registry in src/app/scenarios/index.ts |

## Debug commands (`debug.*` in `src/sim/commands.ts`)

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Spawn things | ``debug.spawnCrew, spawnEnemy, spawnGenerated, spawnDerelict, spawnStation, spawnOutpost, spawnAsteroid, spawnModule, spawnItems, giveItems, spawnMarker`` | Place ships, stations, crew, modules, items | Debug only | src/sim/commands.ts; handlers in sim/*/handlers.ts; ui/DebugPanel.svelte |
| Set state | ``debug.setCredits, setCrew, setCharge, setField, setModuleHp, setPlot, setStruct, setUpgrade, notoriety, chargeFtl, ignite`` | Edit values and fields | Debug only | src/sim/commands.ts; handlers in sim/*/handlers.ts; ui/DebugPanel.svelte |
| Scenario helpers | ``debug.ambush, pirates, patrol, capture, imprison, bond, breakCrew, jobScenario, sceneArrivals`` | Stage encounters and crew states | Debug only | src/sim/commands.ts; handlers in sim/*/handlers.ts; ui/DebugPanel.svelte |
| Galaxy | ``debug.galaxyReveal, galaxyTeleport`` | Reveal the map and teleport | Debug only | src/sim/commands.ts; handlers in sim/*/handlers.ts; ui/DebugPanel.svelte |

## Tools

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Render lab | ``npm run lab -- --panel <id>`` | Screenshot any visual as a grid of stills; 10 panels: shield, sprites, drones, droneLaunch, marks, shots, upgrades, pods, hydroponics, ore | Debug only | tools/lab/*; docs/RENDER_LAB.md; dev page /tools/lab/ |
| Comms and kit labs | ``tools/lab/CommsLab.svelte, KitLab.svelte`` | UI kit and comms window samples | Debug only | tools/lab/commsLab.ts, kitLab.ts |
| Layout lab | ``/tools/layout/`` | Ship layout editor: grid, layers, palette, notes, source picker | Debug only | tools/layout/* |
| Ship generator viewer | ``/tools/shipgen/, npm run shipgen`` | Generate and draw faction ships and stations, benchmark metrics | Debug only | tools/shipgen/*; docs/SHIPGEN.md |
| Asteroid sheets | ``tools/asteroids/`` | Asteroid generation CLI and sheet drawing | Debug only | tools/asteroids/* |
| Profiler | ``npm run profile, profile:sim, profile:baseline, ai:diff`` | Per-system sim cost, headless-game profile, crew decision diffs | Debug only | tools/profile/*; docs/PROFILING.md; in-game ?perf |
| Sprite pipeline | ``npm run sprites, assets`` | Headless Blender renders sprite sheets into public/assets/1x | Debug only | tools/blender/* (243 sprite scripts) |
| Damage mock | ``tools/damage_mock`` | Python mocks for breach and roof damage art | Debug only | tools/damage_mock/* |
| Spikes | ``spikes/crew-lab, spikes/pixel-lab`` | Old art experiments with their own vite config (`lab:build`, `pixel-lab:build`) | Debug only | spikes/* |
| Test tiers and weights | ``npm run check, test:soak, test:weights:ci`` | Three test tiers, shard weights | Debug only | tools/testWeights.ts, tools/soakWeights.ts |

Planned tooling: test overhaul with a shared harness and scenario builder (#371), end-to-end browser regression tests (#157), Vite dependency scan limit (#53), room-layout solver (#193).
