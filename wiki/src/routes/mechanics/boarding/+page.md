---
title: Boarding and crew fights
order: 7
---

<script lang="ts">
  import Stat from '../../../lib/Stat.svelte'
  import ComingLater from '../../../lib/ComingLater.svelte'
</script>

Not every fight is decided by guns. Crew can cross to another ship in a shuttle, wreck its modules, kill or capture its
crew and take the ship. The same rules apply when enemies come aboard yours. For the ship-to-ship side, see
[Ship combat](../combat/).

## Boarding an enemy

You need a **shuttle** stowed in a bay, a free, working **airlock** on the target, and at least one crew member free to go.
Open the **Board** tab on the left of the combat strip, or press **B**.

The **Board** picker has four parts:

| Part | Choose |
|---|---|
| **Shuttle** | Which shuttle goes, if you have more than one. The seats show beside it. |
| **Party** | Who boards, up to the number of seats. Three able crew are ticked to start; change them as you like. |
| **Airlock** | Which of the enemy's airlocks the shuttle docks at. |
| **Launch** | Sends them (**Enter**). |

The crew walk to the bay, and the shuttle **flies itself** to the enemy airlock; you don't pick a pilot. The game goes on
running while the picker is open. Only the crew you picked cross.

If the tab is dimmed it says why: **No target** (the ship is already a wreck), **No shuttle**, **No shuttle in the bay**
(it's away, on a cargo run or has crew in it), **No reachable airlock** or **No crew free to go**. Downed crew can't go.

Boarding a ship that isn't hostile turns it hostile, along with the ships that came with it, just as firing on it does.
See [Ship combat](../combat/).

### The boarding party card

While your party is on the enemy ship, a **Boarding party** card sits under the enemy card. Each boarder has a health bar
and a state: **ready**, **fighting**, **wrecking** (sabotaging), **returning** or **down**.

- **Select** a boarder by clicking their name. Boarders are ordinary crew, so everything in
  [Drafting crew](#drafting-and-ordering-crew) applies.
- **Sabotage.** Select boarders and **right-click an enemy module**. They walk to it and wreck it. The card shows the
  module's health and who is on it, and a **Cancel** button. Sabotage **pauses while hostiles are in sight** and resumes
  once the fighting is over.
- **Recall party** walks everyone back to the shuttle and flies them home. It needs a shuttle still docked at the enemy.
  The fight itself doesn't call the party home.
- **Friendly fire.** If your ship's guns are aimed at a module where your own crew are standing, the card warns you which
  weapon, which module and who is there. Re-aim or recall.

If the shuttle's airlock is lost, it docks at another one, or the party goes out of the hatch. If boarders can't be brought
home, you get an urgent **Crew stranded** alert while they're still over there. You can't leave a node while crew or
shuttles are still out.

## Taking the ship

The enemy's crew fight the intruders. A ship can be **taken** when:

1. all its crew are **down, surrendered or dead**; and
2. one of your combat-ready crew **holds its bridge**: they stand within a couple of tiles of the helm for about
   <Stat kind="tuning" id="CAPTURE_HOLD_SEC" unit="s" />, unopposed.

A machine-run ship (rogue AI) has no crew to beat; its AI cores are its will, so you take it by knocking out the cores
and then holding a bridge. Some ships never surrender.

A taken ship becomes your **prize**. Its weapons are dead, its AI off, and some loot is left in its hold. The **Prize**
panel shows its value, how many of your crew are aboard, and its prisoners. You can **Scuttle** it into a wreck (not with
your crew aboard) or strip it; see [Salvage](../salvage/).

If its crew all give up and you can't reach the ship (no one of yours aboard, no shuttle docked or flying to dock), it is
given up as a derelict instead and the chance to take it is gone. So keep your party there until the hold completes.

### Prisoners

Enemy crew who surrendered or were downed when you took the ship are held as **prisoners** on the prize, listed on the
Prize panel with their health.

<ComingLater>

Doing anything with prisoners. For now they just stay where they are: there is no brig, ransom, sale or recruiting.

</ComingLater>

## Being boarded

Enemy ships can launch boarding parties at you in the same way. The first sign is the **Under attack** alert and an enemy
shuttle docking at an airlock, or intruders appearing aboard.

Your crew defend themselves:

- **Armed crew fight** anything hostile they see. Crew with strong melee or gunnery skill (6 or more) also **hunt
  intruders they can't see yet**.
- **Unarmed crew fetch a weapon** from storage, if there is one.
- Crew who stay unarmed **hide** out of sight and out of reach, and pick up the downed they can safely reach.
- **Pacifists never lift a weapon.** Passengers and guests never fight.

Nothing here costs you control: you can draft crew and give orders at any time.

## Drafting and ordering crew

**Drafting** takes crew off their jobs so you can order them. Select crew and press **R**, or use the **Draft all**
tile in the crew bar (it reads **Stand down** when everyone is drafted). A drafted crew member stands by and takes no
jobs until you stand them down. The crew bar marks them **Drafted**.

**Right-click** with drafted crew selected for what is under the cursor:

| Option | When it appears |
|---|---|
| **Attack** *name* | On a hostile. |
| **Man** *station* | On a console or other station. |
| **Board** *shuttle* | On a shuttle or its bay. |
| **Sabotage** *module* | On a working module of a ship your people are boarding. |
| **Force door** | On a jammed door. |
| **Walk here** | On open floor. |

Your own ship's fights don't need the draft: undrafted crew defend too. Drafting is for when you want to pick targets,
hold a doorway or send people somewhere.

## Weapons and gear

Each crew member carries one **hand weapon**. Crew choose by skill: gunnery at least as good as melee gets a ranged weapon, otherwise a blade.

| Weapon | Kind | Notes |
|---|---|---|
| **Sidearm** | Ranged | The default kit. |
| **Rifle** | Ranged | Longer reach, hits harder. |
| **Ion pistol** | Ranged | Low damage, ion-based. Never picked automatically. |
| **Blade** | Melee | Adjacent only. |
| **Disruptor** | Ranged | A strong rifle that is illegal; black market only. |

Prices and tiers are on the [items reference](../../reference/items/). The **Gear** tab of the crew inspector shows what each
crew member is carrying. Spare weapons in storage are fetched by unarmed crew when boarders are aboard.

How well a shot lands:

- It depends on the shooter's gunnery (or melee) skill, and ranged shots lose accuracy with distance.
- A target **behind a solid module** gets partial or full cover, which cuts the chance to hit. Cover is passive: crew don't
  seek it themselves.
- A **spacesuit** is bulky: it makes shots and blows land less often.
- Hit chance is never below 5% or above 95%.

<ComingLater>

More hand weapons. Several (laser pistol, shotgun, plasma cutter and others) have art but aren't in the game yet.

</ComingLater>

## Forcing doors

Doors on derelicts can **jam**, held open or held shut until someone forces
them. A jammed-shut door blocks walking, and neither kind moves until forced.

- Click the door tile: the tile inspector shows **Jammed shut** or **Jammed open** with a **Force door** button. A crew
  member pries it free (it takes about six seconds of work, faster for skilled crew). **Stop forcing** cancels.
- With drafted crew selected, **right-click the door** and pick **Force door**. The nearest drafted crew member does it.
  A crew member who is busy fighting won't.

## Downed crew, rescue and surrender

**Downed.** A crew member who runs out of health doesn't die at once. They drop where they are and **bleed out** over
<Stat kind="tuning" id="BLEED_OUT_SECONDS" unit="s" />. An urgent **Down: name** alert tracks them.

**Rescue.** A crew member with medical work enabled picks up a downed crewmate and carries them to a **bed**. Once
stabilised, they heal in the bed and get back on their feet. During a boarding, unarmed crew only rescue patients who are
out of the intruders' sight. A medic is the best defence against losing crew. See [Crew](../crew/).

**Surrender.** Hurt, outnumbered crew can give up:

- **Enemy crew** surrender when their health drops below 30% and more of your people than theirs stand close by.
  **Fearless species and Brave crew never surrender.**
- **Your crew never surrender**, with one exception: a **Coward** gives up at the same point, and runs from foes when
  below half health. A surrendered crew member lays down their weapon and stops working, then **rallies** a few seconds
  after no hostile is left on their ship.
- A hostile **ship** whose fight is lost surrenders as a whole; see [Ship combat](../combat/#how-fights-end).

Traits change all of this; see [Crew](../crew/). Fear, injury, fire and combat also strain mood, and a panicking crew
member may flee or freeze; see [Mood](../mood/).
