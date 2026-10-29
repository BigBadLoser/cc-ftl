---
title: Power and reactors
order: 1
---

<script lang="ts">
  import Stat from '../../../lib/Stat.svelte'
  import ModuleTable from '../../../lib/ModuleTable.svelte'
  import ComingLater from '../../../lib/ComingLater.svelte'
</script>

Almost everything aboard runs on power: air, lights, shields, engines, guns and workshops. Reactors make it, everything
else draws it, and when there isn't enough to go round your ship decides who goes without.

## One pool per ship

All the reactors on a ship feed a single shared pool, and every module on that ship draws from it. Distance, walls and
rooms make no difference. Each ship and station has its own pool; docking doesn't share power.

The ship overview shows the pool as **supply / demand** (for example `50/32`), and turns red when demand is higher than
supply. Click any module to see whether it's **Running** or has **No power**, and how much it supplies or draws.

## Shortages and the power order

When demand outruns supply, modules are served in **power order**, from 1 up:

1. Every consumer has a power order from 1 to 5. Lower numbers are served first.
2. Within the same number, the module that was built first is served first.
3. The first module that doesn't fit in what's left goes dark, **and so does everything after it**, even a small
   module that would still fit. Power isn't shared out partially.

So a shortage always cuts from the bottom of the list. The game raises a **Low power** alert (click it to jump to a
reactor) and logs the shortage.

To change a module's place in the queue, select it and press **Power…**. The panel shows the whole ship's order, with
anything that's switched on but unpowered in red. You can also switch any module off with its power button. A switched-off
module neither draws nor supplies power, which is the quickest way to free power for something more important.

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

### Heat

A running reactor heats its room, and the bigger the reactor, the hotter it runs. Heat spreads to neighbouring rooms
through open doors and slowly bleeds away on its own. Engines add a little heat too.

Crew start taking damage above <Stat kind="tuning" id="HOT_ABOVE" unit="°C" />, and get grumpy in hot rooms well before
that. Give reactors room to breathe: don't wall one into a small space where people work or sleep.

<ComingLater>

Reactors burning fuel rods. For now a reactor runs for as long as it is switched on and intact.

</ComingLater>

## Under fire

- A destroyed reactor stops supplying power at once, so expect a shortage right after a reactor hit.
- **Ion weapons** knock modules out for a while. An ionised module neither draws nor supplies power.
- A ship whose power sources are all off is **disabled**, and a ship whose power sources are all destroyed becomes a
  **wreck**. That applies to enemies too.

Derelicts you find adrift may have their reactors off, or be running on emergency power for lights and life support
only. Once aboard, you can switch modules back on.

See the [module reference](../../reference/modules/) for every module's exact draw.
