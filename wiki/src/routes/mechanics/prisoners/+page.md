---
title: Prisoners and stasis
order: 12
---

<script lang="ts">
  import ComingLater from '../../../lib/ComingLater.svelte'
</script>

Enemy crew you capture are **prisoners** (see [Boarding](../boarding/) for how you take a ship). You hold them in a
**stasis wheel**: each prisoner is sealed into a **stasis slab** where they stand, and the slab is carted to the wheel.
Frozen, a prisoner needs no food and can't escape, as long as the wheel has power.

## The stasis wheel

A 3x3 module with ten slots, loaded through a hatch at its front corner. It needs its blueprint, sold at research
stations. A newly built wheel comes with **ten empty slabs** already in its slots.

The wheel draws power only while it holds a prisoner. A wheel with no prisoners in it is idle and costs nothing.

**Reading the wheel:** a lamp on its rim marks each slot. **Green**: a prisoner is held there. **Amber**: an empty slab
is ready. **Red, blinking**: that slab is running on its reserve (below). **Dark**: the slot has no slab. The window in
its housing shows the slabs inside.

Select the wheel to see the same lamps as a ring on its **Overview** tab, with a list of who is held and how much of each
slab's reserve is left; click a name to select that prisoner. A frozen prisoner's own panel shows their slab: in which wheel
slot, or who is carting it and where to, and its reserve.

## Sealing a prisoner

Nobody is sealed until you say so. Select a prisoner and press **Seal in stasis**, or press **Seal** beside their name
on the prize panel (**Seal all** marks every prisoner on the ship). The button says why when it cannot be used, for
example when the ship has no stasis wheel with room that the prisoner can be carted to. **Cancel seal** calls the order
off: a crew member already on the way sets the empty slab down where they stand, and nothing is lost.

Once a prisoner is marked, your crew do the rest on their own, as **Hauling** work (set it in the work priorities like
any other hauling). On a ship with a wheel with room:

1. A crew member takes an empty slab, from a wheel slot or from storage.
2. They walk to the prisoner and seal them into it where they stand.
3. They cart the full slab to a wheel with a free slot and stand it in. The slab rides a **hover cart** they push
   ahead of them; when they stop, the cart is parked beside them.
4. At the wheel's hatch, the wheel first turns a free slot round to it. The hatch opens, the cart docks and sets the slab
   on a cradle, and the cradle tips the slab up and runs it in, about eight seconds in all. The wheel then steps on
   one slot. The sealed prisoner shows pressed into the slab's face the whole way, on the cart, during the loading and
   in the wheel's window.

If the crew member carting a slab is called away (downed, drafted, sent off by a fire), the slab is set down on the
floor and another crew member picks it up later. A slab lying on the floor runs on its reserve (below), so it shows up
in the stasis alert until it is back in a wheel.

## Prisoners on a captured ship

A captured ship (a prize) usually has no wheel, so its prisoners are fetched by **shuttle**. Mark them as above (the
button is only refused when you have no shuttle at all, or no wheel with room on a ship of yours); the crew see to the
rest:

1. If no shuttle is serving the prize yet (your boarding party's, or a salvage run's), a free shuttle is sent. Crew who
   do hauling take its seats.
2. Before it leaves your ship, it takes **empty slabs** into its rack, one for each marked prisoner, from your wheel or
   storage. The rack holds four slabs.
3. On the prize, the crew seal each prisoner where they stand and cart the full slab back to the shuttle.
4. When the work is done the party flies home with the slabs. In the rack a slab **keeps its charge**. By your shuttle
   bay the slabs are set down, and your crew cart them to the wheel as usual.

While a marked prisoner waits, the line under the button says on what: a free shuttle, crew for the seats, or the
shuttle on its way. If the shuttle is destroyed with slabs aboard, those prisoners are lost with it.

## Releasing a prisoner

**Release** (on the prize panel, or in a prisoner's own panel) lets them go: they leave, and their faction thinks better
of you. A frozen prisoner can be released too: their slab is opened and the empty slab stays where it was (in the
wheel slot, or on the floor). A slab on its way, on a hover cart or in a shuttle, can be released once it is set down.

## Empty slabs

An empty slab is an ordinary item. A fabricator makes one from metal and electronics, and trade stations and navy depots
sell them, so you can restock once full slabs have left the wheel. Crew take empty slabs from storage when the wheel has
none of its own.

## Power and thawing

A slab keeps its prisoner frozen while it stands in a **powered** wheel. When the wheel loses power (a shortage, switched
off, wrecked) or a slab lies on the floor, each slab runs on a **reserve of about one game hour**, and the urgent alert
**Stasis failing** shows how long the first one has left. A slab on a hover cart keeps its charge. Power back on refills
the reserves.

When a reserve runs out, that prisoner **thaws out inside your ship, hostile**, and fights your crew. The slab they were
in is left empty.

<ComingLater>

What you can do with prisoners once they are held: handing them over at a station for ransom or a bounty, selling them
at a black market, or recruiting one.

</ComingLater>
