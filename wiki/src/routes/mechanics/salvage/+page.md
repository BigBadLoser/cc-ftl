---
title: Salvage and derelicts
order: 9
---

<script lang="ts">
  import Stat from '../../../lib/Stat.svelte'
  import ModuleTable from '../../../lib/ModuleTable.svelte'
</script>

Wrecks, asteroids and abandoned hulls are free materials if you can reach them. This page covers finding a derelict,
stripping it, exploring it by hand, turning scrap into materials, and mining ore.

## Finding a derelict

A derelict turns up in two ways:

- as a **signal on the lane**: scan it from the signal window, then **Drop out** to reach it (see
  [Travel and encounters](../encounters/)), or
- as a **wreck in a node** that you've jumped to, such as the remains of a fight.

Select the wreck from the strip of ships and asteroids in the node view. Its panel shows:

| Row | What it tells you |
|---|---|
| Make and cause | What kind of ship it was, and whether it was a combat wreck or an old one. |
| Hull | How much of the hull is left. |
| Air | Whether its decks are breathable. Most are breached. |
| Power | Whether anything still has power. |
| Jammed doors | How many doors are stuck shut. |
| Crew aboard | Anything alive aboard, including things that aren't friendly. |

The scan from the lane also reports signs of life: faint life signs mean egg sacs, machine signatures mean robots. A
deeper **probe** (a hacker of skill 4) gives counts.

> **Warning:** a derelict can be infested. You can't salvage a wreck while anything hostile is aboard: a living hostile
> crew member, an egg sac or a nest. Clear the wreck first (see [Boarding](../boarding/)).

## Salvage orders

A salvage order is the simple way to strip a wreck. The crew run it on their own, like any other work.

1. Select the derelict.
2. In the **Salvage** section, tick the scrap types you want. Hover a row to see an estimate of what it will yield.
3. Press **Salvage**.

While the order runs, the panel shows progress as parts stripped out of the total. **Cancel salvage** stops it.

### Scrap types

Every part of a wreck gives one kind of scrap. Only parts that give a ticked type are stripped.

| Scrap | Comes from |
|---|---|
| **Hull** | Hull plating, walls, beams, floors. |
| **Tech** | Consoles, computers, sensors, shield and medical modules, and doors. |
| **Energy** | Reactors, batteries, engines, power conduits. |
| **Weapons** | Turrets, launchers, magazines, armouries. |
| **Comfort** | Furniture, beds, kitchens, lounge and storage fittings. |

Stripping gives back less than building cost. A part gives scrap worth <Stat kind="tuning" id="SALVAGE_FRAC" /> times the
items in its build cost, so salvage never beats mining and trade for bulk materials. Big wrecks are still worth it: the
scrapper sometimes makes rare extras.

Doors count as Tech scrap, so unticking Hull still takes them. A row greys out when there's nothing of that type left.

### How the crew do it

The crew deconstruct the wreck's parts, using their Construction skill. Haulers carry the scrap to a staging area beside
the shuttle's landing zone. A shuttle then loads it crate by crate and brings it home.

If the order stalls, the panel says **Blocked** and why:

- hostiles are still aboard,
- there is no shuttle, or
- there is no crew free to go.

The wreck is removed when nothing of the ticked types is left and the loot has been carried off.

## The shuttle and suited parties

Most wrecks are open to space, so salvage is a spacesuit job. A **shuttle** in a **shuttle bay** ferries the party out and
brings loot and tired crew home. You need one; without it the order is blocked. The Shuttle panel has the launch, dock and
recall buttons.

- A shuttle takes a full party of four, all suited.
- Away parties follow the crew schedule: they work a wreck until their Sleep hours, then take the shuttle home, and go
  back during Free time when the shuttle is there. See [Crew](../crew/).
- Robots ride shuttles and work on a wreck without a suit.
- Crew with the Space-sick trait lose mood on a spacewalk.

### Spacesuits

Every airlock and every shuttle has a suit for each crew member who needs one. Crew put one on at the inside tile of the
airlock. They don't need to be drafted for a salvage order.

A tank lasts about <Stat kind="tuning" id="DEFAULT_SUIT.airSec" scale={1/60} /> minutes. Crew refill at the hovering shuttle or at an intact airlock before it runs low, then go back to
work. The game raises urgent alerts if a suit runs **low** or **out**, or if a crew member has **no air in reach**. A **Crew
stranded** alert means an away party cannot get home.

## Exploring by hand

There is no explore order. If you want to clear aliens, look around, or force a stuck door, take a team over yourself:

1. Draft the crew you want (**R**).
2. Open the **Shuttle** panel. Choose a pilot, then **Send aboard** the others. Press **Launch**.
3. Under **Hover beside (EVA)**, pick the wreck. The shuttle holds station a few tiles off its hull.
4. Press **Crew out (EVA)**. The party suits up and floats to the wreck.
5. Give orders on the wreck as you would on your own ship. Right-click a jammed door and pick **Force door**. The nearest
   drafted crew member who isn't fighting does it and stays drafted.
6. To come back, use **Back to shuttle** on a crew member's card, then **Return to bay**.

Leaving the node is blocked while crew are away, and the jump warning lists anyone left behind.

## Scrap items, the scrapper and scrap bins

Salvage drops **scrap items**: hull, tech, energy, weapons and comfort scrap, plus **cloth** from comfort scrap. They go
into **scrap bins**, barred cages that take only scrap and feed the scrapper. They need no power. A large bin holds more.

The **scrapper** turns scrap into materials. It is crew work, from the front tile, and you can build it from the start. A
batch takes ten scrap of one type:

<ModuleTable ids="module.scrapper" columns="power:Power:signed, maxHp:Hull points" />

| Scrap | The scrapper makes | Rare extra |
|---|---|---|
| Hull | Metal | none |
| Tech | Electronics, spare parts | drone tech |
| Energy | Spare parts, electronics, metal | fuel |
| Weapons | Spare parts, metal | a missile or a hand weapon |
| Comfort | Polymer, cloth | none |

The exact amounts are on the [recipes](../../reference/recipes/) pages.

## Mining asteroids

Asteroid fields hold ore. Mining pods cut it, and a refinery processes it.

1. Build a **pod bay**. It comes with a **mining pod**.
2. Select an asteroid from the strip in the node view. The panel lists the ore left on it.
3. Press **Mine** beside a pod, or **Paint ore to mine…** and drag a rectangle over the ore you want. The pods cut just
   those tiles. Tick the pods you want to paint for.
4. A pod needs a crew pilot. Its status reads **waiting for a pilot** until someone gets in. It flies out, cuts until its
   hold is full, comes home and unloads. **Recall** brings it back early.

A pod holds <Stat kind="vehicles" id="vehicle.mining_pod" field="cargo" /> units.

| Ore | Gives | What to do with it |
|---|---|---|
| Iron | Iron ore | Refine to metal. |
| Ice | Ice | Use as it is; a refinery splits it. |
| Rare metals | Rare ore | Refine to electronics. |
| Energy crystal | Energy crystals | Reactor fuel. See [Power](../power/). |

A big asteroid can also be claimed for a base: **Claim for a base…** and drag a rectangle.
