---
title: Travel and encounters
order: 8
---

<script lang="ts">
  import Stat from '../../../lib/Stat.svelte'
  import GamePanel from '../../../lib/GamePanel.svelte'
  import SignalSample from '../../../lib/SignalSample.svelte'
</script>

Your ship moves between places on the starmap. On the way you can meet other ships, wrecks and calls for help. Most of
them start as a signal you can read from the lane before you commit to anything.

## The map: nodes, sectors and hyperlanes

- A **node** is one place you can actually play: a station, an asteroid field, a wreck, or empty space. It is one grid with
  your ship in it.
- A **sector** is a group of nodes.
- **Hyperlanes** link sectors. Crossing from one province into another goes through a **gate**, which costs extra fuel.
  Leaving a province is a decision.

Open the starmap with **M**, or with the Starmap button on the left strip. Three buttons set the zoom: **Sector**,
**Cluster** (a faction's province) and **Galaxy**. Click a node to see it in the side drawer: its danger rating, who owns
the space, what is there, and which ships are in the area. Territory is coloured by faction, and the legend shows your
standing with each one (see [Stations and trading](../trading/)).

Two buttons on the map are worth knowing:

- **Where to sell** shows which known ports pay most for what you carry.
- **News and rumours** lists what the map has heard, such as shortages and wars.

## Jumping

1. Click the node you want. The drawer plots a route and shows its fuel cost, how much FTL charge it needs, and a hop by
   hop list.
2. Press **Jump**. A route of several hops reads **Jump (3 hops)**.
3. If the drive isn't charged yet, **Jump when charged** queues the trip behind the charge.

Each hop takes one turn of game time. You pay fuel as you enter each hop. If you run short, the trip stops where the fuel
runs out and the drawer says so. A ship that is too big for its engines needs **Overcharge**, which risks engine damage,
a lost engine and fires in the engine room.

Before you go, the game warns you if anything would stay behind: crew away from the ship, shuttles outside it, or a hostile
shuttle docked at an airlock. **Jump anyway** goes without them. You can tick a docked hostile shuttle to take it along
or cut it loose.

While you travel, the drawer shows your progress along the route. **Drop from hyperspace** ends the trip at the next
node. Mid-hop it takes effect when the hop ends.

> **Tip:** if a signal comes in, travel holds until you answer it. A jump you start isn't lost; the trip carries on after
> you've decided.

## Signals on the lane

During a trip, a hop can draw a signal. There are two kinds of window, by who is on the line.

**Someone is calling you** (a distress call, a trader skiff, a surrendering pirate scout, a Meridian checkpoint, the pirate you spared): the **Incoming signal**
comms window opens, with the call already connected. It holds three panes.

| Pane | What it shows |
|---|---|
| **Video** | The caller's face and details. You are already talking, so there is no call to answer. |
| **Comms** | A transcript, and what they carry and have in their wallet. |
| **Sensors** | A hologram of the ship with a readout, once you press **Scan**. Before that: **NO SCAN**. Not shown when there is nothing to scan (a checkpoint). |

<GamePanel title="Incoming signal" bare width="1080px" zoom={0.74} caption="A returning pirate skiff after a scan: the caller on video and in the transcript, the ship as a hologram with its readings, and the decisions along the bottom.">
  <SignalSample />
</GamePanel>

**Nobody is calling** (a derelict, a pod beacon, a maintenance terminal): a plain decision window opens with the event's text. Its **Scan** (and **Hack its
data core**, for a derelict) are small buttons in the window. Each fills in a readout below the text.

The bar along the bottom holds your real choices, never more than three.

### Scan

You can read a signal without leaving the lane. A scan is free and stays open until you decide.

- **Scan (S)** fills in the sensor panel (or the readout in a plain decision window). The rows depend on what the signal is. A scan can be a deeper **probe** if
  the event offers one.

You can change the key in the settings. A scan is always safe: nothing is spawned and nothing changes until you pick a real choice.

Then you decide:

- **Drop out** (the button's label varies) takes you out of the lane into a pocket of empty space beside the signal. The
  trip waits there.
- **Fly on** or **Skip** ignores the signal and the trip continues.

## Off the lane

When you drop out, a panel appears at the top with the roster of ships there and what state they're in. Everything on the
panel is an action you already know: hail ships, trade, board, salvage.

**Resume travel** sends you on along your route. It is blocked while:

- a trade is under way,
- any of your crew or a shuttle are away, or
- hostile ships are in range and your drive isn't charged. With hostiles about, the button reads **Flee and resume** and
  spends the charged drive.

Ships in these scenes leave after a while unless you hail them. When you leave, whatever you didn't take is lost: a wreck
you didn't strip, goods you didn't buy.

## Encounters

### Trader skiff

A small trader drifting along the lane with its transponder on. The call opens with its stock on the screen. Scan it for its hull, crew and
whether its drive is warm. Drop out beside it, then select it and press **Hail ship** to trade (see
[Stations and trading](../trading/)).

A skiff holds station once you hail it. If you don't, it eventually leaves. You can also board it or fire on it, but
that costs you standing, and the first shot turns it hostile.

### Derelict

A dead hull with no transponder. **Scan** reads its make, condition, air, jammed doors, signs of life and loose cargo.
**Hack its data core** is a deeper scan that gives counts. It needs a hacker of skill 4. After you've worked two wrecks,
any scan reads counts.

You need a shuttle in a bay to approach a derelict, and they only turn up in the calmer parts of the map. What you do with it is
covered in [Salvage and derelicts](../salvage/).

### Distress freighter

A crippled freighter with its reactor failing. Its crew can't repair it themselves.

1. The call is already open: the crew's story is in the transcript.
2. **Scan** to see the failing system, how long it has, the cargo, and whether raiders are on it or coming.
3. **Offer help** is open from the start, since you are already talking, and needs a shuttle that can fly a suited party. It drops you out beside the ship, and your repair party goes aboard as invited
   guests. They don't provoke anyone.
4. Your engineers repair the reactor through the usual repair work. Fires break out in its last <Stat kind="tuning" id="events.event.distress_call.scene.timers.0.fires.leadSec" /> seconds.

The clock runs about <Stat kind="tuning" id="events.event.distress_call.scene.timers.0.afterSec" index={0} /> to <Stat kind="tuning" id="events.event.distress_call.scene.timers.0.afterSec" index={1} /> seconds from when you drop out. If it runs out, the reactor blows. The blast damages
modules and hull around it and hurts crew who are close. Then the ship goes dark and becomes a wreck.

If you repair it in time, the freighter's owner thinks better of you and the crew send over part of their cargo.
Leaving with the job half done costs a little standing and the ship's fate follows its own clock.

Deeper in, some freighters have raiders already on them, or raiders that jump in on a timer. The scan's **Raiders** row
tells you which. See [Combat](../combat/) and [Boarding](../boarding/).

### Medical pod

An escape pod beacon with a life sign in it. You need a bed aboard to answer it. **Scan it** to see who is aboard, how
badly hurt they are and what skills their suit logs.

After dropping out, press **Bring the pod in**. It docks at a free airlock and your crew carry the patient to a bed. They
bleed out on a clock of <Stat kind="tuning" id="events.event.medical_emergency.scene.pods.0.bleed" index={0} /> to <Stat kind="tuning" id="events.event.medical_emergency.scene.pods.0.bleed" index={1} /> seconds, so be quick.

If the patient pulls through:

- They pay what they carry and their people think a little better of you.
- They ask for a passage home, which comes as a job you can accept or refuse.
- If they're happy aboard for long enough, they may ask to join the crew. An urgent alert tells you; say yes or no.

Passengers lodge aboard as guests. They need a bed and air, they eat and sleep as crew do, and they help with hauling and
cooking at low priority. They don't fight, and you can't draft them.

### Pirate interdiction

A pirate, route guard or hunter fleet stops your jump. The comms window opens with the captain on video and their ship on
the sensors. Their demand is on the transcript, and the window stays open with their reply after you answer. You have
three options:

| Choice | What happens |
|---|---|
| **Evade** | A roll. The odds are on the button. They depend on your pilot, your powered engines and how strong the fleet is. With no pilot or no powered engines they are poor. Failing drops you into the fight. |
| **Bribe** | Pay credits and they leave you alone for a while. The price grows with the fleet's strength and the danger of the node, and falls if their faction likes you. A faction hunting you asks more. |
| **Fight** | Drop out and fight. See [Combat](../combat/). |

A hunter fleet that you bribe calls off the hunt.

### Pirate ambush

If you once let a pirate scout go, he may come back. A skiff hails you and says it owes you a debt. Listen and scan to
judge whether it's honest.

- **Honest**: let it dock and it hands over four missiles at your airlock, and pirates think better of you. Refusing is
  free but it leaves the debt unpaid.
- **Trap**: a boarding party of three and a shuttle. Let them dock and they turn on you. Refusing turns the skiff hostile
  at once.

Look for the tells. Some only show on screen:

- The caller's **name** flickers to a second name on the video card, or the video **stutters**. Anyone can see these.
- On a scan, the **transponder ID** changes to a different value. Spotting that takes a hacker of skill 4.
- The other scan rows depend on your crew's best skill. A gunner of skill 2 reads whether the guns are powered, a pilot of
  skill 2 reads whether the shuttle is fuelled with suited crew in the bay, a hacker of skill 2 reads the crew count. With
  less skill, the row says something vague and true.

> **Tip:** keep a good gunner, pilot and hacker aboard on the lane.

**Let them dock** and **Refuse** are the buttons on the panel.

### Patrol hails

A navy or corporate patrol whose scan flags you as a smuggling risk stops your jump and hails you in the comms window.
That's covered in [Contraband and inspections](../inspections/).

### Ships you cross

Other ships on the lane sometimes hail or scan you in passing. If they are friendly, there's nothing to decide beyond
**Acknowledge**. A crippled fleet can send a distress call. **Respond** drops you out to help. You can leave again at any time without a penalty, but standing only rises if you actually helped: a deal with the damaged ship has to go through before you leave. Leave early and the ship stays adrift.
