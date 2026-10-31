# Crew traits and per-crew skills

Design for #239 (parent #238: the new-game crew screen rolls a crew, so the roll needs something to roll). Design only:
nothing here is built yet. Numbers are starting values for tuning, not promises.

Grounding: every effect below is written against what exists today: the stat resolver (`src/sim/stats.ts`, "traits
and implants plug in later"), role skills (`src/content/roles.ts`, `src/sim/crew/skills.ts`), skill XP
(`src/sim/story/components.ts`), mood (`src/sim/crew/mood.ts`, `src/sim/systems/mood.ts`), needs
(`src/sim/systems/needs.ts`), vitals (`src/sim/systems/vitals.ts`), tile conditions (`src/sim/crew/conditions.ts`),
surrender and fleeing (`src/sim/fight/surrender.ts`, `fighter.ts`, `flee.ts`), and tuning (`src/sim/tuning.ts`).

## 1. Per-crew skill rolls

Today every crew member's skills come straight from the role (`roleSkillModifiers`). That changes to one roll per
crew member, made at creation.

| Rule | Value |
|---|---|
| Where | `createCrew` (`src/sim/crew/spawn.ts`) draws from `sim.rng` after name and appearance, so a seed always gives the same crew. A reroll on the crew screen (#238) is a new draw from the same rng stream, which keeps it deterministic. |
| Stored as | New `RolledSkillsC { skills: Partial<Record<SkillName, number>> }`. `roleSkillModifiers` reads it when present and falls back to the role table when absent (robots, aliens, NPC crew, old saves). |
| Core skills (the role's own) | Role value + offset: −1 (20%), 0 (55%), +1 (20%), +2 (5%). Minimum 1. |
| Off-role skills | 0 (70%), 1 (25%), 2 (5%, a "talent"). Rolled for every skill the role lacks. |
| Budget | Sum of all skills must stay within role total −1 to +2. Over budget: trim the highest off-role skill first, then the highest core offset. Under budget: raise the lowest core skill. Stops a crew of all-rounders. |
| Cap | 5 per skill from the roll. XP (`SkillXpC`, 100 xp per level) still stacks on top. |
| Rarity label | Shown on the roll: **Talented** if any off-role skill is 2 or a core skill is role +2; **Green** if every core skill is role −1. Pure label, no effect. |
| Who rolls | Player crew at new game, recruits (`systems/recruits.ts`), rescued crew. NPC crew keep role values for now (cheaper, and their skill is already set by ship tier). |
| Robots, aliens | Unchanged: fixed role values, no roll. |

Example (gunner, role total 3, so budget 2 to 5): gunnery 3 + 1 = 4, piloting 1, rest 0. Total 5: in budget.

## 2. Traits

| Rule | Value |
|---|---|
| Count | 0 traits (25%), 1 (50%), 2 (25%). |
| Draw | Weighted, without replacement, skipping anything excluded by a trait already drawn. Weight: common 10, uncommon 5, rare 2. |
| Who | Mood species (humans) only: player crew, recruits, rescued crew. NPCs later. |
| Stored as | `TraitsC { ids: string[] }`. Content: `src/content/traits.ts`, `satisfies TraitDef`, id `trait.<name>`. |
| Mechanism | A new `traitModifiers` source in `modifierSources` for stat effects (mul/add, like `suit` and `mood`). Non-stat effects are flags on `TraitDef` read by the system that owns the behaviour (mood factors, hunger, surrender, phobias...). Systems still never call each other. |
| Hook column | **stat**: needs only `traitModifiers`. **small**: a few lines in one existing system. **phobia / addiction / relation**: needs that new mechanic (section 3). |

### Trait table

Effects use existing names: stats (`moveSpeed`, `workSpeed`, `restDecay`, `carryCapacity`, skills), mood factors from
`crew/mood.ts`, and tuning constants.

| # | Trait | Flavour | Effect | Weight | Excludes | Hook |
|---|---|---|---|---|---|---|
| 1 | Quick | Walks like the deck is on fire. | `moveSpeed` ×1.15 | 10 | Slow | stat |
| 2 | Slow | Takes the scenic route. | `moveSpeed` ×0.88 | 10 | Quick | stat |
| 3 | Industrious | First to start, last to stop. | `workSpeed` ×1.1 | 10 | Lazy | stat |
| 4 | Lazy | Will get to it. | `workSpeed` ×0.9 | 10 | Industrious | stat |
| 5 | Strong | Carries the crate and the guy on it. | `carryCapacity` ×1.5, `melee` +1 | 5 | Frail | stat |
| 6 | Frail | Bruises on a stiff breeze. | max hp ×0.8, `carryCapacity` ×0.75 | 5 | Strong, Tough | small (max hp in `createCrew`) |
| 7 | Tough | Hard to put down, harder to keep down. | max hp ×1.2; bleed-out time (`BLEED_OUT_SECONDS`) ×1.5 | 5 | Frail | small (vitals bleed timer) |
| 8 | Tireless | Sleeps four hours, means it. | `restDecay` ×0.75 | 5 | Sleepyhead | stat |
| 9 | Sleepyhead | Naps in the airlock. | `restDecay` ×1.3 | 10 | Tireless | stat |
| 10 | Small appetite | Half a ration is plenty. | hunger decay ×0.7 | 5 | Glutton | small (needs.ts hunger mult) |
| 11 | Glutton | Ate your ration too. | hunger decay ×1.4 | 10 | Small appetite | small (needs.ts hunger mult) |
| 12 | Cheerful | Whistles through red alerts. | mood factor "Cheerful" +5 | 10 | Gloomy | small (mood factor) |
| 13 | Gloomy | Knows how this ends. | mood factor "Gloomy" −5 | 10 | Cheerful | small (mood factor) |
| 14 | Loner | Prefers the quiet decks. | no "lonely" (−4); "alone" +3 in its place; no "company" (+3) | 5 | Social | small (mood factor) |
| 15 | Social | Needs someone to talk at. | "company" +6 instead of +3; "lonely" −8 instead of −4 | 5 | Loner | small (mood factor) |
| 16 | Brave | Runs toward the shooting. | fights unarmed like a `fighter` role (no flee); never surrenders; immune to Battle-shy panic | 5 | Coward, Battle-shy | small (`canFight`, `wantsToSurrender`) |
| 17 | Coward | Runs away from the shooting. | flees when hurt (hp < 50%) even when armed; player crew may surrender at hp < 30% (today 0 = never) | 5 | Brave | small (`canFight`, `surrenderBelow`) |
| 18 | Marksman | Never misses twice. | `gunnery` +1 | 5 | Clumsy | stat |
| 19 | Natural pilot | Flies by feel. | `piloting` +1 | 5 | — | stat |
| 20 | Handy | Fixes it with tape and spite. | `repair` +1; build, repair and extinguish jobs ×1.2 work | 5 | Clumsy | small (per-job-kind mult in `ai/work.ts`) |
| 21 | Clumsy | Drops tools. Drops crates. Drops guns. | `melee` −1, `gunnery` −1, `workSpeed` ×0.95 | 5 | Marksman, Handy | stat |
| 22 | Gifted | Learns it once. | skill XP gains ×1.5 | 2 | — | small (`story/effects.ts` XP grant) |
| 23 | Dark-adapted | Grew up on a dim station. | ignores `DARK_MOVE_MULT` and `DARK_WORK_MULT`; no "dark" mood (−5) | 5 | Afraid of the dark | small (`environmentModifiers`, mood) |
| 24 | Void-born | Spacewalks before breakfast. | suit air (`airSec` 240) ×1.5; no suit move penalty (`moveMult` 0.8) | 2 | Afraid of the void | small (suit system) |
| 25 | Hot-headed | Takes it personally. | rivalries form 2× as fast; rival penalty ×1.5 | 5 | Peacemaker | relation |
| 26 | Peacemaker | Everyone's favourite. | friendships form 2× as fast; nearby rivals' penalty halved | 5 | Hot-headed | relation |
| 27 | Drinker | Just one to take the edge off. | addiction to `item.spirits` (see 3.2) | 5 | Stim-hooked | addiction |
| 28 | Stim-hooked | Ran double shifts on a mining rig. | addiction to `item.stims`; while dosed `workSpeed` ×1.1 | 2 | Drinker | addiction |
| 29 | Pyrophobic | Saw a ship burn once. | phobia: fire (see 3.1) | 5 | — | phobia |
| 30 | Afraid of the void | Hates the hum of the hull. | phobia: vacuum and EVA | 5 | Void-born | phobia |
| 31 | Afraid of the dark | Sleeps with the lights on. | phobia: darkness | 5 | Dark-adapted | phobia |
| 32 | Battle-shy | Freezes when the shooting starts. | phobia: combat | 5 | Brave | phobia |

32 traits: 15 positive, 15 negative, 2 neutral (Loner, Social). 24 need only existing hooks (10 stat, 14 small), 8 need a new mechanic.

Balance: total positive weight (84) and negative weight (97) are close, with the mild negatives (Sleepyhead, Glutton,
Gloomy) the most common, so an average crew is about neutral.
The crew screen shows the traits, so a bad roll is a choice the player can reroll, not a hidden trap.

## 3. New mechanics

Each is its own piece of work with its own issue and PR. All state is plain components; all logic in a system listed
in `src/sim/pipeline.ts`.

### 3.1 Phobias (M)

| Trigger | Fires when the crew member... | Read from |
|---|---|---|
| Fire | is within 3 tiles of a burning tile, or is given an `extinguish` job | grid `fire` |
| Vacuum | stands on a tile with `o2` < `O2_HARM_BELOW` (10) or is in a suit outside (EVA) | grid `o2`, suit state |
| Darkness | stands on a tile with `light` < `LIGHT_DARK_BELOW` (40) | grid `light` |
| Combat | has a hostile (per `fight/relations.ts`) in line of sight within 8 tiles | fighter positions, `fight/los.ts` |

| Effect | Rule |
|---|---|
| `FearC { trigger, sec }` | Set while triggered; fades 30 s after the trigger ends. |
| Mood | "Terrified" −15 while `FearC`; "Shaken" −5 for 120 s after. |
| Work | `workSpeed` ×0.6 while afraid (via `traitModifiers` reading `FearC`). |
| Job refusal | `jobFits` refuses jobs whose site trips the phobia: pyrophobe skips `extinguish`; void-phobe skips `suitUp` and EVA jobs; dark-phobe skips sites in the dark. A direct player order still goes through (soft refusal only). |
| Panic | If afraid for over 10 s: flee the trigger with `fleePath` (as unarmed crew flee today) unless drafted. Battle-shy: drafted crew still panic at hp < 50%. |

| Touches | Change |
|---|---|
| `src/sim/crew/phobia.ts` (new), `systems/phobia.ts` (new), `pipeline.ts` | trigger check every 1 s, sets/clears `FearC` |
| `src/sim/crew/mood.ts` | two factors |
| `src/sim/crew/jobFit.ts` | refusal filter |
| `src/sim/fight/flee.ts`, `ai/interrupt.ts` | panic interrupt using `fleePath` |
| `src/sim/events.ts`, `app/logText.ts` | `crew.panicked` |

Size **M**: the triggers read existing grids; panic reuses flee. Risk: panic must not loop with jobs (cooldown).

### 3.2 Addictions (M/L)

| Item | Recipe | Also from | Price |
|---|---|---|---|
| `item.spirits` (new, `food`-like, flammable 0.5) | still (new crafting station) from `item.ration` ×2 + `item.water` | traders, black markets | 12 |
| `item.stims` (new, contraband) | — | black markets, derelict loot | 30 |

| Rule | Value |
|---|---|
| `AddictionC { item, craving, dosedSec }` | Craving rises 0 → 100 over about 10 min. |
| Feeding | Above craving 60, seeks the item like eating (`crew/eating.ts` pattern): walks to a stockpile, consumes 1, craving 0. Uses a new low-priority errand, not a mood hook. |
| Dosed | Drinker: mood "Had a drink" +6 for 120 s. Stim-hooked: `workSpeed` ×1.1 and `restDecay` ×1.2 for 300 s. |
| Withdrawal | Craving 100 and none in reach: mood "Withdrawal" −20, `workSpeed` ×0.8 until fed. |
| Kicking it | 30 min of game time in withdrawal clears the trait (`TraitsC` loses it, log line). Rare and earned. |
| Player control | Item can be forbidden on a stockpile (existing filters), which forces withdrawal. |

| Touches | Change |
|---|---|
| `src/content/items.ts`, `recipes.ts`, `furniture.ts` | two items, recipe, still |
| `src/content/trade.ts`, `galaxyMarket.ts`, `blackMarkets.ts` | sold where |
| `src/sim/crew/addiction.ts` (new), `systems/addiction.ts` (new), `pipeline.ts` | craving, dose timer, withdrawal, kicking |
| `src/sim/crew/eating.ts`, `ai/` errand | consume errand |
| `src/sim/crew/mood.ts` | three factors |
| `events.ts`, `logText.ts` | `crew.craving`, `crew.withdrawal`, `crew.kickedHabit` |

Size **M** without the still (buy only); **L** with the still and its art.

### 3.3 Relationships (L)

| Rule | Value |
|---|---|
| `RelationsC { scores: Record<crewId, number> }` | −100 to +100, sparse; only player crew. |
| Accrual | `systems/relationship.ts` every `MOOD_INTERVAL` (10 s): pairs within `MOOD_COMPANY_RADIUS` (7) drift by +0.5 base; −0.5 if either is in a low mood (< `MOOD_LOW` 35); Hot-headed rolls a 10% chance per tick of −3 instead; Peacemaker doubles the + side. One rng draw per pair, from `sim.rng`. |
| Friend | score ≥ 50. Mood "With a friend" +4 when within 7 tiles; `workSpeed` ×1.05 when working within 3 tiles of a friend. |
| Rival | score ≤ −50. Mood "Near a rival" −6 within 7 tiles. Rival pairs avoid the same table (eating) and beds next to each other (bed picking). |
| Grief | Friend dies: system sees the friend's `DeadC` (not the event), mood "Grieving" −15 for 10 min. |
| Cap | At most 3 friends and 3 rivals each, so the mood stack stays readable. |
| Cost | Pair loop over player crew only (≤ ~20 crew → ≤ 190 pairs every 10 s). Cheap. |

| Touches | Change |
|---|---|
| `src/sim/crew/relationship.ts` (new), `systems/relationship.ts` (new), `pipeline.ts` | scores, accrual, grief |
| `src/sim/crew/mood.ts` | four factors |
| `traitModifiers` | friend work bonus |
| `src/sim/crew/beds.ts`, `systems/bedOwners.ts`, eating spot pick | rival avoidance |
| `src/sim/save.ts` | ID remap of `scores` keys on load (entity IDs in a map) |
| `events.ts`, `logText.ts` | `crew.befriended`, `crew.rivalry`, `crew.grieving` |
| UI | relations list on the crew card |

Size **L**: the system itself is M; entity IDs as map keys need save care, and bed/table avoidance spreads it wide.

## 4. UI

| Where | Shows |
|---|---|
| Crew card (`src/ui/CrewInspector.svelte`) | Trait chips under the name: green positive, amber negative, grey social. Hover: the exact effect line from the trait table (numbers on demand). Skills row: each skill as a number with its rolled base, XP shown as `+n`. Active state (afraid, craving, withdrawal, friends and rivals) as chips beside the mood breakdown, which already lists factors. |
| Crew bar (`CrewBar.svelte`) | Only urgent state: a small icon for "Terrified" or "Withdrawal". No trait chips (too busy). |
| Crew screen roll (#238) | Per member: portrait, name (editable), fixed role, skill pips against the role baseline (filled = baseline, bright = above, hollow = below), trait chips, the **Talented** / **Green** label. Reroll one member or the whole crew. Each reroll is a new `sim.rng` draw. |
| Ship's log (`app/logText.ts`) | Ordinary lines: "Mara and Ivo are friends now.", "Ivo can't stand Petra.", "Kel is craving a drink.", "Kel kicked the habit.". |
| Alerts | Urgent and clickable only: "Kel panicked and fled the fire", "Kel is in withdrawal" (repeat throttled). |

## 5. Build order

| Step | Piece | Size | Needs |
|---|---|---|---|
| 1 | Skill rolls: `RolledSkillsC`, roll in `createCrew`, `roleSkillModifiers` fallback | S | — |
| 2 | Traits core: `TraitDef`, `src/content/traits.ts`, `TraitsC`, roll, `traitModifiers` source; the 10 **stat** traits | S | 1 |
| 3 | The 14 **small**-hook traits (mood factors, hunger mult, max hp, bleed-out, surrender, fighter, dark, suit, XP, per-job mult) | M | 2 |
| 4 | Crew card UI (chips, skills) and the crew screen roll for #238 | M | 2 (3 for the full list) |
| 5 | Phobias + 4 phobia traits | M | 3 |
| 6 | Addictions + Drinker, Stim-hooked (buy-only first, still later) | M, then L | 3 |
| 7 | Relationships + Hot-headed, Peacemaker | L | 3 |

Steps 1 to 4 unblock #238. Until steps 5 to 7 land, their traits are left out of the roll (a `rollable: false` flag on
the def), so no crew carries a trait that does nothing.

Save: `RolledSkillsC`, `TraitsC`, `FearC`, `AddictionC` and `RelationsC` are new optional components. Old saves load
with role skills and no traits; bump `SAVE_VERSION` only if a step changes an existing shape.
