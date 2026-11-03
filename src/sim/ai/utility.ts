import { HealthC, MoodC, NeedsC, PositionC } from '../crew/components';
import { foodOn } from '../crew/eating';
import { traitEffect, traitFlag } from '../crew/traits';
import { SuitC } from '../eva/components';
import { suitDef } from '../eva/suit';
import { AllegianceC } from '../fight/components';
import { shipIdOf } from '../regions';
import { wantsBay } from '../robots/bay';
import { speciesOf } from '../robots/core';
import type { Sim } from '../sim';
import { StationCrewC } from '../stations/components';
import { airMargin, airSourceInput } from './airNeed';
import { awayReturn } from '../away/crew';
import { IntentC } from './components';
import type { CrewKind, DriveDef, DriveId, DriveInput, Intent, MachineId, PolicyDef } from './types';

/**
 * The utility engine (docs/CREW_AI.md sections 4 and 8): one interpreter for every policy in content (`content/policies.ts`).
 * Per crew member it reads each drive's input, scores it on the drive's curve, applies the drive's latch, urgency, `requires`
 * and the class of the task under way, writes `Intent`, and ranks the drives that may act. The caller (the scheduler's turn)
 * tries them in that order: a need whose task cannot start (no bay, no food) falls through to the next, and `work` hands the
 * crew member to the job scheduler. All scores are integers; nothing here draws on the RNG.
 */

/** Content with no policies: every crew member only works. */
export const NO_POLICY: PolicyDef = { id: 'policy.none', crew: [], drives: [{ id: 'work', curve: [[0, 100]], task: 'job' }] };

const tenths = (v: number): number => Math.floor(v * 10);

/** The input readers. A need is read in tenths of its 0..100 scale; `undefined` when the crew member has no such need. */
const INPUTS: Record<DriveInput, (sim: Sim, id: number) => number | undefined> = {
  rest: (sim, id) => {
    const n = sim.world.get(id, NeedsC);
    return n ? tenths(n.rest) : undefined;
  },
  hunger: (sim, id) => {
    const h = sim.world.get(id, NeedsC)?.hunger;
    return h === undefined ? undefined : tenths(h);
  },
  charge: (sim, id) => {
    const c = sim.world.get(id, NeedsC)?.charge;
    return c === undefined || !speciesOf(sim, id)?.charge ? undefined : tenths(c);
  },
  /** A battery robot's upkeep: 0 when it wants its bay (battery low, or damaged with a repair item aboard), else 1000. */
  robotUpkeep: (sim, id) => (speciesOf(sim, id)?.charge ? (wantsBay(sim, id) ? 0 : 1000) : undefined),
  health: (sim, id) => {
    const h = sim.world.get(id, HealthC);
    return h && h.max > 0 ? Math.floor((h.hp * 1000) / h.max) : undefined;
  },
  /** A worn suit's tank, per mille. */
  air: (sim, id) => {
    const s = sim.world.get(id, SuitC);
    return s?.air === undefined ? undefined : Math.floor((s.air * 1000) / suitDef(sim).airSec);
  },
  /** Air left against the drive's travel-time thresholds (ai/airNeed.ts): absent unless a suited tank drains. */
  airMargin,
  /** An air source can be reached (1000) or not (0); absent unless a suited tank drains. */
  airSource: airSourceInput,
  /** An away crew member wants home: 0 now (closing, a fight, hurt), 500 due (tired, hungry), 1000 not (away/crew.ts); absent off a site. */
  awayReturn,
  mood: (sim, id) => {
    const m = sim.world.get(id, MoodC);
    return m ? tenths(m.value) : undefined;
  },
  /** Food in the crew member's ship's storage: 1000 or 0. */
  food: (sim, id) => {
    const pos = sim.world.get(id, PositionC);
    return pos && foodOn(sim, shipIdOf(sim, pos)) ? 1000 : 0;
  },
};

/** Read one drive input for a crew member. */
export const readInput = (sim: Sim, id: number, input: DriveInput): number | undefined => INPUTS[input](sim, id);

/** An integer piecewise-linear curve at `x` (flat beyond its ends; integer division truncates). */
export function curveAt(curve: readonly (readonly [number, number])[], x: number): number {
  const first = curve[0];
  if (!first) return 0;
  if (x <= first[0]) return first[1];
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i] as [number, number];
    if (x > x1) continue;
    const [x0, y0] = curve[i - 1] as [number, number];
    return x1 === x0 ? y1 : y0 + Math.trunc(((y1 - y0) * (x - x0)) / (x1 - x0));
  }
  return (curve[curve.length - 1] as [number, number])[1];
}

/** Which kind of crew member this is, for picking a policy. */
export function crewKind(sim: Sim, id: number): CrewKind {
  if (speciesOf(sim, id)?.charge) return 'robot';
  if (sim.world.has(id, StationCrewC)) return 'station';
  return sim.world.get(id, AllegianceC)?.faction === 'player' ? 'colonist' : 'npc';
}

const byKind = new WeakMap<object, Map<CrewKind, PolicyDef>>();

/** The policy a crew member runs: the first in content order that lists their kind, else `NO_POLICY`. */
export function policyOf(sim: Sim, id: number): PolicyDef {
  const all = sim.content.policies;
  if (!all) return NO_POLICY;
  let m = byKind.get(all);
  if (!m) {
    m = new Map();
    for (const p of Object.values(all)) for (const k of p.crew) if (!m.has(k)) m.set(k, p);
    byKind.set(all, m);
  }
  return m.get(crewKind(sim, id)) ?? NO_POLICY;
}

/** A policy by id (the inspector's view of `Intent.scores`). */
export const policyById = (sim: Sim, id: string): PolicyDef => (id === NO_POLICY.id ? NO_POLICY : sim.content.policies?.[id] ?? NO_POLICY);

/** What the caller knows about the crew member's task: the class gates and the drive's own task under way. */
export interface TaskView {
  /** They hold a console (a `hold` task): only urgent drives move them. */
  atPost: boolean;
  /** Is a task of this machine under way (`keepWhileTask`)? */
  underway: (machine: MachineId) => boolean;
  /** Are they in a `finish` task (carrying a patient)? Asked only when some need wants them, as it is the rare case. */
  finishing: () => boolean;
}

/** One drive's state in an evaluation. */
interface Scored {
  def: DriveDef;
  i: number;
  score: number;
  urgent: boolean;
  /** May act this tick (not damped, blocked or held back by the task's class). */
  open: boolean;
}

/** Score one drive, updating its latch bit. */
function scoreDrive(sim: Sim, id: number, def: DriveDef, i: number, intent: Intent, driven: boolean, view: TaskView): Scored {
  const bit = 1 << i;
  const x = def.input ? readInput(sim, id, def.input) : 0;
  const busy = !!def.keepWhileTask && def.task !== 'job' && view.underway(def.task);
  if (x === undefined && !busy) {
    intent.latched = (intent.latched ?? 0) & ~bit;
    return { def, i, score: 0, urgent: false, open: false };
  }
  const v = x ?? 0;
  const urgent = !!def.urgent && v < def.urgent.below;
  let on = true;
  if (def.urgent && driven) on = urgent; // a driven crew member answers only the urgent part of a drive
  else if (def.enter !== undefined) {
    const trait = def.enterTrait ? traitEffect(sim, id, def.enterTrait) : undefined;
    const enter = trait !== undefined ? tenths(trait) : def.enter;
    const exit = Math.max(enter, def.exit ?? enter); // a trait moves the entry; a configured exit still holds, never below it
    on = ((intent.latched ?? 0) & bit) !== 0 ? v < exit : v < enter;
  }
  if (def.enter !== undefined) intent.latched = on ? (intent.latched ?? 0) | bit : (intent.latched ?? 0) & ~bit;
  return { def, i, score: on || busy ? curveAt(def.curve, v) : 0, urgent, open: true };
}

/**
 * Evaluate a crew member's policy: write `Intent` (policy, scores, latches, `blocked`) and return the drives that may act, best
 * first. A drive kept by `minDwell` or `margin` stays ahead of a challenger that does not clear them; an urgent challenger
 * ignores both. `Intent.drive` is left to `serveDrive`, which the caller calls with the drive it actually served.
 */
export function evaluateIntent(sim: Sim, id: number, view: TaskView): DriveDef[] {
  const policy = policyOf(sim, id);
  let intent = sim.world.get(id, IntentC);
  if (!intent || intent.policy !== policy.id) {
    intent = { policy: policy.id, drive: 'work', since: sim.tick, scores: policy.drives.map(() => 0), nextEval: sim.tick, latched: 0 };
    sim.world.add(id, IntentC, intent);
  }
  if (intent.avoid && sim.tick >= intent.avoid.until) delete intent.avoid;
  intent.nextEval = sim.tick + 1; // every tick: the drives are cheap to read, and a need is answered the tick it arises
  const driven = view.atPost || traitFlag(sim, id, 'workaholic'); // a Workaholic keeps going like an operator at a console
  const scored = policy.drives.map((d, i) => scoreDrive(sim, id, d, i, intent, driven, view));
  let blocked: DriveId | undefined;
  let finishing: boolean | undefined;
  for (const s of scored) {
    intent.scores[s.i] = s.score;
    if (s.score <= 0) {
      s.open = false;
      continue;
    }
    if (s.def.task === 'job') continue;
    if (s.def.requires?.some((r) => (readInput(sim, id, r) ?? 0) <= 0)) {
      s.open = false;
      if (s.def.onMissing === 'block') blocked ??= s.def.id;
      else intent.scores[s.i] = s.score = 0;
      continue;
    }
    // A carried patient is laid down first; only an urgent drive that declares `breaksFinish` may break in, and only once urgent.
    if (!(s.urgent && s.def.urgent?.breaksFinish) && (finishing ??= view.finishing())) s.open = false;
  }
  if (blocked) intent.blocked = blocked;
  else delete intent.blocked;
  return rank(sim, intent, scored);
}

/**
 * Order the open drives: by score, ties by policy order, except that the current drive stays ahead of every challenger that
 * does not beat it. A challenger ranked above it beats it when urgent, or once `minDwell` has passed and it clears `margin`.
 * So the order is: the challengers that beat it, the current drive, then everyone else, each part by score.
 */
function rank(sim: Sim, intent: Intent, scored: Scored[]): DriveDef[] {
  const open = scored.filter((s) => s.open).sort((a, b) => b.score - a.score || a.i - b.i);
  const at = open.findIndex((s) => s.def.id === intent.drive);
  if (at < 0) return open.map((s) => s.def);
  const cur = open[at] as Scored;
  const dwelling = sim.tick - intent.since < (cur.def.minDwell ?? 0);
  // An urgent drive runs ahead of a current drive that is not urgent however the scores and policy order tie (else a sleeper woken for hunger
  // would just fall asleep again). Between two urgent drives, or two ordinary ones, the current stays unless the usual margin is cleared.
  // Two urgent drives: the one whose need harms at zero goes first (starving before tiredness); neither or both, the current stays.
  const beats = (s: Scored, above: boolean): boolean =>
    (s.urgent && !cur.urgent) || (s.urgent && cur.urgent && !!s.def.harmsAtZero && !cur.def.harmsAtZero) ||
    (above && !cur.urgent && (s.urgent || (!dwelling && s.score >= cur.score + (cur.def.margin ?? 0)))) ||
    (above && cur.urgent && !s.urgent && !dwelling && s.score >= cur.score + (cur.def.margin ?? 0));
  const beaters = open.filter((s, k) => k !== at && beats(s, k < at));
  return [...beaters, cur, ...open.filter((s, k) => k !== at && !beaters.includes(s))].map((s) => s.def);
}

/** Record the drive the crew member is serving this tick. */
export function serveDrive(sim: Sim, id: number, drive: DriveId): void {
  const intent = sim.world.get(id, IntentC);
  if (!intent || intent.drive === drive) return;
  intent.drive = drive;
  intent.since = sim.tick;
}
