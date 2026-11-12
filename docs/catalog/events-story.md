# Catalog: events, story, goals and lessons

Random and triggered encounters, the shared scene rules that react to what the player does, the three-act goal chain and the coach-mark lessons.
Events are drawn on a transit (`storySystem`, last in the pipeline) and may open a **scene**, a physical pocket of space (`sim/scene`, `sim/galaxy/eventGrid.ts`)
that plays out on a real grid. Planned: authored story arcs and job chains (issue #383), in-node events (#300), danger bands with things only found there (#382).

## Events (`content.events`, 11)
| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Distress call | `event.distress_call` | Crippled freighter on a clock; help over the hail, boarders may be on it | In game | src/content/events.ts:16; sim/story/*, sim/systems/story.ts; scenario freighter |
| A skiff on the lane | `event.trader_swap` | Passing trader offers a swap | In game | src/content/events.ts:74; sim/story/*, sim/systems/story.ts |
| Derelict sighted | `event.derelict_sighting` | A wreck to scan, hack or board (needs a shuttle for EVA) | In game | src/content/events.ts:105; sim/story/*, sim/systems/story.ts |
| Pirate scout surrenders | `event.pirate_captive` | A captured scout; spare or not | In game | src/content/events.ts:130; sim/story/*, sim/systems/story.ts |
| The pirate you spared | `event.pirate_returns` | Follow-up after sparing one (flag-triggered, 240 s delay) | In game | src/content/events.ts:148; sim/story/*, sim/systems/story.ts |
| Maintenance terminal | `event.rogue_terminal` | Rogue machine terminal; robots can interface directly | In game | src/content/events.ts:217; sim/story/*, sim/systems/story.ts; rogue faction itself is off (#427), the event is not |
| Meridian checkpoint | `event.corp_checkpoint` | Corporate inspection; clearance by reputation | In game | src/content/events.ts:230; sim/story/*, sim/systems/story.ts |
| Pod beacon | `event.medical_emergency` | Escape pod with a patient; needs a bed aboard | In game | src/content/events.ts:248; sim/story/*, sim/systems/story.ts; scenario medpod |
| Comet pass | `event.notice_comet` | Flavour notice | In game | src/content/events.ts:271; sim/story/*, sim/systems/story.ts |
| Radio chatter | `event.notice_chatter` | Flavour notice | In game | src/content/events.ts:279; sim/story/*, sim/systems/story.ts |
| Faint beacon | `event.notice_beacon` | Flavour notice | In game | src/content/events.ts:288; sim/story/*, sim/systems/story.ts |

## Scene rules (`content.sceneRules`, 16)

Shared observer rules (`sim/scene/observer.ts`): the world reacts the same way to the same action anywhere. All **In game**, `src/content/sceneRules.ts`: traded, attacked, boarded, captured, fled, destroyed, salvaged, cleared, derelictLeft, crewLost, helped, abandoned, helpedPerson, personDied, personDelivered, doomed.

## Goals (tutorial chain, 3 acts, 12 goals)

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| First jump | `goal.first_jump` | Open the starmap and jump to another node. | In game | src/content/goals.ts:13; sim/story/goals.ts; ui/GoalsCard.svelte |
| Open for business | `goal.first_trade` | Buy or sell anything with a trader. | In game | src/content/goals.ts:14; sim/story/goals.ts; ui/GoalsCard.svelte |
| Take a contract | `goal.take_job` | Accept a job from a station board. | In game | src/content/goals.ts:15; sim/story/goals.ts; ui/GoalsCard.svelte |
| Deliver | `goal.finish_job` | Complete any job. | In game | src/content/goals.ts:16; sim/story/goals.ts; ui/GoalsCard.svelte |
| Topped up | `goal.buy_fuel` | Buy fuel from a trader. | In game | src/content/goals.ts:24; sim/story/goals.ts; ui/GoalsCard.svelte |
| Shipwright | `goal.build` | Have your crew build a module. | In game | src/content/goals.ts:25; sim/story/goals.ts; ui/GoalsCard.svelte |
| Prospector | `goal.prospect` | Bring home ore from an asteroid, or salvage a wreck. | In game | src/content/goals.ts:26; sim/story/goals.ts; ui/GoalsCard.svelte |
| Patch her up | `goal.repair` | Repair a damaged module. | In game | src/content/goals.ts:27; sim/story/goals.ts; ui/GoalsCard.svelte |
| Blooded | `goal.blooded` | Destroy or capture a hostile ship. | In game | src/content/goals.ts:35; sim/story/goals.ts; ui/GoalsCard.svelte |
| Bounty hunter | `goal.bounty` | Complete a bounty job. | In game | src/content/goals.ts:36; sim/story/goals.ts; ui/GoalsCard.svelte |
| New blood | `goal.hire` | Hire a crew member at a trading hub. | In game | src/content/goals.ts:37; sim/story/goals.ts; ui/GoalsCard.svelte |
| Out of the cradle | `goal.leave_home` | Reach a cluster beyond the one you started in. | In game | src/content/goals.ts:38; sim/story/goals.ts; ui/GoalsCard.svelte |

## Lessons (coach marks)

The lesson engine (`src/ui/lessons`) supports many; only two are written.

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Combat lesson | `lesson.combat` | Coach marks for the first fight | In game | src/ui/lessons/defs/combat.ts |
| Hail lesson | `lesson.hail` | Teaches the comms hail window | In game | src/ui/lessons/defs/hail.ts |
| Other lessons (building, crew, trade, starmap, research...) | `-` | No lesson exists for any other system | Planned | LESSONS in src/ui/lessons/defs/index.ts is [combat, hail]; instructor portraits are issue #212 |

## Story systems

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Story engine | `storySystem` | Draws events, due chains, flags, reputation, notices | In game | sim/story/engine.ts, effects.ts, requirements.ts |
| Scenes | `sceneSystem` | Open pocket scenes with timers, aid agreements, observers | In game | sim/scene/*; sim/systems/scene.ts |
| Story arcs and job chains | `-` | Authored and templated arcs | Planned | issue #383 |
| In-node events | `-` | Location-driven hazards and arrivals | Planned | issue #300 |
| Danger bands | `-` | Core, frontier, deep space with unique finds | Planned | issue #382; `danger` tiers already exist |
| Core loop progression | `-` | First-hour goals, progression track, stakes | Planned | issues #52, #162; docs/PROGRESSION_PLAN.md |
