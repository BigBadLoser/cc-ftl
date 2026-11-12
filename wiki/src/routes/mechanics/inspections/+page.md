---
title: Contraband and inspections
order: 11
---

<script lang="ts">
  import Stat from '../../../lib/Stat.svelte'
  import ComingLater from '../../../lib/ComingLater.svelte'
</script>

Some goods are illegal to carry. Navy and corporate stations and patrols look for them, and a search can cost you credits,
goods and standing. This page covers what is banned, how a search runs, and your options when they find something.

## What counts as contraband

An item is contraband if it is marked so in the item list, and the game shows a **Contraband** chip on it in the trade
window. The current list:

- **Stolen goods**, such as the cargo spilled from a delivery crate you broke open.
- **Looted goods**, taken off captured ships.
- **Disruptors**, a hand weapon.
- **Nuclear warhead**, a weapon upgrade for the nuke launcher.

An honest trader refuses to buy contraband. Only a [black market](#Black-markets) will.

## Station inspections

Stations of an **enforcing faction** (navy and corporations) inspect you when you open trade with them. It happens once every
<Stat kind="tuning" id="SCAN_COOLDOWN" /> turns at the same node. They search whether or not you carry anything.

1. <Stat kind="tuning" id="INSPECTORS" /> inspectors come over in a shuttle. If your airlocks are all taken, they float across to your hatch in suits.
2. They search every storage module, and every module with an upgrade fitted. They also look at what's close to them: loose
   items near them, and contraband that a crew member carries or wields when they're within a couple of tiles.
3. They haul what they find to their shuttle.
4. If the search is clean, they leave and trade opens at once.
5. If they found contraband, the lead inspector waits and an urgent alert appears: **Inspector waiting: fine or bribe**.

Trade waits for the search. Each module takes only a few seconds of work.

If the inspectors can't board for a long while, or their searches stall, an **Inspectors can't board** alert tells you. Free
an airlock or clear the way.

### Fine, bribe or refuse

The alert has three buttons. The log tells you what they found and what it's worth.

| Choice | What it costs | What happens |
|---|---|---|
| **Fine** | A fine of <Stat kind="tuning" id="SCAN_FINE_SHARE" percent /> of the goods' value (at least <Stat kind="tuning" id="SCAN_FINE_MIN" /> credits), and <Stat kind="tuning" id="SCAN_STANDING_HIT" /> standing with the faction. | They keep the goods. If you're short, they take all your credits. |
| **Bribe** | <Stat kind="tuning" id="SCAN_BRIBE_SHARE" percent /> of the goods' value (at least <Stat kind="tuning" id="SCAN_BRIBE_MIN" /> credits). | Usually works: the goods are handed back. If the inspector turns it down you pay nothing, lose <Stat kind="tuning" id="SCAN_STANDING_HIT" /> standing, and no bribe is offered again. |
| **Refuse** | Nothing now. | They leave with what they took. You lose <Stat kind="tuning" id="INSPECT_REFUSE_HIT" /> standing and the station won't deal with you for <Stat kind="tuning" id="INSPECT_BAN_TURNS" /> turns. |

A bribe is a gamble that costs more than the fine. It is taken <Stat kind="tuning" id="INSPECT_BRIBE_CHANCE" percent /> of the time. If you want to keep your
standing and the goods, you need luck. If you can't afford the credits, the button is refused.

Bribed goods are set down by the shuttle's door for your crew to stow. If your ship has no floor space for them, the
bribe is refused.

## Patrol hails and smuggling-risk scans

Patrols also scan ships they cross on the lane. A navy or corporate patrol whose scan flags you as a **smuggling risk**
stops your jump and hails you in the comms window. The scan doesn't say what it found.

| Choice | What happens |
|---|---|
| **Comply** | You drop out at the next node. The patrol holds there beside you and sends its inspectors over, as at a station. Fine, bribe or refuse, the same as above. |
| **Run** | The jump carries on. You lose <Stat kind="tuning" id="PATROL_RUN_HIT" /> standing with the patrol's faction. <Stat kind="tuning" id="PATROL_CHASE_CHANCE" percent /> of the time it gives chase for <Stat kind="tuning" id="PATROL_CHASE_TURNS" /> turns and hails you again if it catches up. |

A patrol only stops you when its scan flags contraband. A scan that finds nothing is just an acknowledgement.

## Refusing and fighting

**Refusing** costs more with a patrol than with a station, since a patrol has no service to cut off: you lose <Stat kind="tuning" id="INSPECT_PATROL_REFUSE_HIT" /> standing
and nothing else. Leaving the node during an inspection counts as refusing.

**Fighting** is worse. If you attack the inspectors, or fire on the ship that sent them, their faction turns hostile:

- You lose <Stat kind="tuning" id="INSPECT_FIGHT_HIT" /> standing with the faction.
- The inspectors become boarders and fight. They stay hostile if you jump, and come along with you if they're aboard.
- A patrol and its fleet open fire. A station's guns open fire, and the station bars you for <Stat kind="tuning" id="INSPECT_FIGHT_BAN_TURNS" /> turns, much longer than for a
  refusal.

To fight, draft a crew member and order them to attack an inspector. Jumping away with any still aboard counts
as a fight too. See [Combat](../combat/) and [Boarding](../boarding/).

## Black markets

Some pirate-held and lawless stations have a **black market**. About <Stat kind="tuning" id="LESSER_SHARE" percent /> of them do. The trade window shows a
**BLACK MARKET** chip on them, and hovering it tells you what they buy and at what rate.

- A black market buys contraband at a share of its value: <Stat kind="tuning" id="blackMarkets.bm.lesser.contrabandBuy" percent /> at the back-room dealers found in the galaxy.
- It stocks stolen goods, looted goods, disruptors and, rarely, nuclear warheads.
- It can hire out shady crew, who are better at their jobs but cost more and draw no wages.
- It keeps a **truce**. Nobody starts a fight there, and the enemy AI holds fire. The chip reads **TRUCE**.
- Firing on or boarding anyone there **breaks the truce**: for <Stat kind="tuning" id="BAN_TURNS" /> turns everyone there is hostile and fires on you, and
  every pirate faction thinks <Stat kind="tuning" id="BREACH_STANDING" /> points less of you. The chip then reads **TRUCE BROKEN**.

> **Tip:** if you carry contraband, sell it at a black market before you pass a navy or corporate station.

<ComingLater>

Larger named black markets, such as a cartel market, a machine bazaar with AI cores and robot parts, and a mercenary hiring
hall, exist in the game's data but don't appear in the galaxy yet.

</ComingLater>
