# Catalog: crew

Species, roles, skills, backgrounds, traits and the crew-behaviour systems (needs, mood, breaks, bonds, schedules, AI drives).
Human crew are the only species with needs and mood; robots recharge; aliens are wild creatures with no jobs.
Traits and backgrounds are rolled by `src/sim/crew/backgroundRoll.ts` and `roll.ts`. See also `docs/TRAITS.md` and `docs/CREW_AI.md`.

## Species
| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Human | `species.human` | Base human body: sleeps, eats, has mood | In game | src/content/species.ts:49; all player and civilian crew |
| Augmented human | `species.augmented` | Tougher, fearless human body (zealot crews) | Partial: stand-in | src/content/species.ts:52; only zealot roles; real implants are phase 7, issue #311 |
| Robot | `species.robot` | Robot body: no sleep, recharges in a robot bay, repairs with parts | In game | src/content/species.ts:54; rogue shipyard, robot fabricator output |
| Heavy robot | `species.robot_heavy` | Armoured security chassis | In game | src/content/species.ts:56; role.robot_security; robot fabricator |
| Hunter | `species.alien_hunter` | Fast melee swarm alien | In game | src/content/species.ts:69; hatches from egg sacs on derelicts (sim/systems/eggSacs.ts) |
| Brute | `species.alien_brute` | Slow tank alien with knockdown | In game | src/content/species.ts:77; egg sacs; content/creatures.ts |
| Spitter | `species.alien_spitter` | Ranged alien that keeps its distance | In game | src/content/species.ts:87; egg sacs; content/creatures.ts |

## Roles

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Crew | `role.crew` | Generic crew member (base kind recruits roll from) | In game | src/content/roles.ts:8 |
| Engineer | `role.engineer` | Repairs, builds, hauls, runs the reactor | In game | src/content/roles.ts:12 |
| Gunner | `role.gunner` | Runs weapons consoles | In game | src/content/roles.ts:18 |
| Medic | `role.medic` | Treats patients in med beds | In game | src/content/roles.ts:23 |
| Security | `role.security` | Boarding defence, armed from lockers | In game | src/content/roles.ts:29 |
| Pilot | `role.pilot` | Flies the helm and shuttles | In game | src/content/roles.ts:37 |
| Scientist | `role.scientist` | Works research benches | In game | src/content/roles.ts:43; recruit offers (sim/galaxy/tuningRecruit.ts), research |
| Worker bot | `role.robot_worker` | Robot general worker | In game | src/content/roles.ts:50 |
| Security bot | `role.robot_security` | Armoured robot guard | In game | src/content/roles.ts:57 |
| Repair bot | `role.robot_repair` | Hover repair bot | In game | src/content/roles.ts:66; render/robotBayArt.ts |
| Hunter | `role.alien_hunter` | Creature role, no work | In game | src/content/roles.ts:74 |
| Brute | `role.alien_brute` | Creature role, no work | In game | src/content/roles.ts:75 |
| Spitter | `role.alien_spitter` | Creature role, no work | In game | src/content/roles.ts:76 |
| Zealot pilot | `role.zealot_pilot` | Zealot-ship pilot (augmented body) | In game | src/content/roles.ts:84; faction.zealot crews (content/factions/pirates.ts:136) |
| Zealot gunner | `role.zealot_gunner` | Zealot gunner | In game | src/content/roles.ts:85; faction.zealot crews (content/factions/pirates.ts:136) |
| Zealot guard | `role.zealot_guard` | Zealot guard | In game | src/content/roles.ts:86; faction.zealot crews (content/factions/pirates.ts:136) |
| Zealot engineer | `role.zealot_engineer` | Zealot engineer | In game | src/content/roles.ts:87; faction.zealot crews (content/factions/pirates.ts:136) |

## Skills

11 skills (`src/sim/crew/skillList.ts`): gunnery, piloting, shielding, melee, construction, hacking, medicine, science, cooking, botany, industry. All are rolled, trained by use (`crew/xp.ts`) and read by a work category or combat system. Status: **In game**.

## Backgrounds

A person rolls one upbringing and one career (`crew/backgroundRoll.ts`). All 23 are **In game** (rolled for recruits and generated crew); they give skills, interests, trait weights and rare won't-do.

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Station brat | `upbringing.station_brat` | Upbringing: grew up in a dockside hab | In game | src/content/backgrounds.ts:8; sim/crew/backgroundRoll.ts |
| Belt-born | `upbringing.belt_born` | Upbringing: grew up on a mining rock | In game | src/content/backgrounds.ts:12; sim/crew/backgroundRoll.ts |
| Colony farmer | `upbringing.colony_farmer` | Upbringing: grew up on a farm colony | In game | src/content/backgrounds.ts:16; sim/crew/backgroundRoll.ts |
| Factory district | `upbringing.factory_district` | Upbringing: grew up between the smelters | In game | src/content/backgrounds.ts:20; sim/crew/backgroundRoll.ts |
| Navy family | `upbringing.navy_family` | Upbringing: grew up on a navy base | In game | src/content/backgrounds.ts:24; sim/crew/backgroundRoll.ts |
| Core-world academy | `upbringing.academy` | Upbringing: was schooled on a core world | In game | src/content/backgrounds.ts:28; sim/crew/backgroundRoll.ts |
| Frontier settler | `upbringing.frontier_settler` | Upbringing: grew up on the frontier | In game | src/content/backgrounds.ts:32; sim/crew/backgroundRoll.ts |
| Monastery ward | `upbringing.monastery_ward` | Upbringing: was raised by a quiet order | In game | src/content/backgrounds.ts:36; sim/crew/backgroundRoll.ts |
| Gang runner | `upbringing.gang_runner` | Upbringing: ran with a station gang | In game | src/content/backgrounds.ts:41; sim/crew/backgroundRoll.ts |
| Salvage diver | `career.salvage_diver` | Career: cut wrecks for a living | In game | src/content/backgrounds.ts:48; sim/crew/backgroundRoll.ts |
| Dock mechanic | `career.dock_mechanic` | Career: kept freighters flying at a dock | In game | src/content/backgrounds.ts:52; sim/crew/backgroundRoll.ts |
| Factory hand | `career.factory_hand` | Career: worked a fabricator line | In game | src/content/backgrounds.ts:56; sim/crew/backgroundRoll.ts |
| Hydroponics tech | `career.hydroponics_tech` | Career: ran a hydroponics deck | In game | src/content/backgrounds.ts:60; sim/crew/backgroundRoll.ts |
| Navy gunner | `career.navy_gunner` | Career: served a navy gun deck | In game | src/content/backgrounds.ts:64; sim/crew/backgroundRoll.ts |
| Freight pilot | `career.freight_pilot` | Career: flew freight on the long lanes | In game | src/content/backgrounds.ts:68; sim/crew/backgroundRoll.ts |
| Field medic | `career.field_medic` | Career: patched people up under fire | In game | src/content/backgrounds.ts:72; sim/crew/backgroundRoll.ts |
| Lab tech | `career.lab_tech` | Career: ran samples in a research lab | In game | src/content/backgrounds.ts:76; sim/crew/backgroundRoll.ts |
| Galley cook | `career.galley_cook` | Career: cooked in a ship’s galley | In game | src/content/backgrounds.ts:80; sim/crew/backgroundRoll.ts |
| Bouncer | `career.bouncer` | Career: kept the peace in a dockside bar | In game | src/content/backgrounds.ts:84; sim/crew/backgroundRoll.ts |
| Systems tech | `career.systems_tech` | Career: tuned shield and power systems | In game | src/content/backgrounds.ts:88; sim/crew/backgroundRoll.ts |
| Data broker | `career.data_broker` | Career: bought and sold other people’s secrets | In game | src/content/backgrounds.ts:92; sim/crew/backgroundRoll.ts |
| Mercenary | `career.mercenary` | Career: fought for whoever paid | In game | src/content/backgrounds.ts:96; sim/crew/backgroundRoll.ts |
| Drifter | `career.drifter` | Career: drifted from job to job | In game | src/content/backgrounds.ts:101; sim/crew/backgroundRoll.ts |
| Drifter | `career.drifter` | Career: drifted from job to job (no skills) | In game | src/content/backgrounds.ts:101 |

## Traits

Effects are data (`TraitDef.effects`) read by the system named in `src/sim/crew/traitDef.ts`. `rollable: false` means generated crew never get it.

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Brave | `trait.brave` | Fights unarmed · never surrenders | In game | src/content/traits.ts:10 |
| Coward | `trait.coward` | Flees when hurt · may surrender | In game | src/content/traits.ts:15 |
| Loner | `trait.loner` | Alone +3 · crowded −4 | In game | src/content/traits.ts:20 |
| Social | `trait.social` | Company +6 · lonely −8 | In game | src/content/traits.ts:25 |
| Hot-headed | `trait.hot_headed` | Rivalries form fast | In game | src/content/traits.ts:30 |
| Peacemaker | `trait.peacemaker` | Friendships form fast | In game | src/content/traits.ts:36 |
| Protective | `trait.protective` | Bonds fast in danger · grieves harder | In game | src/content/traits.ts:42 |
| Workaholic | `trait.workaholic` | Work ×1.15 · works through tiredness | In game | src/content/traits.ts:47 |
| Lazy | `trait.lazy` | Work ×0.9 · relaxed +3 | In game | src/content/traits.ts:53 |
| Thrill-seeker | `trait.thrill_seeker` | Danger +6 · bored −3 | In game | src/content/traits.ts:59 |
| Stoic | `trait.stoic` | Mood factors ×0.5 | In game | src/content/traits.ts:64 |
| Sensitive | `trait.sensitive` | Mood factors ×1.5 | In game | src/content/traits.ts:69 |
| Cheerful | `trait.cheerful` | +5 mood · cheers others up | In game | src/content/traits.ts:74 |
| Gloomy | `trait.gloomy` | −5 mood · drags others down | In game | src/content/traits.ts:79 |
| Pyrophobic | `trait.pyrophobic` | Afraid of fire | Partial: not rollable | src/content/traits.ts:85; effect coded (crew/traitMood.ts) but never rolled onto generated crew |
| Space-sick | `trait.space_sick` | Hates spacewalks | Partial: not rollable | src/content/traits.ts:90; effect coded (crew/traitMood.ts) but never rolled onto generated crew |
| Afraid of the dark | `trait.dark_fear` | Afraid of the dark | Partial: not rollable | src/content/traits.ts:96; effect coded (crew/traitMood.ts) but never rolled onto generated crew |
| Battle-shy | `trait.battle_shy` | Afraid of combat | In game | src/content/traits.ts:102 |
| Drinker | `trait.drinker` | Craves spirits | Partial: def only | src/content/traits.ts:108; not rollable, no effect field, no habit mechanic |
| Stim-hooked | `trait.stim_hooked` | Craves stims | Partial: def only | src/content/traits.ts:113; not rollable, no effect field, no habit mechanic |
| Pacifist | `trait.pacifist` | Won’t fight · at peace +3 | In game | src/content/traits.ts:118 |
| Strong | `trait.strong` | Carry ×1.5 · melee +2 · hungry ×1.25 | In game | src/content/traits.ts:124 |
| Quick | `trait.quick` | Move ×1.15 · tires ×1.15 | In game | src/content/traits.ts:131 |
| Tough | `trait.tough` | Hp ×1.2 · bleeds out slower · move ×0.95 | In game | src/content/traits.ts:136 |
| Bookish | `trait.bookish` | Science XP ×1.5 · hp ×0.85 · carry ×0.75 | In game | src/content/traits.ts:142 |
| Small appetite | `trait.small_appetite` | Hungry ×0.7 · food mood half | In game | src/content/traits.ts:148 |
| Glutton | `trait.glutton` | Food mood ×2 · hungry ×1.3 | In game | src/content/traits.ts:153 |
| Void-born | `trait.void_born` | Suit air ×1.5 · no suit slowdown | In game | src/content/traits.ts:158 |
| Dark-adapted | `trait.dark_adapted` | No dark penalty · glare −3 | In game | src/content/traits.ts:163 |
| Gifted | `trait.gifted` | XP ×1.5 · restless when idle | In game | src/content/traits.ts:168 |
| Marksman | `trait.marksman` | Gunnery +2 | In game | src/content/traits.ts:174 |
| Natural pilot | `trait.natural_pilot` | Piloting +2 | In game | src/content/traits.ts:178 |
| Clumsy | `trait.clumsy` | Melee −2 · gunnery −2 · work ×0.95 | In game | src/content/traits.ts:182 |

## Crew systems and behaviours

Name | id column holds the code path.

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Needs: rest, hunger | ``sim/systems/needs.ts`` | Rest and hunger drain; sleep in beds, eat meals; robots use charge | In game | ai/machines/sleep.ts, eat.ts, charge.ts |
| Mood | ``sim/systems/mood.ts`` | Mood factors (food, beds, light, company, fear, traits) set work speed | In game | sim/crew/mood.ts, traitMood.ts, bondMood.ts |
| Room quality | `-` | Per-room value from space, cleanliness, condition (comfort has no data yet; first pass of #441), tiers Grim..Impressive; sets sleep and meal factors, surroundings, break points | In game | sim/roomQuality.ts, crew/roomMood.ts |
| Leisure spots and no time off | `-` | Breaks go to the mess, the game table (2) or the arcade (1); Social/Loner lean; "No time off" -4 after 1200 s | In game | sim/ai/machines/leisure.ts, leisureSpots.ts |
| Mental breaks | ``sim/systems/breakdown.ts`` | 7 kinds (panic, freeze, hide, tantrum, despair, refusal, isolation) from 7 contexts | In game | sim/crew/breakdown.ts, breakTable.ts |
| Relationships and bonds | ``sim/systems/relationship.ts`` | Chats and rows build friendships and rivalries; grief on a friend's death | In game | sim/crew/bonds.ts, interact.ts |
| More interactions | ``content/interactions.ts`` | Deep talk, joke, insult, comfort | Planned | only chat and shout exist (interactions.ts header; TRAITS.md section 6) |
| Schedules | ``sim/ai/schedule.ts`` | 24-hour work/free/sleep rows, 5 presets, per-crew rows | In game | content/schedules.ts; ui/SchedulePane.svelte |
| AI drives and policies | ``sim/ai/*`` | Drives pick sleep, eat, air, work, leisure; interrupts for forced states | In game | content/policies.ts; docs/CREW_AI.md |
| Skills and XP | ``sim/crew/xp.ts`` | Use trains skills 0-10 | In game | sim/crew/skills.ts, workSkill.ts |
| Medical treatment | ``sim/crew/treatment.ts`` | Med beds and recovery pods heal faster with medicinal herbs; a medic tending a medical bed (`tend` job, `tendingOf`) adds their skill and earns the XP; downed crew bleed out unless rescued; hurt crew (under 70%) walk to a free medical bed, else a powered recovery pod (`recover` drive); the downed go to a pod first | In game | sim/systems/vitals.ts, autojobs.ts |
| Hand-weapon fighting and cover | ``sim/fight/*`` | Crew shoot and melee; target cover lowers hit chance | Partial: no cover-seeking | sim/fight/los.ts gives targets cover; crew do not move to cover and the crouch/lean clips are unused (issue #50) |
| Surrender and capture | ``sim/fight/surrender.ts`` | Hurt, outnumbered crew surrender | Partial: no prisoner holding | holding prisoners is issue #116 (cryo pods, not built) |
| Crew implants | ``-`` | Tiered augments as stat modifiers | Planned | issue #311 (phase 7) |
| Workbench: personal gear | ``-`` | Crew make and repair gear | Planned | issue #320; module.workbench is sprite only |
| Habits (drinker, stims) | ``-`` | Cravings and withdrawal | Planned | the two traits exist as non-rollable defs; no mechanic |

## Policies, schedules and interactions

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Robot policy | `policy.robot` | Drive set for a crew kind | In game | src/content/policies.ts:74 |
| Colonist policy | `policy.colonist` | Drive set for a crew kind | In game | src/content/policies.ts:75 |
| Station policy | `policy.station` | Drive set for a crew kind | In game | src/content/policies.ts:77 |
| Guest policy | `policy.guest` | Drive set for a crew kind | In game | src/content/policies.ts:80 |
| Npc policy | `policy.npc` | Drive set for a crew kind | In game | src/content/policies.ts:82 |
| Default schedule | `schedule.default` | Preset 24 h plan (rotation) | In game | src/content/schedules.ts:18 |
| Late schedule | `schedule.late` | Preset 24 h plan (rotation) | In game | src/content/schedules.ts:20 |
| Day shift schedule | `schedule.day` | Preset 24 h plan | In game | src/content/schedules.ts:21 |
| Night shift schedule | `schedule.night` | Preset 24 h plan | In game | src/content/schedules.ts:22 |
| Any schedule | `schedule.any` | Preset 24 h plan | In game | src/content/schedules.ts:24 |
| Chat | `interaction.chat` | Two idle crew talk; may build or sour a bond | In game | src/content/interactions.ts:10 |
| Shouting match | `interaction.shout` | Rivals row; mood hit, log line | In game | src/content/interactions.ts:21 |
