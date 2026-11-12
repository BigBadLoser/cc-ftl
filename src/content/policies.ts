import type { DriveDef, PolicyDef } from '../sim';

/**
 * Crew AI policies (docs/CREW_AI.md section 8): which drives a kind of crew member has and how each scores, interpreted by
 * the utility engine (`src/sim/ai/utility.ts`). Inputs are in tenths of a need's 0..100 scale; scores are per mille; an equal
 * score goes to the drive listed first.
 *
 * These reproduce the Phase 2 thresholds exactly: sleep below rest 20, eat below hunger 35 (a trait may move it), a robot
 * heads for its bay when its battery is low or it is damaged and a repair item is aboard. A crew member holding a console,
 * or a Workaholic, holds out until rest 5 or hunger 10 (`urgent`). Needs outrank work and none is latched past its threshold.
 * Every kind walks off a tile that harms it (`escapeHazards`, the hazard interrupt).
 * A colonist's schedule block (#412, crew/schedule.ts) moves some drives (`blocks`): Sleep puts them to bed, Free gives breaks and no
 * jobs, Work no breaks; while they are on call (a fight, an emergency) every block reads as Work.
 * Colonists also take a break when their mood is low and there is nothing to do (`leisure`, below work). Everyone who breathes refills
 * a suit's tank before it runs low (`air`, first: survival).
 */

/**
 * Rest below 20: drop everything and sleep (in a bed when one can be reached, else where standing). In a Sleep block (#412) it is on
 * whatever rest reads, at 900: under a hungry crew member's meal (1000), so they eat before bed, and over work.
 */
const sleep = {
  id: 'sleep', input: 'rest', curve: [[0, 1000]], enter: 200, urgent: { below: 50 }, blocks: { sleep: { on: 900 } }, task: 'sleep',
} satisfies DriveDef;

/**
 * Hunger below 35: walk to a galley (or a crate with food) and eat. A trip under way is finished whatever hunger reads. With no food aboard the
 * drive is closed (a sleeper is not woken for a meal that cannot start). In a Free block (#412) below 60: supper before bed.
 */
const eat = {
  id: 'eat', input: 'hunger', curve: [[0, 1000]], enter: 350, enterTrait: 'eatBelow', urgent: { below: 100 }, harmsAtZero: true, requires: ['food'], keepWhileTask: true,
  blocks: { free: { enter: 600 } }, task: 'eat',
} satisfies DriveDef;

/**
 * Health under 70%, with a free recovery pod aboard: walk to it and lie in it until healed (runs the sleep machine's bed walk, to a pod only; crew/recovery.ts).
 * Over work, under the survival needs; with no pod the drive is closed.
 */
const recover = {
  id: 'recover', input: 'health', curve: [[0, 800]], enter: 700, exit: 1000, requires: ['pod'], task: 'sleep',
} satisfies DriveDef;

/** A battery robot whose battery is low, or which is damaged with a repair item aboard, goes to its bay. */
const recharge = {
  id: 'recharge', input: 'robotUpkeep', curve: [[0, 1000]], enter: 1, task: 'charge',
} satisfies DriveDef;

/**
 * Mood below 40: with nothing to do, take a break in the mess (or beside a crewmate) until mood is back above 55. It scores
 * under work, so it is only tried once the scheduler has found no job: a break never keeps anyone from work.
 */
const leisure = {
  id: 'leisure', input: 'mood', curve: [[0, 90]], enter: 400, exit: 550, blocks: { work: 'off', sleep: 'off', free: { on: 90 } }, task: 'leisure',
} satisfies DriveDef;

/**
 * A suited crew member whose tank drains (#286): refill below the larger of 30% of a tank and 1.5 x the travel time to the nearest
 * source + 30 s (`airMargin` 1000), critical below the larger of 10% and 1.2 x + 10 s (500), when it overrides every task, a carried
 * patient included. The refill nests: the job is kept and resumed. With no source in reach the drive is blocked (the pickup request).
 */
const air = {
  id: 'air', input: 'airMargin', curve: [[0, 1000]], enter: 1000, urgent: { below: 500, breaksFinish: true }, harmsAtZero: true,
  requires: ['airSource'], onMissing: 'block', keepWhileTask: true, task: 'eva',
} satisfies DriveDef;

/**
 * An away crew member (#286) heads back aboard their site's shuttle to go home: due when tired, hungry or low on charge (rest 25, hunger
 * 35, charge 30: above the sleep, eat and charge drives, which it outranks on a tie, so they get home before they drop), urgent when hurt,
 * when the site closes or a fight starts. Absent anywhere but on their site. Robots have it too: the needs they lack are satisfied.
 */
const goHome = {
  id: 'return', input: 'awayReturn', curve: [[0, 1000]], enter: 1000, urgent: { below: 500 }, task: 'return',
} satisfies DriveDef;

/** Work whenever no need wants the crew member: the scheduler finds them a job. */
const work = { id: 'work', curve: [[0, 100]], task: 'job' } satisfies DriveDef;

/** A colonist works as `work`, unless a mild mental break (work refusal, isolation) holds them: then the drive scores 0 and the scheduler gives them no job. */
const willingWork = { id: 'work', input: 'willing', curve: [[0, 0], [1, 100]], blocks: { sleep: 'off', free: 'off' }, task: 'job' } satisfies DriveDef;

export const policies = {
  'policy.robot': { id: 'policy.robot', crew: ['robot'], escapeHazards: true, drives: [goHome, recharge, work] },
  'policy.colonist': { id: 'policy.colonist', crew: ['colonist'], escapeHazards: true, drives: [air, goHome, sleep, eat, recover, willingWork, leisure] },
  // Station crew get hungry and eat too; the hunger floor that keeps them from starving is the needs system's.
  'policy.station': { id: 'policy.station', crew: ['station'], escapeHazards: true, drives: [air, sleep, eat, work] },
  // A lodging guest (a passenger, consent/components.ts `lodge`) lives aboard as the crew do (sleep, meals, a break when low), and works as their grant and
  // priorities say (a passenger's chores).
  'policy.guest': { id: 'policy.guest', crew: ['guest'], escapeHazards: true, drives: [air, sleep, eat, recover, willingWork, leisure] },
  // Enemy ship crew tire but have no hunger.
  'policy.npc': { id: 'policy.npc', crew: ['npc'], escapeHazards: true, drives: [air, sleep, work] },
} satisfies Record<string, PolicyDef>;
