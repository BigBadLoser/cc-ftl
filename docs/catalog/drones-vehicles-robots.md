# Catalog: drones, vehicles and robots

Autonomous helpers and craft. **Drones** are small fliers docked in drone bays, built from fabricator items and unlocked by research. **Vehicles** are shuttles and pods
that fly between ships and rocks. **Robots** are crew-like machines (species.robot) made in robot fabricators and recharged in bays.

## Drones
| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Repair drone | `drone.repair` | Seals breaches, repairs modules, puts out small fires; carries 4 metal | In game | src/content/drones.ts:18; sim/drones/work.ts; item.drone_repair; research.drone.repair; render/droneView.ts |
| Medic drone | `drone.medic` | Patches the downed, slowly heals the wounded | In game | src/content/drones.ts:27; item.drone_medic |
| Defence drone | `drone.defence` | Intercepts hostile drones and shuttles | In game | src/content/drones.ts:35; sim/drones/intercept.ts; item.drone_defence |
| Drone bay | `module.droneBay` | Docks and recharges two drones | Partial: buildable, no starter has one | see modules.md; sim/drones/bay.ts; ui/DroneBayPanel.svelte; scenario `?scenario=drones` |
| Shadow sprite | `drone.shadow` | Drone ground-shadow art used by droneArt.ts | In game | render/droneArt.ts |
| Logistics drone / construction drones | `-` | Hauling and construction drones | Planned | DESIGN.md phase 6; issue #322 (logistics robot) |

## Vehicles

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Shuttle | `vehicle.shuttle` | Pilot + 4 passengers, 40 cargo; boarding, trade runs, EVA hover, away sites, ferry | In game | src/content/vehicles.ts:6; sim/vehicles/*, systems/vehicles.ts; module.vehicle_bay; item.shuttle |
| Mining pod | `vehicle.mining_pod` | One pilot; lasers ore into a 32-unit hold and flies home | In game | src/content/vehicles.ts:11; sim/systems/mining.ts, sim/mining/*; module.pod_bay (Prospector only; buildable) |
| Escape pod | `vehicle.escape_pod` | Slow pod that carries one person: distress and medical scenes | In game | src/content/vehicles.ts:15; sim/vehicles/escape.ts, sim/scene/pods.ts; not player-buildable; the content comment saying it reuses mining-pod art is stale (own sprites exist) |
| Construction pod | `-` | Pod that expands the hull anywhere (the pod bay description mentions it) | Planned | vehicles.ts header "construction pods come later"; DESIGN.md phase 6 |
| Shuttle logistics: ferry, away sites, trade queue | `-` | Shuttles carry cargo and crew to bases and away sites | In game | sim/ferry/*, sim/away/*, sim/logistics/*, sim/trade/queue.ts; ui/ShuttlePanel.svelte |
| EVA and suits | `-` | Suited crew float between shuttles and hulls; suit air | In game | sim/eva/*, systems/suits.ts, evaFloat.ts; content/suit.ts |

## Robots

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Robot crew | `species.robot, role.robot_*` | Three roles (worker, security, repair); recharge in robot bays, repair with parts and metal | In game | see crew.md; sim/robots/*, systems/robots.ts |
| Robot fabricator | `module.robotFabricator` | Builds robots while its AI core is live | In game | sim/systems/fabricators.ts; buildable; the player-owned version has no starter |
| Robot bay | `module.robotBay` | Charging cradle | In game | sim/systems/robotBays.ts; ui/RobotBayPanel.svelte |
| AI core and robot control | `module.aiCore` | Robots go inert when their core is destroyed, unpowered or hacked; holding it captures | In game | sim/robots/core.ts, halt.ts |
| Logistics robot | `-` | Player-buildable hauling robot | Planned | issue #322 |
| Rogue robots on derelicts | `-` | Emergency-core robots at ruin machine points | Planned | issue #310 |
