---
title: Mood, relationships and breaks
order: 3
---

<script lang="ts">
  import Stat from '../../../lib/Stat.svelte'
  import ComingLater from '../../../lib/ComingLater.svelte'
</script>

A crew that is fed, rested and among friends works well. A crew that is hungry, scared and sharing a ship with
someone they can't stand does not. This page covers what moves a crew member's mood, how friendships and rivalries
form, and what happens when someone breaks.

Only human crew on your side (and passengers living aboard) have moods. Robots do not, and neither do enemy crews.

## Mood

Mood is a number from 0 to 100. Everyone starts from <Stat kind="tuning" id="MOOD_BASE" />, and each thing going on in
their life adds or subtracts points. The total is shown on the Overview tab with a word:

| Mood | Word |
|---|---|
| Under 20 | Miserable |
| 20 to 34 | Unhappy |
| 35 to 64 | Content |
| 65 and up | Happy |

Open the **Status** tab for the full breakdown: the base, every factor with its points (and the trait behind it, if
any) and the total. It is the first place to look when someone is unhappy.

### What low mood costs

- Under <Stat kind="tuning" id="MOOD_LOW" />, work speed drops to <Stat kind="tuning" id="MOOD_LOW_WORK_MULT" /> times normal.
- Under <Stat kind="tuning" id="MOOD_VERY_LOW" />, it drops to <Stat kind="tuning" id="MOOD_VERY_LOW_WORK_MULT" /> times, and
  the ship's log notes it once.
- Under 35 their chance of a mental break starts to climb. The lower it goes, the worse (see "Mental breaks").

### What raises and lowers it

These factors are live in the game now. Points are before traits.

**Needs**

| Factor | Points |
|---|---|
| Well fed (hunger 85 and up) | +4 |
| Peckish (under 60) | -3 |
| Hungry (under 35) | -10 |
| Starving | -25 |
| Rested (85 and up) | +4 |
| Tired (under 30) | -8 |
| Exhausted (under 10) | -15 |

**Food and sleep** (these fade after a while: a meal for a few minutes, a sleep for about ten)

| Factor | Points |
|---|---|
| Hot ration at the galley | +<Stat kind="items" id="item.ration" field="food.mood.points" /> |
| Bland meal | +<Stat kind="items" id="item.meal_bland" field="food.mood.points" /> |
| Good meal | +<Stat kind="items" id="item.meal_good" field="food.mood.points" /> |
| Fine meal | +<Stat kind="items" id="item.meal_fine" field="food.mood.points" /> |
| Slept in a bed | -2 to +9, by the bedroom's quality (see "Room quality") |
| Slept on the floor | -6 |
| Ate in the mess | -3 to +4 on top of the meal, by the mess's quality |

Better cooks make better meals. See [Food](../food/).

**The room they stand in**

| Factor | Points |
|---|---|
| Dark room | -5 |
| Stale air | -8 |
| Thin air | -20 |
| Smoky room | -6 |
| Too hot or too cold | -6 |
| Surroundings: the room's quality | -3 to +3 |

**Company**

| Factor | Points |
|---|---|
| Company: another crew member within <Stat kind="tuning" id="MOOD_COMPANY_RADIUS" /> tiles | +3 |
| Lonely: nobody near for <Stat kind="tuning" id="MOOD_LONELY_SEC" unit="s" /> | -4 |

**Work and rest**

| Factor | Points |
|---|---|
| Enjoying the work: working at a skill they are keen on (+2) or passionate about (+4), for a minute after | +2 / +4 |
| Took a break: a crew member with nothing to do and a low mood walks to the mess or beside a crewmate and relaxes. It lifts mood for about five minutes | +<Stat kind="tuning" id="MOOD_RELAX_POINTS" /> |
| Played a game: a break at a game table or an arcade instead | +<Stat kind="tuning" id="MOOD_PLAY_POINTS" /> |
| No time off: no break for <Stat kind="tuning" id="NO_BREAK_SEC" unit="s" /> | <Stat kind="tuning" id="NO_BREAK_POINTS" /> |

A break's points shift by the room's quality, from -2 in a Grim room to +2 in an Impressive one.

Breaks only happen when nobody has a job for them, so they never pull anyone off work. In **Free** hours they happen
more (see [Crew](../crew/)).

**People** (see below): near a friend +<Stat kind="tuning" id="BOND_FRIEND_MOOD" />, near a rival
<Stat kind="tuning" id="BOND_RIVAL_MOOD" />, a good talk +<Stat kind="tuning" id="BOND_CHAT_MOOD" />, a row
<Stat kind="tuning" id="BOND_ROW_MOOD" />, grieving a dead friend -<Stat kind="tuning" id="BOND_GRIEF_MOOD" /> for a while.

**After a break**: "Let it out" gives <Stat kind="tuning" id="BREAK_LET_OUT_POINTS" /> points back for a few minutes after a mental break ends. Someone who made a
scene nearby costs "Made a scene" <Stat kind="tuning" id="BREAK_SCENE_MOOD" /> for <Stat kind="tuning" id="BREAK_SCENE_SEC" unit="s" />.

### Traits

Traits change how mood works for one crew member:

| Trait | Effect |
|---|---|
| Cheerful | +<Stat kind="tuning" id="traits.trait.cheerful.effects.mood" /> mood, and +<Stat kind="tuning" id="traits.trait.cheerful.effects.aura" /> mood to others nearby. Less likely to break. |
| Gloomy | <Stat kind="tuning" id="traits.trait.gloomy.effects.mood" /> mood, and <Stat kind="tuning" id="traits.trait.gloomy.effects.aura" /> to others nearby. More likely to break, and more likely to despair. |
| Social | Company +6 instead of +3, lonely -8 instead of -4 |
| Loner | Likes being alone (+3). Crowded (<Stat kind="tuning" id="MOOD_CROWD" /> or more crew near) -4. No lonely or company terms |
| Stoic | Every factor counts half |
| Sensitive | Every factor counts one and a half times |
| Thrill-seeker | +6 in combat or on a spacewalk, but bored (-3) after a long quiet stretch |
| Pacifist | +<Stat kind="tuning" id="traits.trait.pacifist.effects.peaceMood" /> whenever the ship isn't in a fight |
| Lazy | +<Stat kind="tuning" id="traits.trait.lazy.effects.mood" /> mood but more likely to refuse work |
| Small appetite / Glutton | Food factors count half / twice |
| Dark-adapted | Dark rooms don't bother them, but a bright room does (-3) |
| Battle-shy | <Stat kind="tuning" id="BATTLE_FEAR_MOOD" /> whenever a hostile is in sight |
| Protective | Grief hits one and a half times as hard |

### Room quality

Every room has a quality from 0 to 100, shown as a tier: **Grim**, **Bare**, **Decent**, **Pleasant** or **Impressive**.
Turn on the **Room quality** overlay to see it, coloured from red (Grim) to green (Impressive).

Three things set it, and the weakest one counts most:

- **Space**: floor tiles per user. Beds, consoles, workstations, galleys and game places each count as a user, so a
  crowded room scores low.
- **Cleanliness**: loose item stacks on the floor and bodies make a room dirty.
- **Condition**: damaged walls and modules pull it down, and a breach drops it to zero.

The tier changes how a bed sleeps, how a meal in the mess feels, a break's points, and the **Surroundings** factor for
whoever is in the room:

| Tier | Sleep | Mess meal | Surroundings | Break |
|---|---|---|---|---|
| Grim | -2 | -3 | -3 | -2 |
| Bare | +2 | -1 | -1 | -1 |
| Decent | +5 | 0 | 0 | 0 |
| Pleasant | +7 | +2 | +2 | +1 |
| Impressive | +9 | +4 | +3 | +2 |

### Breaks and games

A crew member on a break goes to the mess, a **game table** (two players at once, seated) or an **arcade** (one player,
standing), whichever suits them best. A game is worth more than a rest in the mess. Social crew lean towards the mess and
the table, Loners towards the arcade. A game must be powered and working; if it loses power mid-break, the break ends and
doesn't count.

Build both from the **Life** tab. Each needs its play tiles clear (the arcade's front, the table's two stools), as with any
module's access tile.

### Furniture with no mood effect

These are all built from the **Life** tab and change no mood yet:

- **Bench:** three seats. Idle crew with nothing to do sit down on one now and then and get up after a few minutes; any job
  calls them off it. Sitting is only for show: it is not a break and lifts no mood. Crew can walk across a bench like a bed.
- **Bunk bed:** a bed with a lower and an upper deck. One crew member sleeps in it, like a bed.
- **Sparring droid, planter and vending machines (two liveries):** decoration. The vending machines draw 1 power.

<ComingLater>

Comfort. Furniture and decor will add a fourth input to room quality. Until then no room rises above Decent.

</ComingLater>

## Relationships

Crew who spend time together form opinions of each other. Each opinion is a score from -100 to 100 that each side
holds separately, so one crew member can like another who doesn't like them back ("one-sided").

- At <Stat kind="tuning" id="BOND_FRIEND" /> or more, they count as **friends**.
- At minus <Stat kind="tuning" id="BOND_FRIEND" /> or less, they are **rivals**.
- A label sticks until the score drifts back under <Stat kind="tuning" id="BOND_KEEP" />.
- Each crew member can have at most <Stat kind="tuning" id="BOND_MAX_FRIENDS" /> friends and
  <Stat kind="tuning" id="BOND_MAX_RIVALS" /> rivals. A new bond that would be one too many only forms if it is
  stronger than the weakest one, which then falls back to just under the line.

A new friend or rival is noted in the ship's log, once per pair.

### How they form

How well two people get on is fixed per pair, a bit like chemistry. Two Social crew get on better; a Hot-headed one
makes it harder. Then play does the rest:

| What happens | Effect on the score |
|---|---|
| Spending time near each other | A slow trickle, up or down with chemistry |
| Working side by side | A faster trickle |
| A chat (in free time, at a meal or on a break) | A good talk gains, an awkward one loses |
| Fighting side by side | A big gain, once per fight (a small one for people who clash) |
| Being downed beside a fighter | A gain |
| Being carried to safety | A big gain for the one carried, a smaller one for the carrier |
| Seeing a crewmate die together | A gain between the witnesses |
| A shouting match between rivals | A loss |
| Someone's tantrum, heard by the others | A small loss for everyone near |
| Getting on each other's nerves when either is in a bad mood | A small loss |

A bond that nothing refreshes slowly fades toward nothing.

Three traits change the speed: **Peacemaker** gains friends faster and halves the sting of rivals nearby,
**Hot-headed** makes rivalries come quickly, and **Protective** bonds faster in danger. Expect a first friend or
rival after an hour or two of play together.

### What bonds do

**Friends**

- +<Stat kind="tuning" id="BOND_FRIEND_MOOD" /> mood while one is near.
- Work is <Stat kind="tuning" id="BOND_FRIEND_WORK_MULT" /> times as fast beside a friend who is working too.
- They choose to eat, take breaks and sleep near each other.
- A shared loss is shared grief.

**Rivals**

- <Stat kind="tuning" id="BOND_RIVAL_MOOD" /> mood while one is near.
- They keep apart at meals, breaks and bed.
- Unhappy rivals who meet sometimes have a **shouting match**: a scene, a mood hit for both and a log line. Nobody is
  hurt. Hot-headed crew start them far more often.
- They never chat.

Chats start between two idle, relaxed crew within a few tiles of each other. You'll see a speech bubble over their
heads, a scribble when it goes badly and a red burst in a shouting match.

### Grief

When a friend dies, everyone who counted them a friend grieves. They take
<Stat kind="tuning" id="BOND_GRIEF_MOOD" /> mood for <Stat kind="tuning" id="BOND_GRIEF_SEC" unit="s" />, one and a half times that if Protective. Grief is also
a trigger for a mental break (despair is the usual one). Keeping your crew alive is the best morale policy.

### The Social tab

Select a crew member and open **Social** in the inspector. It has three foldable groups: **Friends**, **Rivals** and
**Crew** (everyone else), with the count against the cap for the first two. Each row shows a portrait, a name, whether
the bond is mutual or one-sided, and two thin bars for how each side feels (green to the right, red to the left).

Click a row to open its card:

- **How each feels**, as a pair of bars.
- **History**: what happened and when (good talks, fought together, carried to safety, a shouting match), with where.
- **Effects**: the mood and work numbers above.
- **What they do together**: eat, break and sleep together or apart.

A line at the foot totals the mood coming from people nearby right now. The Overview tab also lists friends and rivals by
name, and hovering one shows what the bond is.

## Mental breaks

A crew member who is stressed enough can snap. A break takes them out of their normal routine for a few seconds to
a few minutes. Every break is noted in the ship's log, with the crew member's name and what set it off.

### What sets one off

Two things push the chance up. Each check, there is a small chance of a break; the check runs every few seconds per
crew member.

1. **Low mood.** From mood <Stat kind="tuning" id="BREAK_BASE_BELOW" /> there is a small chance, higher under <Stat kind="tuning" id="BREAK_BASE_LOWER" /> and highest under <Stat kind="tuning" id="MOOD_BREAKDOWN_BELOW" />. A stressed mood is the
   steady cause of breaks that come from nowhere.
2. **Acute stress.** Each of these adds its own chance while it is happening:

| Stress | When |
|---|---|
| Fire | A fire burns within <Stat kind="tuning" id="BREAK_FIRE_RADIUS" /> tiles |
| Combat | A hostile has been in sight for <Stat kind="tuning" id="BREAK_COMBAT_SEC" unit="s" /> |
| Decompression | In a suit in a breached room, or with the suit tank low and no air |
| Blackout | In the dark, without a suit lamp, for <Stat kind="tuning" id="BREAK_DARK_SEC" unit="s" /> |
| Exhaustion | Rest nearly gone, or starving |
| Grief | A friend has died recently |

Stress counts for more when mood is low, and for less when it is high. After a break ends, that crew member can't break
again for <Stat kind="tuning" id="BREAK_COOLDOWN_SEC" /> seconds, and not from the same cause for <Stat kind="tuning" id="BREAK_CONTEXT_COOLDOWN_SEC" unit="s" />.

The Overview tab says "strained" and the Status tab names the cause when someone is under stress that can set off a
break at any mood. A calm-looking crew member in a dark corridor can still snap.

Traits tilt the odds: Brave never panics, freezes or hides; Coward does all three more; Stoic and Cheerful make every
break less likely, Sensitive and Gloomy more; Battle-shy gets scared of fighting sooner.

### The seven kinds

| Break | What they do | How long |
|---|---|---|
| **Panic** | Run from the cause (the fire, the enemy), then cower | up to a minute |
| **Freeze** | Stand still | a few seconds |
| **Hide** | Walk out of every hostile's sight and stay there | up to a minute |
| **Tantrum** | Stand and sulk. Everyone near gets "Made a scene", and thinks a little less of them | about a minute |
| **Despair** | Walk to their own bed if near, and lie there. They get up to eat if they starve | several minutes |
| **Refusal** | Refuse all work. They still eat and sleep | a few minutes |
| **Isolation** | Want to be alone: no work, and they go to the quietest room | a couple of minutes |

Which kind depends on the cause. Fire and decompression mostly give panic; combat gives freeze, hide or panic; grief
gives despair; low mood gives refusal, tantrums, isolation or despair.

A break ends early when its cause is gone for <Stat kind="tuning" id="BREAK_GONE_SEC" unit="s" />. Ending one is a relief (**Let it out**).

Severe breaks (panic, and freeze in combat) take over completely, even from a drafted crew member. The rest let go if you
draft the crew member. Drafted crew are also steadier overall and can only have the severe kinds.

A break pauses while something worse is happening: a crew member who runs short of air or starves sees to that first, then the break resumes.

### Alerts and orders

- A panic, or a freeze in combat, raises an **urgent alert** (click it to jump to them). They are throttled: one per
  crew member every <Stat kind="tuning" id="BREAK_ALERT_SEC" unit="s" />, and a second severe break on the same ship within <Stat kind="tuning" id="BREAK_ALERT_SHIP_SEC" unit="s" /> goes to the log only.
- Everything else is a log line only.
- The crew bar and Overview tab show the crew member as "Panicking", "In despair", "Refusing work" and so on, and
  the Status tab's Conditions line counts down what is left.
- While a crew member is in a break, orders that would give them a job or move them are refused: "That crew member is
  in a mental break". That covers move, attack, man a console, hack, force a door, sabotage, suit up and board a shuttle.
  Drafting them still works.

## Keeping a crew stable

- **Feed them well.** Keep rations and meals stocked, and run the galley. A cook with skill makes meals worth up to
  +13 mood. See [Food](../food/).
- **Let them sleep in beds.** One bed per crew member is best: a night on the floor is -6, in a Decent bedroom +5.
- **Keep rooms roomy, tidy and repaired.** A crowded, cluttered or damaged room drops a tier and costs mood in it.
- **Give them somewhere to unwind.** A game table or arcade beats the mess, and crew who never get a break lose mood.
- **Keep the air, light and temperature normal.** Dark, smoky, thin or hot rooms all hurt. Dark rooms often come from
  a power shortage: see [Power](../power/).
- **Put out fires and fix breaches quickly.** Both are mood hits and break triggers.
- **Plan time off.** Free hours let crew eat early, take breaks and chat. A crew on Work all day gets tired, and tired is
  -8. See [Crew](../crew/).
- **Put people with what they like.** Crew enjoying a skill they are keen on feel better doing it.
- **Mix the personalities.** A Cheerful crew member lifts everyone near them; a Gloomy one drags them down. A
  Peacemaker calms rivals. Keep a rival pair away from each other if you can: on different shifts or in different parts
  of the ship.
- **Look after friends.** Losing one is -15 and often a break. Keep friends away from the worst fighting, or accept it.
- **Don't leave a crew member alone for long** unless they are a Loner.
- **Watch the Status tab** when someone is unhappy. It shows exactly which factor to fix.
- **Trouble starts small.** A Tired and Hungry crew member is -18 before anything else happens. Fix the base first.
