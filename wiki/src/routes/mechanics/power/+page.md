---
title: Power and reactors
order: 1
---

<script lang="ts">
  import Stat from '../../../lib/Stat.svelte'
  import ModuleTable from '../../../lib/ModuleTable.svelte'
  import GamePanel from '../../../lib/GamePanel.svelte'
  import PowerPanel from '../../../../../src/ui/PowerPanel.svelte'
  import { panel, apiOf } from '../../../lib/panels'
</script>

Almost everything aboard runs on power: air, lights, shields, engines, guns and workshops. Reactors make it, everything
else draws it, and when there isn't enough to go round your ship decides who goes without.

## One pool per ship

All the reactors on a ship feed a single shared pool, and every module on that ship draws from it. Distance, walls and
rooms make no difference. Each ship and station has its own pool; docking doesn't share power.

Power itself isn't stored in the pool: what the reactors make each moment is what the ship can use. But reactors need
fuel to make it, and battery banks can hold some back for later. Both are covered below.

The **Ship overview** window (second button on the screens strip) shows the pool as **supply / demand** (for example `50/32`), and turns red when demand is higher than
supply. Click any module to see whether it's **Running** or has **No power**, and how much it supplies or draws.
It also shows your reactor crystals and battery charge (see below).

## Shortages and the power order

When demand outruns supply, modules are served in **power order**, from 1 up:

1. Every consumer has a power order from 1 to 5. Lower numbers are served first.
2. Within the same number, the module that was built first is served first.
3. The first module that doesn't fit in what's left goes dark, **and so does everything after it**, even a small
   module that would still fit. Power isn't shared out partially.

So a shortage always cuts from the bottom of the list. The game raises a **Low power** alert (click it to jump to a
reactor) and logs the shortage. If a reactor has run out of fuel, the alert says so.

To change a module's place in the queue, select it and press **Power…**. The panel shows the whole ship's order, with
anything that's switched on but unpowered in red. You can also switch any module off with its power button. A switched-off
module neither draws nor supplies power, which is the quickest way to free power for something more important. Because
reactors burn fuel in step with the load, switching things off also saves crystals. Some modules also draw nothing while they
have nothing to do, such as an empty hydroponics bed.

<GamePanel title="Module inspector" width="340px" caption="The Power… view of a burst laser: its own order (1 to 5) and the whole ship's order below it, with the laser's row marked.">
  <PowerPanel api={apiOf()} m={panel.power.module} mods={panel.power.modules} onBack={() => {}} />
</GamePanel>

> **Tip:** if a workshop keeps stalling, the workshop usually isn't the problem. Look at what sits above it in the order.

### Default power order

<ModuleTable where="draw" sort="powerPriority" group="powerPriority" groupLabel="Order" />

Beds, storage and containers need no power and always work.

## What goes dark

| Without power… | What happens |
|---|---|
| Life support | Stops making oxygen and scrubbing CO₂. The air slowly goes bad. |
| Lights | The room goes dark, and crew in dark rooms are unhappier. |
| Shield generators | Their shield layers drop, and powered generators set the recharge speed. |
| Engines | Add no evasion, and the jump drive can't charge without at least one powered engine. |
| Helm, weapons and shield consoles | Can't be crewed. With no powered helm the ship can't jump. |
| Weapons | Can't fire. The combat panel marks them **Unpowered**. |
| Research module, galley, workshops | Stop working until power returns. |
| Airlocks | Stall mid-cycle, which also blocks docking and boarding through them. |

Doors don't need power.

## Reactors

<ModuleTable ids="module.reactor, module.reactor.mk2, module.reactor.mk3" columns="power:Power:signed, heatPerSec:Heat / s, maxHp:Hull points" />

Bigger reactors come from blueprints and research; see [Research](../../reference/research/).

### Fuel: energy crystals

Reactors burn **energy crystals**. Each reactor has a small store (<Stat id="module.reactor" field="fuel.store" /> crystals) and burns from it only as fast as the
ship draws power: a reactor carrying half its rating burns half as fast, and one with nothing to carry barely burns at all.
A crystal gives enough energy for a game hour of a basic reactor running flat out (<Stat kind="tuning" id="GAME_HOUR_SEC" unit="seconds" /> of real time). The
bigger tiers hold the same number of crystals, so at full output they get through them faster, but the crystals needed for a
given load are the same whichever reactor supplies it.

**An empty reactor makes no power.** The rest of the ship doesn't notice until the supply falls short, then the power
order decides who goes dark.

Crew refuel the reactors themselves. When a reactor's store falls below <Stat id="module.reactor" field="fuel.refillBelow" /> crystals and the ship's storage holds crystals,
a crew member fetches some and loads it. You don't give an order. This only works if crystals are in storage, so keep
some there.

Crystals in storage are an ordinary item, shown in **Ship stock**. Every starting ship carries a stock, from <Stat kind="tuning" id="starters.prospector.stock.item.energy_crystal" /> to <Stat kind="tuning" id="starters.lancer.stock.item.energy_crystal" /> crystals.

**Where crystals come from**

- **Mining.** Crystals are an ore in asteroid rock. Select an asteroid, then use your mining pods (for example with
  **Paint ore to mine…**) to cut the ore.
- **Stations.** Mining and trading stations sell crystals. The trade window lists them like any other item.
- **Loot.** Enemy ships and derelicts carry some in their holds, and you can take them.

**Running dry**

- The Ship overview shows a crystal count (loaded in the reactors / their combined capacity) next to the battery gauge. It turns
  red when the reactors are below half full and no crystals are left in storage.
- When the supply can't cover the draw, the **Low power** alert appears. If a reactor is the cause it adds that a reactor
  is out of fuel.
- Modules start going dark from the bottom of the power order, as in any shortage.
- A ship with every reactor dry and no battery charge has no power running at all and counts as [disabled](#Under-fire).

Crystals are separate from jump fuel. The **fuel** that charges the jump drive is a different item and a different
supply; see [Your first hour](../../guides/first-hour/).

### Battery banks

A **battery bank** is a small power store. It charges from spare power: when the reactors make more than the ship is
using, the surplus goes into the banks (and the reactors burn a little extra crystal to make it). When demand outruns the
reactors, or a reactor is empty, the banks pay out first, **before any module goes dark**. The ship keeps flying on its
banks until they are flat, then the shortage cuts in as usual.

- A bank holds <Stat id="module.battery" field="battery.capacity" /> power-seconds, about two crystals' worth. That is a couple of minutes at a light starting-ship load and
  less at full draw, so a bank buys you time to refuel, not a way to do without.
- Build more banks to hold more. Every starting ship has one.
- A bank that is switched off or damaged keeps its charge but neither charges nor pays out. A destroyed bank loses its
  charge.
- The Ship overview shows the combined charge as a percentage, in red when it is empty.

### Heat

A running reactor heats its room, and the bigger the reactor, the hotter it runs. Heat spreads to neighbouring rooms
through open doors and slowly bleeds away on its own. Engines add a little heat too.

Crew start taking damage above <Stat kind="tuning" id="HOT_ABOVE" unit="°C" />, and get grumpy in hot rooms well before
that. Give reactors room to breathe: don't wall one into a small space where people work or sleep.

## Under fire

- A destroyed reactor stops supplying power at once, so expect a shortage right after a reactor hit. Banks cover
  the gap for a while.
- **Ion weapons** knock modules out for a while. An ionised module neither draws nor supplies power, and an ionised
  bank neither charges nor pays out.
- A ship is **disabled** when it has no crew able to act, or when it has power sources but none is running (all off,
  ionised, destroyed or out of fuel) and no bank covers the load. A ship whose reactors are all destroyed, or that has
  taken too much damage overall, becomes a **wreck**. An empty reactor is not a destroyed one, so a ship that runs
  dry is disabled, not wrecked, and can recover when it is refuelled.

## Enemy ships and stations

Other ships burn crystals too. Enemy ships spawn with a few days of crystals in their stores and their crews refuel
them, so a long fight doesn't leave them dry. Stations keep a large stock that their supply runs refill.

That makes crystals worth taking. Whatever is in an enemy's hold when you board or salvage it is loot.

Derelicts you find adrift usually have empty reactors. A few are running on emergency power for lights and life
support only, on their last crystal. Once aboard you can switch modules back on, but nothing lasts long
until you bring crystals over and load the reactor.

See the [module reference](../../reference/modules/) for every module's exact draw.
