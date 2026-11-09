import { describe, expect, it } from 'vitest';
import {
  AssignmentC, CrewC, IntentC, JobC, NeedsC, PositionC, PrioritiesC, ShipC, Struct, SuitC, TaskC, homeShip, newGame, shipGrid,
  type Sim,
} from '../../sim';
import { airLines } from '../../sim/ai/airNeed';
import { AwayC } from '../../sim/away/components';
import { nextEvalTick } from '../../sim/ai/stagger';
import { isSettled } from '../../sim/crew/helpers';
import { deserialize, serialize } from '../../sim/save';
import { EVAL_TICKS } from '../../sim/tuning';
import { content } from '../index';
import { landed, play } from './awayFixture';

/**
 * The evaluation stagger (ai/stagger.ts, docs/CREW_AI.md section 4): drives are scored in full once per EVAL_TICKS, staggered by id, and at
 * once on what must not wait. Each case below strikes right after the crew member's evaluation, the worst moment for a stagger.
 */

const step = (sim: Sim, n = 1): void => {
  for (let i = 0; i < n; i++) {
    sim.step();
    sim.events.drain();
  }
};
const colonists = (sim: Sim): number[] => sim.world.query(CrewC).filter((c) => sim.world.has(c, PrioritiesC));
const nextEval = (sim: Sim, c: number): number => sim.world.get(c, IntentC)?.nextEval ?? -1;

/** Mark crew member `c`'s scores; a full evaluation rewrites them, so `evaluated` tells whether one ran since. */
const mark = (sim: Sim, c: number): void => {
  const i = sim.world.get(c, IntentC)!;
  i.scores = i.scores.map(() => -7);
};
const evaluated = (sim: Sim, c: number): boolean => !sim.world.get(c, IntentC)!.scores.every((v) => v === -7);

/** Step until crew member `c` has just been evaluated: the stagger's longest wait lies ahead. */
function afterEval(sim: Sim, c: number): void {
  mark(sim, c);
  for (let i = 0; i < 3 * EVAL_TICKS && !evaluated(sim, c); i++) step(sim);
  expect(evaluated(sim, c)).toBe(true);
}

/** Ticks until `cond` holds, stepping one at a time (at most `max`; `max + 1` when it never does). */
function ticksUntil(sim: Sim, max: number, cond: () => boolean): number {
  for (let i = 0; i <= max; i++) {
    if (cond()) return i;
    step(sim);
  }
  return max + 1;
}

/** The starter ship, crew settled and idle (no jobs posted). */
function quiet(seed = 1): { sim: Sim; c: number } {
  const sim = newGame(seed, content, 'ship.starter', false);
  step(sim, 40);
  const free = colonists(sim).filter((id) => !sim.world.has(id, AssignmentC));
  const c = (free.find((id) => isSettled(sim.world.get(id, PositionC)!)) ?? free[0]) as number;
  return { sim, c };
}

describe('crew evaluation stagger', () => {
  it('an idle crew member is evaluated once per EVAL_TICKS, on their own staggered tick', () => {
    const { sim, c } = quiet();
    afterEval(sim, c);
    const evals: number[] = [];
    for (let i = 0; i < 10 * EVAL_TICKS; i++) {
      const t = sim.tick;
      mark(sim, c);
      step(sim);
      if (evaluated(sim, c)) evals.push(t);
    }
    // Wander walks start and end tasks (a wake each); otherwise every evaluation is on the crew member's staggered tick.
    expect(evals.length).toBeLessThanOrEqual(10 + 4);
    expect(evals.filter((t) => (t + c) % EVAL_TICKS === 0).length).toBe(10);
    expect(nextEval(sim, c)).toBe(nextEvalTick(evals[evals.length - 1] as number, c));
  });

  it('a need crossing its line waits at most EVAL_TICKS for the evaluation', () => {
    const { sim, c } = quiet();
    afterEval(sim, c);
    sim.world.get(c, NeedsC)!.rest = 15; // under the sleep line (20), above its urgent line (5): not urgent
    const n = ticksUntil(sim, 3 * EVAL_TICKS, () => sim.world.get(c, IntentC)!.drive === 'sleep');
    expect(n).toBeLessThanOrEqual(EVAL_TICKS);
  });

  it('a need gone urgent right after an evaluation is answered at once', () => {
    const { sim, c } = quiet();
    afterEval(sim, c);
    sim.world.get(c, NeedsC)!.hunger = 5; // starving: urgent and harmful at zero
    sim.world.get(c, NeedsC)!.rest = 100;
    const n = ticksUntil(sim, 3 * EVAL_TICKS, () => sim.world.get(c, IntentC)!.drive === 'eat' || (sim.world.get(c, IntentC)!.urgent ?? 0) !== 0);
    expect(n).toBeLessThanOrEqual(1);
  });

  it('fire under a sleeper right after an evaluation: they are up and walking off at once', () => {
    const { sim, c } = quiet();
    sim.world.get(c, NeedsC)!.rest = 5;
    for (let i = 0; i < 400 && sim.world.get(c, CrewC)!.activity !== 'sleeping'; i++) step(sim);
    expect(sim.world.get(c, CrewC)!.activity).toBe('sleeping');
    afterEval(sim, c);
    const p = sim.world.get(c, PositionC)!;
    const grid = shipGrid(sim, homeShip(sim))!;
    const t = { x: p.x, y: p.y };
    let n = 0;
    for (; n < 3 * EVAL_TICKS && sim.world.get(c, TaskC)?.machine !== 'escape'; n++) {
      grid.set('fire', t.x, t.y, 200);
      step(sim);
    }
    expect(n).toBeLessThanOrEqual(2); // the hazard guard runs every tick, before any evaluation
  });

  it('an assigned job vanishing right after an evaluation: the next tick drops it and evaluates', () => {
    const { sim } = quiet(3);
    const job = sim.world.createEntity(); // long work on a floor tile inside: no suit, no thin air
    const p = sim.world.get(colonists(sim)[0] as number, PositionC)!;
    sim.world.add(job, JobC, { category: 'construction', kind: 'deconstruct', x: Math.round(p.x) + 1, y: Math.round(p.y), struct: 0, work: 1e7, progress: 0, reservedBy: 0 });
    let c = 0;
    for (let i = 0; i < 2000 && !c; i++) {
      step(sim);
      c = sim.world.query(CrewC).find((id) => sim.world.get(id, AssignmentC)?.jobId === job && sim.world.get(id, CrewC)!.activity === 'working') ?? 0;
    }
    expect(c).toBeGreaterThan(0);
    afterEval(sim, c);
    sim.world.destroyEntity(job);
    step(sim);
    expect(sim.world.has(c, AssignmentC)).toBe(false);
    mark(sim, c);
    const t = sim.tick;
    step(sim); // the task context changed: evaluated now, not at the staggered tick
    expect(evaluated(sim, c)).toBe(true);
    expect((t + c) % EVAL_TICKS).not.toBe(0);
  });

  it('a suit tank gone critical right after an evaluation: the refill starts at once', () => {
    const sim = newGame(3, content, 'ship.starter', false);
    step(sim, 2);
    const ship = homeShip(sim);
    const s = sim.world.get(ship, ShipC)!;
    sim.enqueue({ type: 'debug.giveItems', item: 'item.metal', count: 50 });
    sim.enqueue({ type: 'job.build', ship, x: s.x + 3, y: s.y, struct: Struct.Wall });
    step(sim, 2);
    const job = sim.world.query(JobC).find((j) => sim.world.get(j, JobC)!.kind === 'build') as number;
    sim.world.get(job, JobC)!.work = 1e7;
    let c = 0;
    for (let i = 0; i < 3000 && !c; i++) {
      step(sim);
      const w = sim.world.query(CrewC).find((id) => sim.world.get(id, AssignmentC)?.jobId === job && sim.world.get(id, CrewC)!.activity === 'working') ?? 0;
      if (w && sim.world.has(w, SuitC)) c = w;
    }
    expect(c).toBeGreaterThan(0);
    afterEval(sim, c);
    sim.world.get(c, SuitC)!.air = airLines(sim, c, 0).critical / 2;
    const refill = (): boolean => sim.world.get(sim.world.get(c, AssignmentC)?.jobId ?? 0, JobC)?.kind === 'refill';
    expect(ticksUntil(sim, 3 * EVAL_TICKS, refill)).toBeLessThanOrEqual(1);
    expect(sim.world.get(c, SuitC)!.air).toBeGreaterThan(0);
  });

  it('an away recall right after an evaluation turns the party for home at once', () => {
    const { sim, wreck, party } = landed();
    for (const c of party) expect(sim.world.has(c, AwayC)).toBe(true);
    afterEval(sim, party[0] as number);
    sim.enqueue({ type: 'away.recall', ship: wreck });
    play(sim, 2);
    for (const c of party) expect(sim.world.get(c, IntentC)!.drive).toBe('return');
  });

  it('a save and load at any tick plays on identically to the uninterrupted run', () => {
    const T = 900;
    const ref = newGame(2, content, 'ship.starter', true);
    step(ref, T);
    for (const at of [7, 133, 418]) {
      const sim = newGame(2, content, 'ship.starter', true);
      step(sim, at);
      const loaded = deserialize(serialize(sim), content);
      step(loaded, T - at);
      expect(serialize(loaded)).toBe(serialize(ref));
    }
  });
});
