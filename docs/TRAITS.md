# Crew traits and per-crew skills

Design for #239 (parent #238: the new-game crew screen rolls a crew, so the roll needs something to roll). Steps 1 to 4
(section 9) are built: rolls and traits core (#243), the crew card (#246), the crew screen (#249), work XP (#251).
Sections 5 to 7 are design only. Numbers are starting values for tuning, not promises.

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
| Starting crew | Each member is rolled by `rollCrewMember(seed, slot, rerolls, role)` (pure, `src/sim/crew/roll.ts`) from `new Rng(hash32(sim.seed, CREW_ROLL_SALT, slot, rerolls))` (`Rng` from `sim/rng.ts`, `hash32` from `galaxy/hash.ts`). It rolls name, appearance seed, starting rest, skills and traits. |
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

Built in #251. Routine work gives most XP, in proportion to the work done, not the number of jobs; story `skillXp`
effects and shady recruits (`galaxy/recruit.ts`) go through the same helper.

| Rule | Value |
|---|---|
| Unit | 1 XP = 1 work-second at workSpeed 1, i.e. progress points / 20. Faster workers learn faster because they do more work. |
| Grant | One helper, `grantXp(sim, id, skill, xp)` (`src/sim/crew/xp.ts`, a module function like `stat`, not a system), called where the work is done. Gifted multiplies here. Only the player's side learns (`AllegianceC.faction === 'player'`, recruits and robots included): hostile and NPC crew keep the skills their generator gave them. Letting the raider's crew level mid-fight flipped the starter-vs-raider balance test. |
| Curve | Level n costs `100 × n²` XP on top of the levels before it (`crew/xpCurve.ts`): +1 at 100, +2 at 500, +3 at 1400, +4 at 3000, +5 at 5500 (cap). In work time at full speed: 2 min, 8 min, 23 min, 50 min, 92 min of that skill's work. |
| To the stat | `xpSkillModifiers` adds `levelsFor(xp)` (largest n whose total cost ≤ xp, max 5) instead of `floor(xp / 100)`. Integer levels only. |
| Specialists stay distinct | XP levels stack on the rolled base and the cost depends on XP levels earned, not on the skill's total, so a rolled 4 and a rolled 1 climb at the same rate and the gap stays. Crew mostly earn XP in their own role's work, so the role gap widens. +5 takes about 90 min of focused work, so it's rare. |

Where XP is granted:

| Work | Skill | Granted in | Amount |
|---|---|---|---|
| build, module, deconstruct, moduleDecon, repair, extinguish, forceDoor, mend, salvage, assemble | repair | `performJob` (a job-kind → skill map) | workSpeed / 20 per working tick (nothing while the job waits) |
| research | science | same | same |
| hack | hacking | same | same |
| Helm, while it matters: the sector is in combat or the FTL drive is still charging | piloting | `systems/helm.ts` | 1 per second |
| Mining pod in flight | piloting | `systems/mining.ts` | 1 per second |
| Weapon console while a weapon charges | gunnery | `systems/weaponCharge.ts` | 1 per second |
| Shield console while shields recharge | shielding | `systems/shields.ts` | 1 per second |
| Bed healing | medicine | `systems/vitals.ts`, to the best medic aboard (ties, including all at 0, to the lowest id among standing allies, so a crew with no medic can learn) | 2 per hp healed |
| Hand weapons, egg sacs included | gunnery / melee | `fight/fighter.ts` | 1 per 4 damage dealt |
| Crafting, hauling | none | — | — |

A console in peacetime grants nothing: sitting at the helm isn't work (a drafted pilot at a full drive earns nothing).
"In combat" is the sector-wide flag: there is no per-ship hostile check yet. Medicine counts the best medic aboard
(`vitals.ts` doesn't need the medic present today); that stays the same until a tend job exists.

Existing numbers: story `skillXp` amounts are worth fewer levels late on (accepted: they're bonuses). Shady recruits
get `xpForLevels(shady)`. The user chose a `SAVE_VERSION` bump (73) over a migration.

## 4. Traits

| Rule | Value |
|---|---|
| Count | 0 traits (25%), 1 (50%), 2 (25%). |
| Draw | Weighted, without replacement, skipping exclusions. Weights: 10 common, 5 uncommon, 2 rare. Strong upsides are rare, story traits common. |
| Who | Mood species (humans): starting crew, recruits, rescued crew. NPCs later. |
| Stored as | `TraitsC { ids: string[] }`. Content `src/content/traits.ts`, `satisfies TraitDef`, ids `trait.<name>`. |
| Mechanism | `traitModifiers` (new modifier source) for stat effects; flags on `TraitDef` read by the system that owns the behaviour. Systems still never call each other. |
| Not yet built | A trait whose mechanic hasn't landed has `rollable: false`, so no one rolls a trait that does nothing. |

Hook column: **stat** = `traitModifiers` only. **small** = a few lines in one existing system. **break**, **bond**,
**habit** = needs that mechanic (sections 5 to 7).

### Behaviour traits (the point of the system)

| Trait | Flavour | Effect | Plays as | Weight | Excludes | Hook |
|---|---|---|---|---|---|---|
| Brave | Runs toward the shooting. | Fights unarmed like a `fighter` role; never surrenders; never breaks from combat (section 5); volunteers rescues into danger and combat | Saves people, dies more often | 5 | Coward, Battle-shy | small (`canFight`, `wantsToSurrender`, rescue fit), break |
| Coward | Runs away from the shooting. | Flees below 50% hp even armed; player crew surrender below 30% (today: never); combat stress ×1.5 and its breaks lean to hiding and panic (section 5); won't volunteer a rescue near hostiles | Lives longer, lets others down | 10 | Brave | small, break |
| Loner | Prefers the quiet decks. | No "lonely" (−4); "alone" +3 instead; "crowded" −4 with 3+ crew within 7 tiles; bonds form ×0.5 | Drifts to empty rooms, few friends | 10 | Social | small (mood), bond |
| Social | Needs someone to talk at. | "company" +6 (not +3); "lonely" −8 (not −4); bonds form ×2 | Knits the crew together, sulks alone | 10 | Loner | small (mood), bond |
| Hot-headed | Takes it personally. | Rivalry gains ×2; when near a rival with mood < `MOOD_LOW`, 5% per bond check of a shouting match (both −5 mood for 5 min, −5 score, log line) | Grudges and scenes | 10 | Peacemaker | bond |
| Peacemaker | Everyone's favourite. | Friendship gains ×1.5; rivals within 7 tiles of them get half the rival penalty; no shouting matches near them | Glue, worth protecting | 5 | Hot-headed | bond |
| Protective | Nobody touches my people. | Shared-danger bond gains ×2; gunnery and melee +1 in a fight within 6 tiles of a friend; combat stress ×0.5 near a friend; "Grieving" and grief stress ×1.5 | Fierce, then broken by a death | 5 | — | bond, break |
| Workaholic | One more panel. | workSpeed ×1.15; only sleeps or eats at the urgent thresholds (`policy.legacy`), so stays at the job; "idle" −5 mood after 60 s with no job | Gets it done, burns out | 5 | Lazy | small (`ai/policy.ts`, mood) |
| Lazy | Will get to it. | workSpeed ×0.9; takes the idle stroll between jobs more often; "relaxed" +3 mood | Slow, never miserable | 10 | Workaholic | small (policy, mood) |
| Thrill-seeker | Bored when it's quiet. | Mood +6 in combat or on EVA; "bored" −3 after 15 min without either; no combat or decompression stress | Volunteers for the dangerous jobs | 5 | Battle-shy, Space-sick | small (mood), break |
| Stoic | Seen worse. | All mood factors ×0.5, good and bad | Steady, hard to cheer up | 5 | Sensitive | small (mood) |
| Sensitive | Feels everything. | All mood factors ×1.5 | Highs and breakdowns | 5 | Stoic | small (mood) |
| Cheerful | Whistles through red alerts. | Mood +5; crew within 7 tiles "cheered up" +2 | Lifts a room | 10 | Gloomy | small (mood) |
| Gloomy | Knows how this ends. | Mood −5; crew within 7 tiles "dragged down" −1 | Sours a room | 10 | Cheerful | small (mood) |

### Phobias and habits

| Trait | Flavour | Effect | Weight | Excludes | Hook |
|---|---|---|---|---|---|
| Pyrophobic | Saw a ship burn once. | Avoids firefighting when there's other work; fires nearby hurt mood and raise break odds (section 5) | 5 | — | small, break |
| Space-sick (code: `trait.void_fear`) | Hates the hum of the hull. | Prefers indoor work; −4 mood on EVA; suit emergencies raise break odds | 5 | Void-born, Thrill-seeker | small, break |
| Afraid of the dark | Sleeps with the lights on. | Dark rooms −10 mood (not −5); long blackouts raise break odds | 5 | Dark-adapted | small, break |
| Battle-shy | Freezes when the shooting starts. | Combat stress ×4 after 10 s; breaks lean to freezing, hiding, fleeing | 5 | Brave, Thrill-seeker | break |
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
| Void-born | Spacewalks before breakfast. | suit air (`airSec` 240) ×1.5; no suit move penalty (0.8); decompression stress ×0.5 | "cooped up" −3 mood after 30 min without EVA | 2 | Space-sick | small (suits, mood) |
| Dark-adapted | Grew up on a dim station. | Ignores `DARK_MOVE_MULT` / `DARK_WORK_MULT` and "dark" (−5) | "glare" −3 mood on tiles with light ≥ 90 | 5 | Afraid of the dark | small (conditions, mood) |
| Gifted | Learns it once. | All XP ×1.5 (about a third less time per level) | "restless" −3 mood while idle | 2 | — | small (xp, mood) |

### Texture (plain stats, kept few)

| Trait | Flavour | Effect | Weight | Excludes | Hook |
|---|---|---|---|---|---|
| Marksman | Never misses twice. | gunnery +1 | 5 | Clumsy | stat |
| Natural pilot | Flies by feel. | piloting +1 | 5 | — | stat |
| Clumsy | Drops tools. Drops guns. | melee −1, gunnery −1, workSpeed ×0.95 | 5 | Marksman | stat |

32 traits: 14 behaviour, 6 phobia/habit, 9 trade-off, 3 texture. 23 are rollable after step 2 (the 9 trade-offs, the 3
texture traits and 11 behaviour traits on simple hooks; their break and bond parts follow later). Pyrophobic,
Space-sick and Afraid of the dark become rollable at step 5a (avoidance and mood work alone); Battle-shy waits for
breaks (5b), Hot-headed, Peacemaker and Protective for bonds, Drinker and Stim-hooked for habits.

## 5. Stress and mental breaks (S, then M)

One framework for psychological failure; no fear meter. Mood sets how fragile a crew member is, acute **stressors**
(read from world state at check time) can tip anyone into a **break**, and traits change the odds and the kind of break.
Everything goes through the crew AI's layers (`docs/CREW_AI.md` sections 5 and 6): no movement or path of its own.

### Survival is not a break

Leaving a lethal tile is the `hazard` interrupt (`CREW_AI.md` Phase 3), not psychology: own tile on fire, or `o2` <
`O2_HARM_BELOW` (10) or `co2` > `CO2_HARM_ABOVE` (5) without suit air (`hasSuitAir`), or extreme temperature. Everyone,
phobic or mid-break, gets an `escape` task; the tolerance flags (`extinguish`, breach seal, suited work) stay. A drafted
crew member is stepped off a lethal tile once stopped on it (a path through is obeyed) and keeps the draft.

Interrupt order (`ai/interrupt.ts` `detect`; `CREW_AI.md` section 5 matches):

| # | Reason | Rule |
|---|---|---|
| 1–3 | dead; downed, carried, inert, stunned; floating | Unchanged |
| 4 | hazard | Survival; overrides drafts and breaks (a break's timer keeps running) |
| 5 | breakdown, severe | Panic, combat freeze: the only breaks that override a draft |
| 6 | drafted | Orders obeyed; mild and moderate breaks wait (below) |
| 7 | breakdown, moderate | Hide, tantrum, despair |
| 8, 9 | heldForMend, fight | Unchanged |

Mild breaks (work refusal, isolation) aren't interrupts and don't set `Intent.drive`: while `BreakdownC` holds a mild
break, utility scores the work drive 0, so sleep, eat and recharge win as usual and survival still applies. Isolation
also steers the leisure destination (the reachable room with the fewest crew).

### The check

| Rule | Value |
|---|---|
| Who | Mood crew (`hasMood`), not incapacitated, not already in a break, not on cooldown. |
| Cadence | `systems/breakdown.ts` (new, right after `systems/mood.ts` in `pipeline.ts`) every `BREAK_INTERVAL` = 100 ticks (5 s), staggered by id. |
| Roll | `unit(hash32(sim.seed, BREAK_SALT, id, floor(tick / BREAK_INTERVAL)))` < p. Never `Math.random`; independent of `sim.rng`, so one crew member's roll doesn't shift anyone else's. |
| Pick | Second salt: the context, weighted by each term's share of p (`base(mood)` is the "low mood" context); third salt: the outcome from that context's pool. |
| p | `(base(mood) + Σ stressor) × susceptibility`, capped at 4% per check. |
| base(mood) | ≥ 35: 0. 20–35: 0.1%. 10–20: 0.4%. < 10 (`breakdownRisk()`, `MOOD_BREAKDOWN_BELOW`): 1.5% (about one break per 5–6 min). |
| Stressor scale | Each stressor term × (1.5 below mood 35, 1 at 35–65, 0.5 above 65): low mood makes the same fire worse; no mood floor is needed for a break. |
| Drafted | Only severe outcomes can roll, p × 0.5 (a draft steadies). |

Stressors are read from state; duration counters live on `MoodC` beside the trait memory (`idle`, `quiet`, `inside`,
`crew/traitMood.ts`), optional, reset by a break:

| Stressor | Condition | p per check | Outcome pool (weight) |
|---|---|---|---|
| Fire | Burning tile within 3 tiles | 0.3% | panic 5, freeze 2, refusal 2 |
| Combat | Hostile (`fight/relations.ts`) in sight (`fight/los.ts`) within 8 tiles for ≥ 30 s (counter `m.underFire`) | 0.3% | freeze 3, hide 4, panic 3 |
| Decompression | Own tile `o2` < `O2_HARM_BELOW` with suit air, or suit air ≤ `EVA_AIR_LOW_FRAC` (25%) | 0.5% | panic 6, freeze 2 |
| Blackout | Own tile `light` < `LIGHT_DARK_BELOW` (40) for ≥ 3 min (counter `m.dark`) | 0.2% | isolation 3, panic 1, despair 1 |
| Exhaustion | Rest < 10 or hunger 0 | 0.2% | refusal 4, despair 2 |
| Grief | A friend died in the last 10 min (section 6) | 0.5% | despair 6, isolation 3, tantrum 1 |
| Low mood only | No stressor, base > 0 | — | refusal 4, tantrum 3, isolation 3, despair 2 |

Ordinary dark, EVA or fighting cost mood only, until a line above is crossed. A phobic crew member at a fire for 2
minutes breaks with about 25% odds, never surely.

### Outcomes

| Break | Tier | Does | Duration | Log / alert |
|---|---|---|---|---|
| Panic | severe | Executor machine `break`, state `Flee` (`fight/flee.ts` `fleePath` away from the stressor's tiles), then `Cower` in place | 30–60 s | Urgent alert, clickable: "Kel panicked and fled the fire." |
| Freeze | severe in combat, else moderate | `break/Freeze`: stands still, holds nothing (`abortTask` reason `breakdown`) | 10–20 s | Combat: alert. Else log. |
| Hide | moderate | `break/Hide`: walk to the nearest tile no hostile can see (`fight/rescue.ts` `hiddenFrom`), stay | up to 60 s | Log |
| Tantrum | moderate | `break/Sulk` in place; crew within 7 tiles get "made a scene" −3 for 5 min (−5 to relations with section 6) | 60–90 s | Log |
| Despair | moderate | `break/Lie`: lies down where they stand (to their bed if it's within 15 tiles), eats only at `HUNGER_EAT_URGENT` | 3–5 min | Log |
| Work refusal | mild | Work drive scored 0: no jobs; needs, survival and drafts work | 2–4 min | Log |
| Isolation | mild | Work drive 0; leisure walks go to the reachable room with the fewest crew | 2–3 min | Log |

Durations roll from a fourth salt. AI integration (`CREW_AI.md` sections 4 and 5), with one path writer throughout:

| Step | Rule |
|---|---|
| Start | `systems/breakdown.ts` adds `BreakdownC`, then for an interrupt tier calls `abortTask(sim, id, 'breakdown')` first (path cleared, haul load spilled, bed claim and job released, as for `drafted`), like any code that takes over a path. `moodSystem` runs before `equipSystem` and `interruptSystem` (`pipeline.ts`), so the same tick `interruptSystem` sets `Interrupt { breakdown, owner: executor }`. |
| Run | The executor starts a jobless `break` Task (`setJoblessTask(sim, id, 'idle', 'break', state)`), class `hold`, and `steerSystem` steps it under its own Interrupt, as it does `escape` under `hazard`. Utility and scheduler skip the crew member. |
| Hazard | `hazard` (higher) aborts the `break` Task and runs `escape`; `BreakdownC` stays and its timer runs. When the Interrupt falls back to `breakdown`, the executor rebuilds the `break` Task from `BreakdownC` (state from `kind`; Flee re-plans from where they stand). No stacked frame. |
| Draft | Severe: `drafted` sits lower, so orders wait. Moderate: drafting ends the break (`BreakdownC` removed; the draft takes over through its usual `abortTask`). |
| End | `breakdown.ts` removes `BreakdownC`; the Interrupt lapses at the next `interruptSystem`, the `break` Task ends, and the scheduler takes the crew member back that tick. |

| Rule | Value |
|---|---|
| `BreakdownC { kind, tier, context, until, since }` | The running break, removed when it ends. Optional component: no `SAVE_VERSION` bump. |
| `BreakMemoryC { last, byContext }` | Ticks of the last break and of the last break per context: outlives `BreakdownC`, saved, so cooldowns survive recovery and save/load. |
| End | `until` reached, or the context is gone for 10 s (fire out, hostiles dead), or downed. A low-mood break runs its full duration. Survival suspends a break; the timer runs on. |
| Recovery | Mood "let it out" +5 for 5 min; the stressor counters reset. |
| Cooldown | From `BreakMemoryC`: no new break for 10 min, and not from the same context for 20 min. Survival is never on cooldown. |
| Alerts | At most one urgent break alert per crew member per 10 min; a second severe break on the same ship within 60 s goes to the log only. Every break is logged; alerts clear when the break ends. |
| Events | `crew.break { kind, context }`, `crew.breakEnded`: output only. |

### Traits

| Trait | Susceptibility and stressors | Outcome weights |
|---|---|---|
| Brave | Combat ×0 | panic, freeze, hide ×0 |
| Coward | Combat ×1.5 (keeps its hp flee and surrender: fight code) | hide, panic ×3 |
| Protective | Combat ×0.5 with a friend within 6 tiles; grief ×1.5 | — |
| Thrill-seeker | Combat, decompression ×0 | — |
| Stoic / Sensitive | All ×0.5 / ×1.5 | — |
| Cheerful / Gloomy | All ×0.8 / ×1.2 | despair ×2 (Gloomy) |
| Workaholic / Lazy | Exhaustion ×1.5 / — | refusal ×0 / ×2 |
| Loner / Social | Grief ×0.75 / ×1.25 | isolation ×2 / ×0.5 |
| Hot-headed | — | tantrum ×3 |
| Void-born / Dark-adapted | Decompression ×0.5 / blackout ×0 | — |

### Phobias

A phobia discourages; it never refuses. Avoidance is a pick penalty like `EVA_JOB_PENALTY` (30 tiles), added to the
score *within* a priority level: `pickJob` (`ai/legacyPick.ts`) walks levels 1 to 4 and takes the best job of the first
level that has one, so the penalty only reorders jobs of the same level and never moves work across the player's
priorities. In #194 Phase 2 it is a cost term after `level` in the tuple, so the job goes to someone else at that level
when someone can take it. Drafts and `man.ts` orders skip it.

| Trait | Avoids (`PHOBIA_JOB_PENALTY` 30) | Mood | Break |
|---|---|---|---|
| Pyrophobic | `extinguish`, and job sites within 3 tiles of fire | "fire nearby" −6 with fire within 6 tiles | Fire ×4, counted within 6 tiles |
| Space-sick | Jobs whose walk is thin (`planSiteWalk` `thin`, EVA) | "spacewalk" −4 while suited outside | Decompression ×3; plain EVA adds nothing |
| Afraid of the dark | — | "dark" −10 (not −5) | Blackout ×3, counted from 1 min |
| Battle-shy | Job sites with a hostile within 8 tiles | "under fire" −6 with a hostile in sight | Combat ×4, counted from 10 s; freeze, hide ×2 |

Touches: 5a `ai/legacyPick.ts`, `crew/traitMood.ts`, `crew/mood.ts`. 5b `crew/breakdown.ts` and `systems/breakdown.ts`
(new, with `BreakMemoryC`), `pipeline.ts`, `ai/{interrupt,types,classes,policy}.ts`, `ai/machines/break.ts` (new), `events.ts`,
`app/logText.ts`, alerts, the crew inspector. Size: 5a **S** (now); 5b **M**, after #194 makes the interrupt layer
authoritative and adds `hazard` (Phase 3). Mild breaks alone could go through `policy.legacy` earlier (a work flag off while `BreakdownC` holds one).

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
| Grief | A friend's `DeadC` (seen by the system, not the event): "grieving" −15 for 10 min (Protective ×1.5), and the grief stressor (section 5) |

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
| Crew card (`src/ui/CrewInspector.svelte`) | Trait chips under the name, coloured by kind (behaviour, phobia/habit, trade-off, texture); hover shows the effect line. Skills: rolled base, `+n` from XP, a thin bar to the next level. An active break in Status's conditions ("Isolation, 1:20 left"). Bonds: friends and rivals with names. Phobia, craving and grief moods are factors in the mood breakdown. |
| Crew bar (`CrewBar.svelte`) | Urgent state only: an icon for a break or withdrawal. |
| Crew screen roll (#238) | Per member: portrait, editable name, fixed role, skill pips against the role baseline (filled = baseline, bright = above, hollow = below), trait chips, Talented or Green. Reroll one or all (section 1). |
| Ship's log (`app/logText.ts`) | Bonds formed, shouting matches, every break and its end, cravings, habit kicked, level-ups ("Mara's repair is now 4."). |
| Alerts | Severe breaks only (panic; a combat freeze), throttled (section 5); withdrawal. |

## 9. Build order

| Step | Piece | Size | Notes |
|---|---|---|---|
| 1 | Crew-generation RNG, budget-first skill rolls, `RolledSkillsC` | S | built (#243) |
| 2 | `TraitDef`, `TraitsC`, roll, `traitModifiers`; texture, trade-off and simple-hook behaviour traits (Brave, Coward minus breaks, Workaholic, Lazy, Thrill-seeker, Stoic, Sensitive, Cheerful, Gloomy, Loner/Social mood half) | M | built (#243); others `rollable: false` |
| 3 | Crew card and crew screen roll | M | built (#246, #249) |
| 4 | Work-based XP: `grantXp`, curve, grant points, recruit and save handling | S/M | built (#251) |
| 5a | Phobia pick penalties and mood factors; Pyrophobic, Space-sick, Afraid of the dark rollable; rename `trait.void_fear` ("Afraid of the void", `rollable: false` today) to `trait.space_sick`, with its name and short line | S | buildable now |
| 5b | Mental breaks: `BreakdownC`, `BreakMemoryC`, check and stressors, `break` machine, work-drive suppression, trait weights; Battle-shy rollable; effect lines gain their break parts | M | after #194's `hazard` interrupt (Phase 3) |
| 6 | Relationships; Hot-headed, Peacemaker, Protective rollable; Loner/Social bond half | L | |
| 7 | Addictions; Drinker, Stim-hooked rollable | M/L | |

Save: `RolledSkillsC`, `TraitsC`, `BreakdownC`, `BreakMemoryC`, `RelationsC`, `AddictionC` are optional components (and optional `MoodC` counters); old saves load with
role skills and no traits. Step 4 changed what `SkillXpC` means (`SAVE_VERSION` 73, no migration).
