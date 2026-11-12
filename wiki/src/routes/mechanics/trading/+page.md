---
title: Stations and trading
order: 10
---

<script lang="ts">
  import Stat from '../../../lib/Stat.svelte'
</script>

Stations are where you sell what you've found, buy what you need, take work, hire crew and expand your hull. You deal with
them over a comms channel. Trading ships on the lane work the same way, with a captain in place of the station staff.

## Hailing and docking

You don't fly your ship into a station. You stay in the node and your **shuttle** does the running.

1. Select the station in the node view. Its panel shows the owner, docks and defences.
2. Press **Hail station**. For a ship the button reads **Hail ship**.
3. The **Channel** window opens. The station answers with the person who handles each service.

A hail can be refused. You'll see the reason and a **Hail again** button:

| Message | Why |
|---|---|
| They have no interest in talking to you. | Your standing with their faction is too low. |
| Their guns are on you: they will not talk. | Their guns are aimed at you. Try again when they stand down. |
| You refused their inspectors: they will not deal with you for a while. | See [Contraband and inspections](../inspections/). |
| No answer. Nobody is aboard to hear. | A dead or empty ship. |

> **Warning:** a station of an enforcing faction (navy or corporation) may send inspectors aboard when you first open
> trade with it. Trade waits for the search. See [Contraband and inspections](../inspections/).

When you buy or sell, your shuttle docks at a **free, working airlock** on the station and the station's crew carry the
goods across. With a trading ship it hovers beside the hull instead. For this you need a shuttle in a bay, a working
airlock of your own, and that shuttle not being busy with another run. The slip tells you when something is missing.

## The channel

The Channel window has video of the contact on the left, a transcript in the middle, and the station's sensors and a list
of **Services** on the right. Each service has its own contact, a named person with a face and title.

| Service | Contact | What it does |
|---|---|---|
| **Station** | Dock control | The price list and what else the dock offers. Shows an alarm if the station is on alert. |
| **Trade** | Quartermaster | Opens the trade window. |
| **Jobs** | Job broker | Work posted here, and finished work to hand in. |
| **Crew** | Recruiter | People looking for a berth. |
| **Blueprints** | Archivist | Plans for sale. |
| **Shipyard** | Yard master | Hull expansion. |

A station only lists the services it has. On a ship, the channel is the captain's bridge and only has trade, if they trade.

The title bar shows who owns the station and how they regard you: **friendly**, **neutral** or **hostile**. It also shows
your credits. A **BLACK MARKET** chip and a **TRUCE** chip appear on stations that have them.

## The trade window

**Trade** opens its own movable window. You can pin it open while your shuttle flies.

The left side is the **market list**: one row per item, covering everything they stock and everything you hold.

| Column | Meaning |
|---|---|
| **Aboard** | How many you have. |
| **They pay** | What they'll give you for one. A dash means they don't buy it. |
| **Stock** | How many they have. |
| **Price** | What they ask for one. |
| **Sell · Buy** | The picker. |

Chips mark special lines. **Surplus** is older, middle-grade gear a depot sells off. **Contraband** can only be sold to a
black market.

### The pickers

Each row has a **−** and **+** with a number between them. Positive numbers buy, negative sell. Walking the number down
through zero turns a buy into a sale.

| Input | Change |
|---|---|
| Click | 1 |
| **Shift**-click | 5 |
| **Ctrl**-click | 10 |
| **Alt**-click | As many as you can afford, or as many as they can pay for or you hold |
| Type a number | Exactly that |

### The deal slip

On the right, **This deal** lists what you'd buy and sell, each with a price, then the total: **You pay**, **You get** or
**Even trade**. Under it: your credits before and after, and how many shuttle trips it needs. It tells you if you can't
afford it, if they can't afford to pay you, or if no shuttle is free.

1. **Propose** puts the deal to them. The pickers lock.
2. The slip becomes **Proposed deal**. **Accept** agrees it. **Withdraw** takes it back.
3. **Clear** empties the picks before you propose.

The shuttle then runs the goods across in trips, as many as it takes. **Deliveries** at the bottom shows each deal with
its trip count and progress. **Call off** cancels one that hasn't finished, and refunds what hasn't moved.

### Queued deals

You can agree several deals with the same partner. They queue and run one after another. Nothing is held for a queued
deal, so you can call it off at no cost. If something changes before it starts, such as a sold-out shelf or a spent
purse, it fails at the front of the queue.

### Refuel

When the station sells fuel, a **Refuel** button on the slip tops up your fuel in one click and accepts the deal for you.

### Prices

A price is built from the item's base value:

- The station **sells** at <Stat kind="tuning" id="trade.spread.sell" /> times base and **buys** at <Stat kind="tuning" id="trade.spread.buy" /> times it, so you can't make money shuttling the same
  goods back and forth.
- **Scarcity**: cheap where plentiful, dear where scarce. The starmap shows a port's cheap and wanted goods.
- **Standing**: friends sell for less and pay more, about <Stat kind="tuning" id="trade.repStep" percent /> per point of standing, up to <Stat kind="tuning" id="trade.repMax" percent />.
- Factions and kinds of station add their own adjustments.

## Jobs

Stations, depots and dens post work. Press the **Jobs** button on the navigation strip to open the jobs window, or open the **Jobs** service
in a channel. The window lists the jobs you hold, finished work ready to hand in, and what's offered here.

You can hold <Stat kind="tuning" id="MAX_JOBS" /> jobs at once. A station posts up to <Stat kind="tuning" id="OFFERS_PER_PORT" /> offers, and they
change every <Stat kind="tuning" id="OFFER_TURNS" /> turns. Each card shows the pay, where, how many jumps away, the
turns left and the client. A card with three turns or fewer left has an amber edge.

| Job | Posted by | What you do |
|---|---|---|
| **Delivery** | Trading stations | A sealed crate comes aboard. Carry it to the other port. At arrival the station sends a shuttle, your crew haul the crate to the airlock and you're paid when it leaves. |
| **Bounty** | Military stations and depots | Destroy or take a named ship, then **Hand in** at a station of the same faction. The card compares its guns, shields and size with yours. |
| **Survey** | Research stations | Visit a node, then **Hand in**. |
| **Passage** | Passengers aboard | A passenger wants a lift. See [Travel and encounters](../encounters/). Accept or refuse from the card, wherever your ship is. |

Pay scales with distance and danger:

| Job | Base | Per jump | Per danger tier |
|---|---|---|---|
| Delivery | <Stat kind="tuning" id="DELIVERY_BASE" /> | <Stat kind="tuning" id="DELIVERY_PER_HOP" /> | <Stat kind="tuning" id="DELIVERY_PER_DANGER" /> |
| Bounty | <Stat kind="tuning" id="BOUNTY_BASE" /> | <Stat kind="tuning" id="BOUNTY_PER_HOP" /> | <Stat kind="tuning" id="BOUNTY_PER_DANGER" /> |
| Survey | <Stat kind="tuning" id="SURVEY_BASE" /> | <Stat kind="tuning" id="SURVEY_PER_HOP" /> | <Stat kind="tuning" id="SURVEY_PER_DANGER" /> |
| Passage | <Stat kind="tuning" id="PASSAGE_BASE" /> | <Stat kind="tuning" id="PASSAGE_PER_HOP" /> | none |

Finishing a job raises your standing with the client's faction by <Stat kind="tuning" id="JOB_REPUTATION" />. Running out of
time, abandoning it or breaking open a delivery crate fails it, which lowers standing by <Stat kind="tuning" id="JOB_FAIL_REPUTATION" />.
A failed delivery also adds <Stat kind="tuning" id="BREACH_NOTORIETY" /> notoriety.

### The jobs tracker

The tracker on the right edge keeps your jobs in view. It splits them into what you can do **in this node**, highlighted with
what to do, and the rest, nearest first. Each shows turns left and pay.

## Crew for hire

The **Crew** service lists people looking for a berth, with species, role, skills and a fee. Press **Hire**. Your shuttle
flies to the station to pick them up. The fee is held until they step aboard, and refunded if the run fails. If you
have no free shuttle or airlock, hiring waits. Shady crew cost more up front, draw no wages and are better at their job. They are only found at black markets.

## Blueprints

The **Blueprints** service sells module plans. Research stations sell most modules, military stations sell the
defence ones. Better versions (Mk II, Mk III) turn up only in more dangerous space, and some of a faction's best gear is
held back until your standing with it is high enough. A hostile faction sells nothing. See
[Research](../../reference/research/).

## The shipyard

Trading and military stations (not their smaller outposts) have a shipyard. It builds the hull you plan:

1. Draw the outline with **Build → Hull plan**, anywhere, any time.
2. At a yard, open **Shipyard**. It quotes the cost of what it can build on this visit.
3. Press **Buy hull**.

The station's shuttle brings a crew of contractors who work in suits on your hull. Your own crew can help. **Send the crew
home** ends it early and refunds the part not built. Whatever the yard can't finish this visit stays planned for the next
one.

A station yard builds up to <Stat kind="tuning" id="yard.sizes.station.cap" /> tiles a visit; a hub builds <Stat kind="tuning" id="yard.sizes.hub.cap" /> and charges <Stat kind="tuning" id="yard.sizes.hub.price" /> times as much. Each tile costs <Stat kind="tuning" id="yard.perTile.credits" /> credits and some
metal, and costs a little more in dangerous space. Tiles that need a quick truss pass first cost a small planning fee.
The yard warns you if the hull is now bigger than your engines can carry, in which case jumping needs an overcharge.

## Factions and standing

Every faction has its own **standing** with you. The starmap legend and the channel's title bar show it as **friendly**,
**neutral** or **hostile**. A faction's allies and rivals pull it a little too.

| Standing | Tier |
|---|---|
| <Stat kind="tuning" id="FRIENDLY_AT" /> or more | Friendly |
| From <Stat kind="tuning" id="HOSTILE_BELOW" /> up to <Stat kind="tuning" id="FRIENDLY_AT" /> | Neutral |
| Below <Stat kind="tuning" id="HOSTILE_BELOW" /> | Hostile |

What it changes:

- **Prices**: friends sell for less and pay more (see above).
- **Hailing**: a hostile faction won't talk to you. The law (navy and corporations) also turns hostile while you are
  **wanted**: the starmap legend shows your **Notoriety**, and **Hunted by** lists factions sending hunters.
- **Blueprints**: hostile factions sell nothing and some gear needs high standing.
- **Interdictions**: a faction that likes you asks less to let you pass.

What moves it:

| Action | Effect |
|---|---|
| Finishing a job | Up with the client's faction. |
| Failing or abandoning a job | Down with the client's faction. A failed delivery also adds to your notoriety. |
| A fair trade with a skiff, helping a ship in trouble, rescuing a patient | Up with their faction. |
| Firing on or boarding ships that didn't attack you | Down. |
| Killing or capturing ships | Down with their faction, and up your notoriety. |
| Refusing or fighting inspectors, running from a patrol | Down. See [Contraband and inspections](../inspections/). |

Each faction page under [Factions](../../reference/factions/) lists who they are.
