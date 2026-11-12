---
title: Drones
order: 5
---

<script lang="ts">
  import Stat from '../../../lib/Stat.svelte'
  import ModuleTable from '../../../lib/ModuleTable.svelte'
  import ComingLater from '../../../lib/ComingLater.svelte'
</script>

Drones are small flying machines that work for the ship on their own. You give them no orders: they pick their own
jobs, fly there, work, and go home to recharge. You supply the drones, a bay to keep them in, and an AI core to run them.

## The three drones

| Drone | What it does |
|---|---|
| Repair drone | Fixes damaged modules, puts out small fires, and seals hull breaches from outside. |
| Medic drone | Flies to downed crew and stops their bleeding, then slowly heals the wounded. |
| Defence drone | Guards the ship in a fight by shooting down incoming missiles, enemy drones and shuttles. |

Drones are slower than crew. A repair drone works at half an engineer's speed, and it leaves big fires to the crew. A
medic drone only patches the downed: it doesn't get them up. Rescue to a bed and a medic still do that.

## Getting drones

1. **Research** the drone you want: Repair drone, Medic drone or Defence drone, in the automation branch. Each needs an AI
   core. See [Research](../../reference/research/).
2. **Build** it at a fabricator from parts and electronics (the recipe appears once researched).
3. **Store it.** The drone is an item. A free pad in a drone bay takes one from ship storage by itself.

Research stations sometimes sell finished drones. A destroyed drone leaves a little scrap.

## The drone bay

<ModuleTable ids="module.droneBay, module.aiCore" columns="power:Power:signed, maxHp:Hull points" />

A drone bay has two pads. Select it to open the bay panel:

- Each drone's name and what it is doing, with a charge meter.
- A **Load** line for drones that carry supplies.
- **Empty pad** for a pad waiting for a drone.
- **Out at once**, how many of your drones are flying against the limit your AI core allows.

A powered bay recharges the drones docked in it and slowly repairs their hull. An unpowered bay does neither.

### Charge

A drone's battery drains in flight, faster while it works. It heads home when the charge drops under <Stat kind="tuning" id="drones.drone.repair.charge.lowBelow" /> and goes out
again once it is back above <Stat kind="tuning" id="drones.drone.repair.charge.launchAbove" />. Flying time on a full battery is a few minutes.

### The repair drone's metal

A repair drone pays for hull seals from a small load of metal (<Stat kind="tuning" id="drones.drone.repair.supply.capacity" /> units, enough for two walls). While docked in a powered
bay it refills the load from ship storage. If storage has no metal, it still repairs modules (free) but won't take
breach jobs. The bay panel shows the load in red when it is empty.

## The AI core

Drones only work while the ship has a powered **AI core**. The core sets how many drones may be out of their bays at
once: <Stat kind="tuning" id="DRONE_CAP_BY_TIER" index={1} /> with the standard core. Other drones stay docked and charge.

If the core is destroyed, switched off or out of power, every drone goes inert: flying drones drop where they are (in
space they drift) and docked ones sit dark. They wake again when the core is back. Protect the core.

See [Power](../power/) for keeping the core and bay running through shortages.

## How drones move

Inside the ship, drones fly over modules, furniture and crew, so they reach places walkers can't. They are still
inside the hull, though: walls bar them, and a **door** is the only way through. A drone holds a door open as it passes,
and waits at a closed **airlock** door until it cycles, just as crew do.

To reach space a drone goes through its bay's ceiling hatch, which opens above the pads. The bay doesn't have to touch the
hull.

## Defence drones in combat

When a ship at war with you is in play, defence drones launch through the hatch and circle your ship a few tiles off the
hull. They shoot only what is already hostile, so a defence drone never starts a fight.

- **Missiles, enemy drones and shuttles** in range are valid targets. Drones hit about half of their shots.
- Missiles and enemy drones are the main targets. A shuttle takes only chip damage, like point defence.
- Ordinary ship guns can't hit a drone in space. Only point defence and defence drones can, so in practice drones mostly
  fight drones.

## Before a jump

Charging a jump recalls every drone. None launches, and those outside fly home and land one after another. The jump
waits for them up to <Stat kind="tuning" id="DRONE_RECALL_WAIT_SEC" unit="seconds" />, a little longer the more there are. **Any drone still outside when the ship goes is lost.**
Leaving a scene or fleeing works the same way. Drones inside the ship are aboard and lift with it.

Drones that die are lost for good. Fire inside the ship burns drones, and crew hand weapons can hit enemy drones that
get aboard.

## Ion

Ion weapons knock drones out for a while. An ion hit near a flying drone, or on its bay, stops it: a flying drone drops,
and a docked one stays dark until it wears off.

## Enemy drones

Navy ships from sector depth <Stat kind="tuning" id="ENEMY_DRONE_MIN_DEPTH" /> on carry a drone bay with defence drones, <Stat kind="tuning" id="ENEMY_DRONES_BASE" /> to start and one more from sector depth <Stat kind="tuning" id="ENEMY_DRONE_SECOND_DEPTH" />. They
shoot down your missiles and shuttles, so a missile-heavy plan hits trouble against them. Your point defence can hit their
drones in return.

<ComingLater>

Rogue AI ships carry the same defence drones, but the galaxy doesn't field any rogue AI ships yet, so you won't meet
them in a normal game.

</ComingLater>

## Wrecks take their drones with them

A drone is lost with its ship. If your ship becomes a wreck, its drones go with it. The same is true of enemies: a wreck
you salvage to the end no longer leaves its drones behind, docked or out in space.

<ComingLater>

Hauling and construction drones, and combat drones that fly out to attack. For now drones only repair, heal and defend.

</ComingLater>
