---
title: Crew
order: 2
---

<script lang="ts">
  import Stat from '../../../lib/Stat.svelte'
  import ComingLater from '../../../lib/ComingLater.svelte'
  import GamePanel from '../../../lib/GamePanel.svelte'
  import SchedulePane from '../../../../../src/ui/SchedulePane.svelte'
  import { panelOf, apiOf } from '../../../lib/panels'
  import scheduleJson from '../../../data/generated/panels/schedule.json'
  const schedulePanel = panelOf('schedule', scheduleJson)
</script>

Your crew do the work: they fly, shoot, build, cook, heal and fight. They also eat, sleep, get tired, get hurt and
fall out. Most of the time they run themselves. You set who does what, when they rest, and step in by hand when you
need to.

For moods, friendships and breakdowns, see [Mood, relationships and breaks](../mood/).

## Who they are

Every crew member rolls two backgrounds when they are made:

- An **upbringing**: where they grew up (station brat, belt-born, colony farmer, factory district, navy family,
  core-world academy, frontier settler, monastery ward, gang runner). It adds a few skill points.
- A **career**: what they did before signing on (salvage diver, dock mechanic, factory hand, hydroponics tech, navy
  gunner, freight pilot, field medic, lab tech, galley cook, bouncer, systems tech, data broker, mercenary). It adds
  more skill points, usually in one main skill. A **drifter** has no trade and lands their points on random skills.

Some pairs are more likely than others: a belt-born crew member often turns out a salvage diver or freight pilot, a
core-world academy graduate a lab tech. On top of that come a little random noise, a few traits, and up to two
interests (below).

Their **title** only follows their best skill: Gunner, Pilot, Engineer, Security, Hacker, Medic, Scientist, Cook,
Botanist or Machinist, or just "Hand" if nothing is above 2. A title changes nothing about what they can do. Skills
and priorities do.

Humans are the only crew with moods and needs. Robots never sleep or eat; they recharge in a robot bay. See
[Drones and robots](../drones/).

### New crew screen

When you start a game you roll your crew. Each berth shows a portrait, background and top skills. Lock the ones you
like and press **Reroll** for the rest. Beside the roster, **Ship's jobs** lists what the ship needs (helm, weapons,
shields, repair, medic, cook, boarders, science, farming, industry, depending on its modules) and the best crew
member you have for each. A job that no one covers well is marked as weak.

## Skills

Skills run from 0 to 10. The more of a skill, the better a crew member does that work. Crew on your side get better
with use (see "Learning" below).

| Skill | What it does |
|---|---|
| Gunnery | Manning a weapons console: tighter aim, so more shots land. Also the skill for hand-held guns. |
| Piloting | Flying from the helm: the engines give more evasion, in a fight and between fights. |
| Shielding | Manning the shield console: shields recharge faster. |
| Melee | Fighting hand to hand. |
| Construction | Building, repairing, deconstructing, salvaging, putting out fires and forcing doors. Work goes faster the higher it is. |
| Hacking | Hacking robots and AI cores. Some hacks need at least level <Stat kind="tuning" id="HACK_MIN_SKILL" />. |
| Medicine | Patching up the wounded: a patient in a medical bed heals faster while a medic with this skill tends them. |
| Science | Research: the active project advances faster. |
| Cooking | Meal quality. A better cook turns the same ingredients into better meals. |
| Botany | Sowing and harvesting hydroponics beds faster. |
| Industry | Refining and crafting: refinery, fabricator and workbench jobs go faster. |

Where a skill speeds something up, each level adds <Stat kind="tuning" id="SKILL_STEP" /> to a multiplier of 1. Level 10
means 1.5 times as fast.

Anyone with high enough Gunnery or Melee goes looking for boarders on their own; everyone else waits for orders. See
[Boarding](../boarding/).

### Interests

Each crew member can be **keen** (one mark) or **passionate** (two marks) about a skill. The Skills tab shows the
marks next to the skill.

- They learn that skill faster: 1.5 times as fast when keen, twice as fast when passionate.
- Doing that work makes them happier for a while ("Enjoying the work").
- Their default priorities lean toward it.

### Work they refuse

A few crew will not do some kinds of work, for good: **Won't fight**, **Won't do medical work**, **Won't haul** or
**Won't cook**. It comes from their background and is rare. The Skills tab says so, and the lock icon appears in
their row of the priorities grid, with the reason on hover. Put them on something else.

A crew member who won't fight also carries no sidearm. Everyone else carries one, and picks up a better weapon from
storage when they can.

### Learning

Crew gain skill by doing the work: building trains Construction, a console trains its own skill, healing trains
Medicine, and so on. Each level costs more than the last, and practice never takes a skill past 10. Hauling and rescuing train nothing.

## The crew inspector

Click a crew member (in the world or on the crew bar) to open the inspector. It has five tabs.

| Tab | What you see |
|---|---|
| **Overview** | Portrait, then health, mood, hunger and rest bars, what they are doing right now, their weapon, friends and rivals, traits, and the order buttons: **Draft** and **Priorities**. |
| **Status** | Health and the needs in detail, a **Conditions** line (downed, surrendered, in a mental break with the time left), and the full **Mood** breakdown: the base, each factor with the trait behind it, and the total. |
| **Skills** | Background and career, all eleven skills as ten pips with keen/passionate marks, won't-do lines, traits, and other stats (hover for the base value and what changed it). |
| **Gear** | A paper doll of what they wear and carry. |
| **Social** | Friends, rivals and the rest of the crew, with how each side feels. See [Mood, relationships and breaks](../mood/). |

Passengers and hostiles show the Overview only. Press **Esc** or click an empty part of the world to close the
inspector.

## Work priorities

The **Crew** button in the left strip opens the Crew window. Its **Priorities** tab is a grid of crew against work
columns. A cell is a number from 1 (do this first) to 4, or blank for off. Click a cell to step it 1, 2, 3, 4, off,
and back to 1. A dotted outline marks a cell you changed from its default. **Reset** on a row puts the defaults back.

| Column | Work |
|---|---|
| Dmg | Damage control: put out fires, seal hull breaches |
| Med | Rescue the downed and treat patients in beds |
| Ops | Man consoles: helm, weapons, shields |
| Fix | Repair damaged modules |
| Build | Build and deconstruct modules and walls |
| Haul | Carry items to where they are needed |
| Refine | Turn raw ore into materials at the refinery |
| Craft | Make items at the fabricator or workbench |
| Sci | Work the active research project |
| Cook | Make meals at the galley |
| Farm | Sow and harvest hydroponics beds |

A crew member takes the open job in their best column first, then the next. Within a column the nearest crew member
usually gets it. A job with a 1 always goes before a job with a 3, wherever it is.

**Default priorities** come from skills and interests: a skill of 6 or more, or a passionate interest with at least
3, starts at 1; a skill of 4 or 5 (or a keen interest with at least 2) starts at 2; a skill of 2 or 3 starts at 3; below that, 4. Damage control starts at 1
for everyone, hauling at 3. Work they refuse starts off and cannot be turned on.

> **Tip:** consoles are a special case. Outside a fight, a crew member only staffs a console if their Ops number is <Stat kind="tuning" id="OPERATE_MAX_LEVEL" />
> or better. In a fight, any idle crew relieve an empty console that has stood empty a while, unless you turned Ops
> off.

## The ship clock and schedules

The ship runs a 24-hour day. One game hour is <Stat kind="tuning" id="GAME_HOUR_SEC" /> seconds at normal speed, so a
day is 16 minutes. A new game starts at <Stat kind="tuning" id="CLOCK_START_HOUR" />:00. The clock is in the top bar,
with a strip under it: one block per hour, showing how many crew are on Work then. A red block means nobody is on
Work that hour, amber means one person.

Each crew member has a plan of 24 hourly blocks:

| Block | What they do |
|---|---|
| **Work** | Take jobs. They still eat when hungry and sleep when worn out. No breaks. |
| **Sleep** | Go to bed (eating first if hungry) and sleep the block through. No jobs. |
| **Free** | No jobs. They take breaks in the mess or beside a crewmate, and eat early so nobody goes to bed hungry. |
| **Any** | No plan: needs decide, as in the old days. Work, sleep when tired, eat when hungry, a break when mood is low and nothing is left to do. |

### Editing schedules

Open the **Crew** window and pick the **Schedule** tab.

<GamePanel title="Crew: Schedule" width="760px" caption="The Schedule tab with the starting crew on the Default and Late plans. The outlined column is the current hour.">
  <SchedulePane api={apiOf({ snapshot: schedulePanel.snapshot })} crew={schedulePanel.crew} />
</GamePanel>

- Each row is a crew member, each cell an hour. The current hour is outlined.
- Pick a **brush** (**Any**, **Work**, **Sleep**, **Free**, keys 1 to 4 while the pane has focus) and drag across hours
  to paint. Right-drag paints Any.
- The **preset** menu on a row applies a ready-made plan. A row that matches none shows **Custom**.
- **Copy** and **Paste** on a row copy one crew member's plan to another.
- Click names to select a row, shift-click to select several; presets, paste and painting then apply to every
  selected row.
- The **On work** row at the bottom counts how many crew are on Work each hour. Red means nobody.

| Preset | Plan |
|---|---|
| Default | Work 06:00 to 20:00, Free 20:00 to 22:00, Sleep 22:00 to 06:00 |
| Late | Sleep 06:00 to 14:00 (the Default eight hours later), Work 14:00 to 18:00, Free 18:00 to 20:00, Work 20:00 to 06:00 |
| Day shift | Work 06:00 to 18:00, Free 18:00 to 22:00, Sleep 22:00 to 06:00 |
| Night shift | Work 18:00 to 06:00, Free 06:00 to 10:00, Sleep 10:00 to 18:00 |
| Any | No plan |

Crew you haven't given a schedule alternate between **Default** and **Late** in hire order. Their sleep never overlaps,
so someone is always awake and, at every hour, someone is on Work. Everyone is up from 14:00 to 22:00. Give a crew member their own plan and they leave
the rotation.

### When the plan is set aside

The schedule gives way, and every hour counts as Work, while a crew member is **on call**:

- during a fight or battle stations;
- while holding a console or an emergency job;
- while a fire, hull breach or downed crew member is open on their ship in a kind of work they do (the whole ship
  turns out for it, taken or not);
- while a console is empty that they would man.

A scheduled sleeper wakes for that. Someone asleep because they were worn out sleeps on. A critical need, such as
air or starving, wakes anyone. A sleeper who isn't rested when Sleep ends sleeps on into Work until rested. Into
Free they get up once they are at least half rested.

Away parties on a wreck work until their Sleep hours, then take the shuttle home. In Free time they keep working if
the shuttle is away, and head back aboard when it is beside the site. See [Salvage](../salvage/).

## Needs

| Need | How it works |
|---|---|
| **Food** | Hunger falls steadily, half as fast in bed. Below about a third they go to the galley or a crate and eat. At zero they lose health slowly and an alert fires. Drafted crew never stop to eat. See [Food](../food/). |
| **Sleep** | Rest drains while awake. They sleep when it runs low, or by schedule. A bed restores it twice as fast as the floor, and a night in a bed leaves them rested. Exhausted crew on the floor sleep poorly and feel it in their mood. |
| **Air** | Crew need breathable air. In thin or stale air they lose mood, and in bad enough air they lose health. A suit has its own tank, and a suited crew member goes to refill it before it runs dry. They also leave tiles that will hurt them: fire, bad air, extreme heat or cold. See [Power](../power/) for life support. |

Each of these comes first before ordinary jobs when it is bad enough. A crew member stuck with no food or no air
source keeps trying.

## Injuries and downed crew

Hits, fire, bad air and cold wear health down. Crew regain a little health slowly when safe. At zero health they die.

Before that, a badly hurt crew member is **downed**. They fall, can't act, and **bleed out in
<Stat kind="tuning" id="BLEED_OUT_SECONDS" /> seconds** unless a crewmate carries them to a bed. A free bed is needed;
an alert fires when someone goes down. Crew with the Med column on handle it themselves. In a bed the bleeding stops
("Downed, stable"), they heal, and get up again at <Stat kind="tuning" id="GET_UP_HP" /> health. A medical bed with
medicinal herbs in the stores heals faster. Medic drones also stop
bleeding. See [Drones and robots](../drones/).

### Medical beds and the recovery pod

A crew member who is hurt but on their feet (under 70% health) walks to a **medical bed** when one is free, lies in it
and heals to full health, out of action meanwhile. A **recovery pod** is the same idea for a powered, bigger bed: it
heals <Stat kind="tuning" id="POD_HEAL_PER_SEC" /> health a second with no medic needed, and the patient floats in the
tank. Walking patients take a medical bed first and the pod only when no medical bed is free; the downed (critical)
take a pod first, then a medical bed. A downed crew member carried to a pod is stabilised, heals, and stays in until
they are at full health instead of getting up at <Stat kind="tuning" id="GET_UP_HP" />. A pod needs power: without it
a walking patient is let out and a downed one stops healing (and stops bleeding). One patient per bed; medicinal herbs
in the stores speed up either. Build the pod from the **Life** tab.

A medical bed with a patient in it gets a **tend** job (Med column): a medic walks to the bed and stands beside it, and
while they do, the patient heals faster by the medic's Medicine skill and the medic earns Medicine XP for it. If the medic
is called away the job waits for the next free medic. Crew who won't do medical work never tend. Ordinary beds and the
pod have no such bonus: the pod needs no medic at all.

> **Tip:** keep a bed free for the downed. Without one, the rescue job never starts.

## Drafting and orders

**Draft** (press **R**, or the Draft button on the inspector or crew bar) puts a crew member under your control. They
drop their job and stop taking new ones.

- Right-click a tile to walk there.
- Right-click a hostile to attack.
- Right-click a console to man it.
- Right-click a shuttle to board it.
- Drag a box to select several; they spread out around the tile.
- **Fire at will** on the inspector turns on or off shooting without orders.

A drafted crew member still steps off a harmful tile on their own. Press R again (or **Stand down** on the crew bar) to
give them back to the auto jobs. A severe mental break beats a draft.

**Battle stations** (**C**, or the crew bar button) calls crew to the consoles and holds every weapon, without
drafting anyone. See [Combat](../combat/).

Orders that give someone a job or move them are refused for a crew member in a mental break: the message reads "That
crew member is in a mental break". See [Mood, relationships and breaks](../mood/).

## Recruiting

Trade stations have people looking for a berth. Hail a trade station and pick **Crew** among its services. It lists up
to <Stat kind="tuning" id="RECRUIT_SLOTS" /> candidates at a time with their role, skills and price. **Hire** sends your shuttle to fetch them, the fee is
held until they step aboard and returned if the run fails. You need a shuttle, a free working airlock to dock at, and
enough credits. Candidates change as you travel.

Black markets also offer **shady** crew with better skills, and a one-time fee.

A passenger you carry may ask to join the crew if they are happy enough with the trip. The ask shows as an urgent alert;
say yes and they become crew with their own skills.

<ComingLater>

Implants that add stat bonuses with a cost, and personal gear that crew make and repair at the workbench.

</ComingLater>
