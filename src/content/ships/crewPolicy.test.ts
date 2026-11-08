import { describe, expect, it } from 'vitest';
import { content } from '../index';
import { CrewC, NeedsC } from '../../sim/crew/components';
import { TraitsC } from '../../sim/crew/traits';
import { newGame } from '../../sim/newGame';
import type { ContentRegistry } from '../../sim/registry';
import type { Sim } from '../../sim/sim';
import { IntentC } from '../../sim/ai/components';
import type { DriveDef, PolicyDef } from '../../sim/ai/types';
import { crewKind, curveAt, evaluateIntent, policyOf, serveDrive, type TaskView } from '../../sim/ai/utility';

const work = { id: 'work', curve: [[0, 100]], task: 'job' } satisfies DriveDef;
const idle: TaskView = { atPost: false, underway: () => false, finishing: () => false };

/** A game whose colonists run `drives`; returns the sim and one colonist. */
function game(drives: DriveDef[]): { sim: Sim; c: number } {
  const policy: PolicyDef = { id: 'policy.test', crew: ['colonist'], drives };
  const reg: ContentRegistry = { ...content, policies: { 'policy.test': policy } };
  const sim = newGame(1, reg, 'ship.starter', false);
  const c = sim.world.query(CrewC).find((id) => crewKind(sim, id) === 'colonist') as number;
  return { sim, c };
}

const setRest = (sim: Sim, c: number, rest: number): void => void ((sim.world.get(c, NeedsC) as { rest: number }).rest = rest);

/** Evaluate and serve the top drive, as the scheduler's turn does; returns the drive served. */
function turn(sim: Sim, c: number, view: TaskView = idle): string {
  const top = evaluateIntent(sim, c, view)[0]?.id ?? 'work';
  serveDrive(sim, c, top);
  return top;
}

describe('utility curves', () => {
  it('is integer piecewise-linear, flat beyond its ends, truncating', () => {
    const c: [number, number][] = [[100, 0], [200, 1000], [300, 1000], [400, 1]];
    expect(curveAt(c, 0)).toBe(0);
    expect(curveAt(c, 150)).toBe(500);
    expect(curveAt(c, 101)).toBe(10);
    expect(curveAt(c, 250)).toBe(1000);
    expect(curveAt(c, 399)).toBe(11); // 1000 - 999 * 99 / 100 = 10.99..., truncated toward the line
    expect(curveAt(c, 9999)).toBe(1);
    expect(curveAt([[5, 7]], -3)).toBe(7);
    for (let x = -50; x < 500; x += 7) expect(Number.isInteger(curveAt(c, x))).toBe(true);
  });
});

describe('utility drives', () => {
  const sleep = { id: 'sleep', input: 'rest', curve: [[0, 1000]], enter: 200, exit: 800, task: 'sleep' } satisfies DriveDef;

  it('a latch engages below enter and lets go only at exit, with no flip-flop between', () => {
    const { sim, c } = game([sleep, work]);
    setRest(sim, c, 50);
    expect(turn(sim, c)).toBe('work');
    setRest(sim, c, 19.95);
    expect(turn(sim, c)).toBe('sleep');
    for (const r of [30, 60, 79.9, 25, 79.99]) {
      setRest(sim, c, r);
      expect(turn(sim, c)).toBe('sleep');
    }
    setRest(sim, c, 80);
    expect(turn(sim, c)).toBe('work');
    setRest(sim, c, 50);
    expect(turn(sim, c)).toBe('work'); // above enter again: stays off
    expect(sim.world.get(c, IntentC)!.latched).toBe(0);
  });

  it('every score written is a per-mille integer', () => {
    const graded = { id: 'leisure', input: 'rest', curve: [[0, 900], [1000, 33]], task: 'sleep' } satisfies DriveDef;
    const { sim, c } = game([graded, work]);
    for (const r of [0, 3.33, 41.7, 99.99]) {
      setRest(sim, c, r);
      turn(sim, c);
      const s = sim.world.get(c, IntentC)!.scores;
      expect(s.every((v) => Number.isInteger(v) && v >= 0 && v <= 1000)).toBe(true);
    }
  });

  it('min dwell keeps the current drive against a better challenger until it has passed', () => {
    const graded = { id: 'leisure', input: 'rest', curve: [[0, 900], [1000, 0]], task: 'sleep' } satisfies DriveDef;
    const w = { ...work, curve: [[0, 500]], minDwell: 40 } satisfies DriveDef;
    const { sim, c } = game([graded, w]);
    setRest(sim, c, 80); // leisure 180 < work 500
    expect(turn(sim, c)).toBe('work');
    const since = sim.world.get(c, IntentC)!.since;
    setRest(sim, c, 10); // leisure 810 > work 500
    for (let t = since; t < since + 40; t++) {
      sim.tick = t;
      expect(turn(sim, c)).toBe('work');
    }
    sim.tick = since + 40;
    expect(turn(sim, c)).toBe('leisure');
  });

  it('a challenger must beat the current drive by its margin', () => {
    const graded = { id: 'leisure', input: 'rest', curve: [[0, 1000], [1000, 0]], task: 'sleep' } satisfies DriveDef;
    const w = { ...work, curve: [[0, 500]], margin: 100 } satisfies DriveDef;
    const { sim, c } = game([graded, w]);
    setRest(sim, c, 90);
    expect(turn(sim, c)).toBe('work');
    setRest(sim, c, 41); // leisure 590 < 500 + 100
    expect(turn(sim, c)).toBe('work');
    setRest(sim, c, 39.9); // leisure 601
    expect(turn(sim, c)).toBe('leisure');
  });

  it('an urgent challenger ignores min dwell and margin', () => {
    const s = { ...sleep, curve: [[0, 600]], urgent: { below: 50 } } satisfies DriveDef;
    const w = { ...work, curve: [[0, 500]], minDwell: 1000, margin: 500 } satisfies DriveDef;
    const { sim, c } = game([s, w]);
    setRest(sim, c, 50);
    expect(turn(sim, c)).toBe('work');
    setRest(sim, c, 10);
    expect(turn(sim, c)).toBe('work'); // latched, but held by dwell and margin
    setRest(sim, c, 4.9);
    expect(turn(sim, c)).toBe('sleep');
  });

  it('an urgent challenger beats a dwelling drive even when a stronger, non-urgent one is held back', () => {
    const s = { id: 'sleep', input: 'rest', curve: [[0, 1000]], task: 'sleep' } satisfies DriveDef;
    const e = { id: 'eat', input: 'hunger', curve: [[0, 900]], urgent: { below: 100 }, task: 'eat' } satisfies DriveDef;
    const w = { ...work, curve: [[0, 500]], minDwell: 1000 } satisfies DriveDef;
    const { sim, c } = game([s, e, w]);
    setRest(sim, c, 100);
    const needs = sim.world.get(c, NeedsC) as { rest: number; hunger?: number };
    needs.hunger = 100;
    // Both needs score above work all along (flat curves), so pin the current drive to work by serving it.
    serveDrive(sim, c, 'work');
    expect(evaluateIntent(sim, c, idle).map((d) => d.id)).toEqual(['work', 'sleep', 'eat']); // dwelling: nobody beats it
    needs.hunger = 5; // eat is urgent now; sleep (1000) still is not
    expect(evaluateIntent(sim, c, idle).map((d) => d.id)).toEqual(['eat', 'work', 'sleep']);
  });

  it('a trait threshold moves the entry but keeps a configured exit', () => {
    const e = { id: 'eat', input: 'hunger', curve: [[0, 1000]], enter: 350, exit: 800, enterTrait: 'eatBelow', task: 'eat' } satisfies DriveDef;
    const { sim, c } = game([e, work]);
    sim.world.add(c, TraitsC, { ids: ['trait.glutton'] }); // eatBelow 50
    const needs = sim.world.get(c, NeedsC) as { hunger?: number };
    needs.hunger = 49;
    expect(turn(sim, c)).toBe('eat');
    for (const h of [55, 70, 79.9]) {
      needs.hunger = h;
      expect(turn(sim, c)).toBe('eat'); // still latched: the exit is 80, not the Glutton's 50
    }
    needs.hunger = 80;
    expect(turn(sim, c)).toBe('work');
  });

  it('a driven crew member (console or Workaholic) answers only below urgent', () => {
    const s = { ...sleep, urgent: { below: 50 } } satisfies DriveDef;
    const { sim, c } = game([s, work]);
    setRest(sim, c, 10);
    const post = { ...idle, atPost: true };
    expect(turn(sim, c, post)).toBe('work');
    setRest(sim, c, 4.9);
    expect(turn(sim, c, post)).toBe('sleep');
    setRest(sim, c, 10);
    sim.world.add(c, TraitsC, { ids: ['trait.workaholic'] });
    expect(turn(sim, c)).toBe('work');
  });

  it('a finish task holds every need back unless the drive breaks it', () => {
    const s = { ...sleep, urgent: { below: 50 } } satisfies DriveDef;
    const { sim, c } = game([s, work]);
    const carrying = { ...idle, finishing: () => true };
    setRest(sim, c, 1);
    expect(turn(sim, c, carrying)).toBe('work');
    const { sim: sim2, c: c2 } = game([{ ...s, urgent: { below: 50, breaksFinish: true } }, work]);
    setRest(sim2, c2, 10); // engaged (below enter 20) but not yet urgent (5): the patient still comes first
    expect(turn(sim2, c2, carrying)).toBe('work');
    setRest(sim2, c2, 1);
    expect(turn(sim2, c2, carrying)).toBe('sleep');
  });

  it('requires: damp zeroes the score; block keeps it and names the drive in Intent.blocked', () => {
    const eat = { id: 'eat', input: 'rest', curve: [[0, 1000]], enter: 200, requires: ['charge'], task: 'eat' } satisfies DriveDef;
    const { sim, c } = game([eat, work]);
    setRest(sim, c, 5);
    expect(turn(sim, c)).toBe('work');
    expect(sim.world.get(c, IntentC)!.scores[0]).toBe(0);
    expect(sim.world.get(c, IntentC)!.blocked).toBeUndefined();
    const { sim: sim2, c: c2 } = game([{ ...eat, onMissing: 'block' }, work]);
    setRest(sim2, c2, 5);
    expect(turn(sim2, c2)).toBe('work');
    expect(sim2.world.get(c2, IntentC)!.scores[0]).toBe(1000);
    expect(sim2.world.get(c2, IntentC)!.blocked).toBe('eat');
    setRest(sim2, c2, 50);
    turn(sim2, c2);
    expect(sim2.world.get(c2, IntentC)!.blocked).toBeUndefined();
  });

  it('keepWhileTask holds the drive while its task is under way', () => {
    const eat = { id: 'eat', input: 'rest', curve: [[0, 1000]], enter: 200, keepWhileTask: true, task: 'eat' } satisfies DriveDef;
    const { sim, c } = game([eat, work]);
    setRest(sim, c, 90);
    expect(turn(sim, c, { ...idle, underway: (m) => m === 'eat' })).toBe('eat');
    expect(turn(sim, c)).toBe('work');
  });

  it('a missing input scores 0, ties go to the earlier drive, and content without policies only works', () => {
    const charge = { id: 'recharge', input: 'charge', curve: [[0, 1000]], task: 'charge' } satisfies DriveDef;
    const a = { id: 'sleep', input: 'rest', curve: [[0, 700]], task: 'sleep' } satisfies DriveDef;
    const b = { id: 'leisure', input: 'rest', curve: [[0, 700]], task: 'sleep' } satisfies DriveDef;
    const { sim, c } = game([charge, b, a, work]);
    expect(evaluateIntent(sim, c, idle).map((d) => d.id)).toEqual(['leisure', 'sleep', 'work']);
    const bare = newGame(1, { ...content, policies: undefined }, 'ship.starter', false);
    const c2 = bare.world.query(CrewC)[0] as number;
    expect(policyOf(bare, c2).id).toBe('policy.none');
    expect(evaluateIntent(bare, c2, idle).map((d) => d.id)).toEqual(['work']);
  });
});

describe('content policies', () => {
  it('every crew kind has a policy, and drive ids are unique within each', () => {
    const kinds = new Set(Object.values(content.policies).flatMap((p) => p.crew));
    expect([...kinds].sort()).toEqual(['colonist', 'guest', 'npc', 'robot', 'station']);
    for (const p of Object.values(content.policies)) {
      const ids = p.drives.map((d) => d.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toContain('work');
    }
  });
});
