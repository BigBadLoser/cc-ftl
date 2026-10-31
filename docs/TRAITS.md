# Crew traits and per-crew skills

Design for #239 (parent #238: the new-game crew screen rolls a crew, so the roll needs something to roll). Design only:
nothing here is built yet. Numbers are starting values for tuning, not promises.

Grounding: the stat resolver (`src/sim/stats.ts`, "traits and implants plug in later"), role skills (`src/content/roles.ts`,
`src/sim/crew/skills.ts`), skill XP (`src/sim/story/components.ts`), mood (`src/sim/crew/mood.ts`, `systems/mood.ts`),
needs (`systems/needs.ts`), vitals (`systems/vitals.ts`), tile conditions (`crew/conditions.ts`), fighting
(`fight/surrender.ts`, `fighter.ts`, `flee.ts`, `rescue.ts`, `weapons.ts`), the crew AI layers (`docs/CREW_AI.md`,
`src/sim/ai/`), tuning (`src/sim/tuning.ts`; the sim runs at 20 ticks per second).

**Design priority.** Traits should change what a crew member *does* and make stories: the coward who bolts from the
gun deck, the loner who sleeps in the cargo bay, the two engineers who can't stand each other. A ±10% stat is texture,
not a trait worth a slot. Most traits are trade-offs or behaviours; only three are plain stat bumps.

## 1. Crew-generation RNG

| Rule | Value |
|---|---|
| Starting crew | Each member is rolled by `rollCrewMember(seed, role, slot, rerolls)` (new, pure, `src/sim/crew/roll.ts`) from `new Rng(hash32(sim.seed, CREW_ROLL_SALT, slot, rerolls))` (`Rng` from `sim/rng.ts`, `hash32` from `galaxy/hash.ts`). It rolls name, appearance seed, starting rest, skills and traits. |
| Reroll | Rerolling one member bumps that slot's `rerolls`; rerolling the whole crew bumps every slot. Nothing touches `sim.rng`, so a reroll changes nothing else in the world, and slots never affect each other. |
| Into the sim | The crew screen's choices (per slot: role, `rerolls`, edited name) go into `newGame` as data; the sim rolls them again from the same keys. The UI preview calls the same pure function, so what you see is what you get. |
| Mid-game crew | Recruits (`galaxy/recruit.ts`) and rescued crew are world events: they roll with `sim.rng` through the same function body (`rng` is a parameter). |
| `createCrew` | Takes an optional `rng` (default `sim.rng`) for name, appearance and rest, which it draws from `sim.rng` today. |

## 2. Skill generation

Budget first, then distribution. Every point is placed once; nothing is trimmed afterwards.

| Step | Rule |
|---|---|
| 1. Budget | `T = roleTotal + d`, with d = −1 (20%), 0 (50%), +1 (22%), +2 (8%). Role totals: engineer 5, security 4, gunner, medic, pilot and scientist 3. |
| 2. Base | Start from the role's skills; every other skill is 0. |
| 3. Spread | 0 (40%), 1 (40%) or 2 (20%) **swaps**. A swap moves 1 point from a random core skill (which must stay ≥ 1) to an off-role skill (60%) or another core skill (40%; off-role only for one-skill roles). The total doesn't change. |
| 4. Apply d | d > 0: add d points one at a time, to a core skill (weight 3) or an off-role skill (weight 1). d < 0: take 1 point from the highest core skill, never below 1. |
| Cap | 5 per skill. A point that would pass 5 goes to the next pick. |
| Always feasible | Lowest budget is roleTotal − 1, and every role has at most roleTotal − 1 core skills (engineer: 3 core, budget ≥ 4), so every core skill can keep 1. |

Labels are computed from the **final** skills and have no effect on play:

| Label | Condition |
|---|---|
| Talented | Final total ≥ roleTotal + 2, or any off-role skill ≥ 2, or any core skill ≥ role value + 2. |
| Green | Final total < roleTotal and every off-role skill is 0. Reachable for every role (d = −1 with no swap to off-role). |

Example: gunner (gunnery 3), d = +1, one swap to piloting. gunnery 3 → 2 (swap), piloting 1, then +1 lands on gunnery → 3.
Final gunnery 3, piloting 1, total 4. No label.

### Storage

| Rule | Value |
|---|---|
| `RolledSkillsC { skills: Partial<Record<SkillName, number>> }` | A complete snapshot of the starting skills. A missing skill means 0. |
| Resolver | `roleSkillModifiers` returns the rolled values **instead of** the role's when `RolledSkillsC` exists (no stacking). XP (`xpSkillModifiers`) and trait modifiers add on top as now. |
| Fallback | No `RolledSkillsC` (robots, aliens, NPC crew, old saves): role skills, as today. |
| Role still owns | Non-skill role fields: `fighter`, `surrenderBelow`, job priorities. |

## 3. XP from routine work

All skill XP today comes from story effects (`story/effects.ts`, `skillXp`) and shady recruits (`galaxy/recruit.ts`). Routine
work adds most XP from now on, in proportion to the work done, not the number of jobs.

| Rule | Value |
|---|---|
| Unit | 1 XP = 1 work-second at workSpeed 1, i.e. progress points / 20. Faster workers learn faster because they do more work. |
| Grant | One helper, `grantXp(sim, id, skill, xp)` (new, `src/sim/crew/xp.ts`, a module function like `stat`, not a system), called where the work is done. Gifted multiplies here. |
| Curve | Level n costs `100 × n²` XP: +1 at 100, +2 at 500, +3 at 1400, +4 at 3000, +5 at 5500 (cap). In work time at full speed: 2 min, 8 min, 23 min, 50 min, 92 min of that skill's work. |
| To the stat | `xpSkillModifiers` adds `levelsFor(xp)` (largest n whose total cost ≤ xp, max 5) instead of `floor(xp / 100)`. Integer levels only. |
| Specialists stay distinct | XP levels stack on the rolled base and the cost depends on XP levels earned, not on the skill's total, so a rolled 4 and a rolled 1 climb at the same rate and the gap stays. Crew mostly earn XP in their own role's work, so the role gap widens. +5 takes about 90 min of focused work, so it's rare. |

Where XP is granted:

| Work | Skill | Granted in | Amount |
|---|---|---|---|
| build, module, deconstruct, moduleDecon, repair, extinguish, forceDoor, mend, salvage, assemble | repair | `crew/jobWork.ts` `progress()` (the one place job progress accrues, called from `ai/work.ts`) | progress added / 20 |
| research | science | same (`research` jobs go through `performJob`) | progress / 20 |
| hack | hacking | same | progress / 20 |
| Helm, while it matters (combat evade, FTL charge, mining pilot) | piloting | `systems/helm.ts`, `ftl/order.ts`, `mining/pilot.ts` | 1 per second |
| Weapon console while a weapon charges | gunnery | `systems/weaponCharge.ts` | 1 per second |
| Shield console while shields recharge | shielding | `systems/shields.ts` | 1 per second |
| Bed healing | medicine | `systems/vitals.ts`, to the crew member whose medicine was used | 2 per hp healed |
| Hand weapons | gunnery / melee | `fight/weapons.ts` | 1 per 4 damage dealt |
| Crafting, hauling | none | — | — |

A console in peacetime grants nothing: sitting at the helm isn't work. Medicine counts the best medic aboard
(`vitals.ts` doesn't need the medic present today); that stays the same until a tend job exists.

Existing numbers: story `skillXp` amounts are worth fewer levels late on (accepted: they're bonuses). Shady recruits
get `xpForLevels(shady)` instead of `shady × XP_PER_LEVEL`. Saved `SkillXpC` values would map to fewer levels. A
migration is cheap (old levels → `xpForLevels`), so the user decides between that and a `SAVE_VERSION` bump.

## 4. Traits

| Rule | Value |
|---|---|
| Count | 0 traits (25%), 1 (50%), 2 (25%). |
| Draw | Weighted, without replacement, skipping exclusions. Weights: 10 common, 5 uncommon, 2 rare. Strong upsides are rare, story traits common. |
| Who | Mood species (humans): starting crew, recruits, rescued crew. NPCs later. |
| Stored as | `TraitsC { ids: string[] }`. Content `src/content/traits.ts`, `satisfies TraitDef`, ids `trait.<name>`. |
| Mechanism | `traitModifiers` (new modifier source) for stat effects; flags on `TraitDef` read by the system that owns the behaviour. Systems still never call each other. |
| Not yet built | A trait whose mechanic hasn't landed has `rollable: false`, so no one rolls a trait that does nothing. |

Hook column: **stat** = `traitModifiers` only. **small** = a few lines in one existing system. **fear**, **bond**,
**habit** = needs that mechanic (sections 5 to 7).

### Behaviour traits (the point of the system)

| Trait | Flavour | Effect | Plays as | Weight | Excludes | Hook |
|---|---|---|---|---|---|---|
| Brave | Runs toward the shooting. | Fights unarmed like a `fighter` role; never surrenders; never panics (fear capped at 59); volunteers rescues into danger and combat | Saves people, dies more often | 5 | Coward, Battle-shy | small (`canFight`, `wantsToSurrender`, rescue fit) |
| Coward | Runs away from the shooting. | Flees below 50% hp even armed; player crew surrender below 30% (today: never); fear rises ×1.5 and breaks a draft after 5 s instead of 20 s; won't volunteer a rescue near hostiles | Lives longer, lets others down | 10 | Brave | small, fear |
| Loner | Prefers the quiet decks. | No "lonely" (−4); "alone" +3 instead; "crowded" −4 with 3+ crew within 7 tiles; bonds form ×0.5 | Drifts to empty rooms, few friends | 10 | Social | small (mood), bond |
| Social | Needs someone to talk at. | "company" +6 (not +3); "lonely" −8 (not −4); bonds form ×2 | Knits the crew together, sulks alone | 10 | Loner | small (mood), bond |
| Hot-headed | Takes it personally. | Rivalry gains ×2; when near a rival with mood < `MOOD_LOW`, 5% per bond check of a shouting match (both −5 mood for 5 min, −5 score, log line) | Grudges and scenes | 10 | Peacemaker | bond |
| Peacemaker | Everyone's favourite. | Friendship gains ×1.5; rivals within 7 tiles of them get half the rival penalty; no shouting matches near them | Glue, worth protecting | 5 | Hot-headed | bond |
| Protective | Nobody touches my people. | Shared-danger bond gains ×2; gunnery and melee +1 in a fight within 6 tiles of a friend; fear rise ×0.5 near a friend; "Grieving" ×1.5 | Fierce, then broken by a death | 5 | — | bond |
| Workaholic | One more panel. | workSpeed ×1.15; only sleeps or eats at the urgent thresholds (`policy.legacy`), so stays at the job; "idle" −5 mood after 60 s with no job | Gets it done, burns out | 5 | Lazy | small (`ai/policy.ts`, mood) |
| Lazy | Will get to it. | workSpeed ×0.9; takes the idle stroll between jobs more often; "relaxed" +3 mood | Slow, never miserable | 10 | Workaholic | small (policy, mood) |
| Thrill-seeker | Bored when it's quiet. | Mood +6 in combat or on EVA; "bored" −3 after 15 min without either | Volunteers for the dangerous jobs | 5 | Battle-shy, Afraid of the void | small (mood) |
| Stoic | Seen worse. | All mood factors ×0.5, good and bad | Steady, hard to cheer up | 5 | Sensitive | small (mood) |
| Sensitive | Feels everything. | All mood factors ×1.5 | Highs and breakdowns | 5 | Stoic | small (mood) |
| Cheerful | Whistles through red alerts. | Mood +5; crew within 7 tiles "cheered up" +2 | Lifts a room | 10 | Gloomy | small (mood) |
| Gloomy | Knows how this ends. | Mood −5; crew within 7 tiles "dragged down" −1 | Sours a room | 10 | Cheerful | small (mood) |

### Phobias and habits

| Trait | Flavour | Effect | Weight | Excludes | Hook |
|---|---|---|---|---|---|
| Pyrophobic | Saw a ship burn once. | Fear trigger: fire (section 5) | 5 | — | fear |
| Afraid of the void | Hates the hum of the hull. | Fear trigger: vacuum and EVA | 5 | Void-born, Thrill-seeker | fear |
| Afraid of the dark | Sleeps with the lights on. | Fear trigger: darkness | 5 | Dark-adapted | fear |
| Battle-shy | Freezes when the shooting starts. | Fear trigger: combat | 5 | Brave, Thrill-seeker | fear |
| Drinker | Just one to take the edge off. | Habit: `item.spirits` (section 7) | 5 | Stim-hooked | habit |
| Stim-hooked | Ran double shifts on a mining rig. | Habit: `item.stims`; while dosed workSpeed ×1.1, restDecay ×1.2 | 2 | Drinker | habit |

### Trade-off traits

| Trait | Flavour | Up | Down | Weight | Excludes | Hook |
|---|---|---|---|---|---|---|
| Strong | Carries the crate and the guy on it. | carryCapacity ×1.5, melee +1 | hunger ×1.25 | 5 | Bookish | stat, small (hunger) |
| Quick | Walks like the deck's on fire. | moveSpeed ×1.15 | restDecay ×1.15 | 5 | — | stat |
| Tough | Hard to put down. | max hp ×1.2, bleed-out (`BLEED_OUT_SECONDS`) ×1.5 | moveSpeed ×0.95 | 5 | Bookish | small (spawn, vitals) |
| Bookish | Reads the manual. | science, medicine, hacking XP ×1.5 | max hp ×0.85, carryCapacity ×0.75 | 5 | Strong, Tough | small (spawn, xp) |
| Small appetite | Half a ration is plenty. | hunger ×0.7 | food mood (wellFed, hotMeal) ×0.5 | 5 | Glutton | small (needs, mood) |
| Glutton | Ate your ration too. | food mood ×2 | hunger ×1.3; eats below 50 instead of `HUNGER_EAT_BELOW` 35 | 10 | Small appetite | small (needs, eating, mood) |
| Void-born | Spacewalks before breakfast. | suit air (`airSec` 240) ×1.5; no suit move penalty (0.8) | "cooped up" −3 mood after 30 min without EVA | 2 | Afraid of the void | small (suits, mood) |
| Dark-adapted | Grew up on a dim station. | Ignores `DARK_MOVE_MULT` / `DARK_WORK_MULT` and "dark" (−5) | "glare" −3 mood on tiles with light ≥ 90 | 5 | Afraid of the dark | small (conditions, mood) |
| Gifted | Learns it once. | All XP ×1.5 (about a third less time per level) | "restless" −3 mood while idle | 2 | — | small (xp, mood) |

### Texture (plain stats, kept few)

| Trait | Flavour | Effect | Weight | Excludes | Hook |
|---|---|---|---|---|---|
| Marksman | Never misses twice. | gunnery +1 | 5 | Clumsy | stat |
| Natural pilot | Flies by feel. | piloting +1 | 5 | — | stat |
| Clumsy | Drops tools. Drops guns. | melee −1, gunnery −1, workSpeed ×0.95 | 5 | Marksman | stat |

32 traits: 14 behaviour, 6 phobia/habit, 9 trade-off, 3 texture. 23 are rollable after step 2 (the 9 trade-offs, the 3
texture traits and 11 behaviour traits on simple hooks; Coward's fear part and Loner/Social's bond part follow
later). The other 9 wait for fear, bonds or habits.

## 5. Fear and phobias (M, in two halves)

Fear goes through the crew AI's eligibility and interrupt layers (`docs/CREW_AI.md` section 5), not a separate path
override.

### Fear meter

| Rule | Value |
|---|---|
| `FearC { level: 0..100, trigger, sinceMax, broke }` | Updated by `systems/fear.ts` (new) every 10 ticks, staggered by id. |
| Triggers | Fire: a burning tile (grid `fire`) within 3 tiles. Vacuum: own tile `o2` < `O2_HARM_BELOW` (10), or on EVA. Dark: own tile `light` < `LIGHT_DARK_BELOW` (40). Combat: a hostile (`fight/relations.ts`) in line of sight (`fight/los.ts`) within 8 tiles. |
| Rise | +10/s while the trigger is present (+20/s if it's on their own tile). Coward ×1.5, Protective near a friend ×0.5. |
| Decay | −5/s when the trigger is gone. |
| 30 Uneasy | Mood "uneasy" −5. |
| 60 Afraid | Mood "terrified" −15; workSpeed ×0.7; gunnery −1, melee −1 (accuracy in `fight/weapons.ts` goes through `stat`). Brave caps at 59. |
| 100 Panic | Undrafted: panic (below). Drafted: obey with the penalties above; once at 100 for 10 more seconds (about 20 s of trigger in all; Coward 5 s), `broke = true` and they panic anyway. |
| End | Panic ends when level < 40 and the trigger is out of sight. `broke` clears; a drafted crew member goes back to their orders (`DraftedC` stays). Afterwards "shaken" −5 mood for 2 min. |

### Half 1: avoidance through eligibility (buildable now)

| Rule | Where |
|---|---|
| A phobic crew member isn't eligible for a job whose site is inside a trigger area: fire within 3 tiles of the site (and `extinguish` jobs) for Pyrophobic; EVA, `suitUp` and vacuum sites for Afraid of the void; sites with light < 40 for Afraid of the dark; sites with a hostile within 8 tiles for Battle-shy. | `crew/jobFit.ts` `jobFits` |
| Rescue: phobic crew don't volunteer for a `rescue` whose patient lies in a trigger area unless drafted; Brave always will, including near hostiles. | `jobFits`, `fight/rescue.ts` `claimHiddenRescue` |
| Direct orders (drafted, `man.ts`) skip eligibility, so the player can always send them. | — |
| Fear meter, mood and penalties all run in this half. At 100 nothing more happens until half 2. | `systems/fear.ts`, `crew/mood.ts`, `traitModifiers` |

### Half 2: panic as an interrupt (blocked on #194)

Panic flee is a new `Interrupt` reason with owner `executor` and a `flee` task built on `fleePath`. It **depends on
the interrupt layer becoming authoritative** (#194's next phase): today `src/sim/ai/interrupt.ts` is a Phase 1
read-only detector that aborts nothing, so there's nothing to hook panic onto without a parallel override, which we
don't want.

Precedence, highest first:

| # | Reason | Rule |
|---|---|---|
| 1 | dead | — |
| 2 | downed, carried, inert, stunned | — |
| 3 | floating (EVA) | — |
| 4 | emergency escape | Own tile lethal (no O2 without a suit, or on fire unless extinguishing): everyone leaves it, phobia or not |
| 5 | panic (`broke`) | Severe fear breaks a draft |
| 6 | drafted | Obeys, with fear penalties |
| 7 | panic | Undrafted at 100 fear |
| 8 | heldForMend | — |
| 9 | fight | — |

Two conflicts with `docs/CREW_AI.md` to settle when #194's interrupt phase is designed: it puts `hazard` (our
emergency escape) at 7, below `fight`, in Phase 3, where this design needs it at 4, above `drafted`; and its hazard
tolerance list (`extinguish`, breach seal, suited work) has to match "lethal" here.

Log and alerts: "Kel is terrified of the fire." (log, on reaching 60). "Kel panicked and fled the fire." (urgent
alert, clickable, on panic). "Kel broke ranks: fled the fire against orders." (urgent alert when `broke` sets on a
drafted crew member). Events `crew.afraid`, `crew.panicked { broke }`, never read by sim logic.

| Touches | Change |
|---|---|
| `crew/fear.ts`, `systems/fear.ts` (new), `pipeline.ts` | meter, triggers |
| `crew/jobFit.ts`, `fight/rescue.ts` | half 1 eligibility |
| `crew/mood.ts`, `traitModifiers` | factors, penalties |
| `ai/interrupt.ts`, `ai/types.ts`, `ai/machines/` (flee), `fight/flee.ts` | half 2 |
| `events.ts`, `app/logText.ts`, alerts | lines above |

Size: half 1 **S/M**, half 2 **M** once the interrupt layer is authoritative.

## 6. Relationships (L)

Bonds come from compatibility and shared experiences; being in the same room barely matters, so not everyone ends up
friends.

| Rule | Value |
|---|---|
| `RelationsC { scores: Record<crewId, number>, seen: {...} }` | −100 to +100 per other crew member, sparse. Player crew only. |
| Compatibility | Fixed per pair, `c ∈ [−1, 1]`: `unit(appearanceSeedA, appearanceSeedB)` mapped to −1..1, + 0.3 for two Social, − 0.3 if either is Hot-headed. From appearance seeds, so it survives saves and ID remaps. |
| Cadence | `systems/relationship.ts` every `BOND_INTERVAL` = 100 ticks (5 s), staggered by id. (`MOOD_INTERVAL` is 10 ticks, 0.5 s.) |
| Reciprocal | Every update writes both sides in the same step. Shared events give both the same amount; rescue is asymmetric (below). |
| Strong bonds | Friend ≥ 50, rival ≤ −50. At most 3 friends and 2 rivals each. A score that would make a 4th friend stops at 49 unless it beats the weakest friend, who then drops to 49. Same for rivals. |
| Fading | Scores drift 1 point toward 0 per 10 min without any shared event, so bonds need upkeep. |

| Source (detected from state, not events) | Change per pair |
|---|---|
| Near each other (within `MOOD_COMPANY_RADIUS` 7), per check | +0.05 × c (about ±0.6 per min at best: small) |
| Working jobs within 4 tiles of each other, per check | +0.3 × c (compatible pairs bond on shared work, incompatible ones grate) |
| Either has mood < `MOOD_LOW` (35) while near, per check | −0.2 (Hot-headed ×2) |
| Rescue (one carries the other, `CarriedC`), once per rescue | patient → rescuer +20, rescuer → patient +8 |
| Fought side by side (both engaged, within 6 tiles), once per fight | +10 (+3 if c < −0.3) |
| One downed beside the other in a fight, once | +5 both |
| Witnessed a crewmate's death (within 7 tiles) | +5 between the witnesses |
| Shouting match (Hot-headed) | −5 |

| Effect | Value |
|---|---|
| With a friend | Mood +4 within 7 tiles; workSpeed ×1.05 within 3 tiles of a friend who's working |
| Near a rival | Mood −6 within 7 tiles (halved near a Peacemaker); rivals avoid adjacent beds and the same table |
| Grief | A friend's `DeadC` (seen by the system, not the event): "grieving" −15 for 10 min (Protective ×1.5) |

| Touches | Change |
|---|---|
| `crew/relationship.ts`, `systems/relationship.ts` (new), `pipeline.ts` | scores, sources, caps, fading |
| `crew/mood.ts`, `traitModifiers` | factors, friend bonus |
| `crew/beds.ts`, `systems/bedOwners.ts`, eating spot pick | rival avoidance |
| `sector/refs.ts` | translate `scores` keys on a sector cut (entity IDs as map keys) |
| `events.ts`, `logText.ts` | `crew.befriended`, `crew.rivalry`, `crew.grieving`, shouting match |
| UI | bonds on the crew card |

Size **L**: the system is M; per-pair "once" bookkeeping, ID-keyed maps and bed/table avoidance spread it.

## 7. Addictions (M/L)

| Rule | Value |
|---|---|
| Items | `item.spirits` (new; traders 12; later a still from rations + water) and `item.stims` (new, contraband; black markets 30, derelict loot). In `content/items.ts`, `trade.ts`, `galaxyMarket.ts`, `blackMarkets.ts`. |
| `AddictionC { item, craving, dosedSec }` | Craving 0 → 100 over about 10 min. |
| Feeding | Above 60, goes and takes one from a stockpile, like eating (`crew/eating.ts` pattern, an eat-machine variant); craving 0. |
| Dosed | Drinker: "had a drink" +6 mood for 2 min. Stim-hooked: workSpeed ×1.1, restDecay ×1.2 for 5 min. |
| Withdrawal | Craving 100 and none in reach: "withdrawal" −20 mood, workSpeed ×0.8 until fed. |
| Kicking it | 30 min in withdrawal removes the trait (log line). Forbidding the item on stockpiles forces it. |
| Log / alert | "Kel is craving a drink." (log), "Kel is in withdrawal." (alert, throttled), "Kel kicked the habit." (log). |

Size **M** buy-only; **L** with the still and its art.

## 8. UI

| Where | Shows |
|---|---|
| Crew card (`src/ui/CrewInspector.svelte`) | Trait chips under the name, coloured by kind (behaviour, phobia/habit, trade-off, texture); hover shows the effect line. Skills: rolled base, `+n` from XP, a thin bar to the next level. Fear bar when > 0. Bonds: friends and rivals with names. Active states (afraid, craving, grieving) are already in the mood breakdown as factors. |
| Crew bar (`CrewBar.svelte`) | Urgent state only: an icon for panic or withdrawal. |
| Crew screen roll (#238) | Per member: portrait, editable name, fixed role, skill pips against the role baseline (filled = baseline, bright = above, hollow = below), trait chips, Talented or Green. Reroll one or all (section 1). |
| Ship's log (`app/logText.ts`) | Bonds formed, shouting matches, fear at 60, cravings, habit kicked, level-ups ("Mara's repair is now 4."). |
| Alerts | Panic, broke ranks, withdrawal. |

## 9. Build order

| Step | Piece | Size | Notes |
|---|---|---|---|
| 1 | Crew-generation RNG, budget-first skill rolls, `RolledSkillsC` | S | — |
| 2 | `TraitDef`, `TraitsC`, roll, `traitModifiers`; texture, trade-off and simple-hook behaviour traits (Brave, Coward minus fear, Workaholic, Lazy, Thrill-seeker, Stoic, Sensitive, Cheerful, Gloomy, Loner/Social mood half) | M | others `rollable: false` |
| 3 | Crew card and crew screen roll | M | unblocks #238 |
| 4 | Work-based XP: `grantXp`, curve, grant points, recruit and save handling | S/M | |
| 5a | Fear meter + eligibility half; phobia traits rollable | S/M | |
| 5b | Panic interrupt, drafted break, emergency escape precedence | M | after #194's interrupt phase |
| 6 | Relationships; Hot-headed, Peacemaker, Protective rollable; Loner/Social bond half | L | |
| 7 | Addictions; Drinker, Stim-hooked rollable | M/L | |

Save: `RolledSkillsC`, `TraitsC`, `FearC`, `RelationsC`, `AddictionC` are new optional components; old saves load with
role skills and no traits. Step 4 changes what `SkillXpC` means (migration or `SAVE_VERSION`, user's call).
