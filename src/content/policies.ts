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
 * Colonists also take a break when their mood is low and there is nothing to do (`leisure`, below work).
 */

/** Rest below 20: drop everything and sleep (in a bed when one can be reached, else where standing). */
const sleep = {
  id: 'sleep', input: 'rest', curve: [[0, 1000]], enter: 200, urgent: { below: 50 }, task: 'sleep',
} satisfies DriveDef;

/** Hunger below 35: walk to a galley (or a crate with food) and eat. A trip under way is finished whatever hunger reads. */
const eat = {
  id: 'eat', input: 'hunger', curve: [[0, 1000]], enter: 350, enterTrait: 'eatBelow', urgent: { below: 100 }, keepWhileTask: true, task: 'eat',
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
  id: 'leisure', input: 'mood', curve: [[0, 90]], enter: 400, exit: 550, task: 'leisure',
} satisfies DriveDef;

/** Work whenever no need wants the crew member: the scheduler finds them a job. */
const work = { id: 'work', curve: [[0, 100]], task: 'job' } satisfies DriveDef;

export const policies = {
  'policy.robot': { id: 'policy.robot', crew: ['robot'], escapeHazards: true, drives: [recharge, work] },
  'policy.colonist': { id: 'policy.colonist', crew: ['colonist'], escapeHazards: true, drives: [sleep, eat, work, leisure] },
  // Station crew get hungry and eat too; the hunger floor that keeps them from starving is the needs system's.
  'policy.station': { id: 'policy.station', crew: ['station'], escapeHazards: true, drives: [sleep, eat, work] },
  // Enemy ship crew tire but have no hunger.
  'policy.npc': { id: 'policy.npc', crew: ['npc'], escapeHazards: true, drives: [sleep, work] },
} satisfies Record<string, PolicyDef>;
