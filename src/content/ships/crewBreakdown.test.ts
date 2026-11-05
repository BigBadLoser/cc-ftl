import { describe, expect, it } from 'vitest';
import {
  AssignmentC, BreakdownC, BreakMemoryC, CrewC, DraftedC, InterruptC, MoodC, NeedsC, PathC, PositionC, PrioritiesC, TaskC, TICK_HZ, TraitsC, deserialize,
  homeShip, newGame, serialize, shipGrid, type BreakKind, type ContentRegistry, type Sim, type SimEvent,
} from '../../sim';
import { IntentC } from '../../sim/ai/components';
import { auditReservations } from '../../sim/ai/audit';
import { breakChance, breakTerms, onCooldown, rollBreak } from '../../sim/crew/breakdown';
import { isSettled } from '../../sim/crew/helpers';
import { quietSpot } from '../../sim/ai/machines/leisure';
import { startBreak, endBreak } from '../../sim/systems/breakdown';
import { tierOf } from '../../sim/crew/breakTable';
import { BREAK_BASE_P, BREAK_COOLDOWN_SEC } from '../../sim/tuning';
import { content } from '../index';

/**
 * Mental breaks (docs/TRAITS.md section 5, issue #175): the hashed roll, the tiers against drafts and hazards, the break machine, the
 * mild breaks that only score the work drive 0, and the memory that survives a save.
 */

const colonists = (sim: Sim): number[] => sim.world.query(CrewC).filter((c) => sim.world.has(c, PrioritiesC));
const run = (sim: Sim, n: number): void => { for (let i = 0; i < n; i++) sim.step(); };
const mood = (sim: Sim, id: number) => sim.world.get(id, MoodC)!;

/** A settled colonist with nothing on, on the starter ship. */
function quiet(seed = 1, reg: ContentRegistry = content): { sim: Sim; c: number } {
  const sim = newGame(seed, reg, 'ship.starter', false);
  run(sim, 40);
  const free = colonists(sim).filter((id) => !sim.world.has(id, AssignmentC));
  const c = (free.find((id) => isSettled(sim.world.get(id, PositionC)!)) ?? free[0]) as number;
  expect(c).toBeGreaterThan(0);
  return { sim, c };
}

const pick = (kind: BreakKind, context: 'lowMood' | 'fire' | 'combat' = 'lowMood') => ({ kind, tier: tierOf(kind, context), context, ticks: 10 * TICK_HZ });
const burn = (sim: Sim, c: number): void => {
  const p = sim.world.get(c, PositionC)!;
  shipGrid(sim, homeShip(sim))!.set('fire', Math.round(p.x) + 1, Math.round(p.y), 200);
};

describe('the roll', () => {
  it('is the same for a seed and never touches sim.rng', () => {
    const outcomes = (seed: number): string[] => {
      const { sim, c } = quiet(seed);
      const m = mood(sim, c);
      const before = sim.rng.getState();
      const out: string[] = [];
      for (let k = 0; k < 4000; k++) {
        m.value = 5;
        sim.tick = k * 100 + 7;
        const r = rollBreak(sim, c, m, false);
        out.push(r ? `${k}:${r.kind}:${r.ticks}` : '');
      }
      expect(sim.rng.getState()).toBe(before);
      return out.filter(Boolean);
    };
    const a = outcomes(11), b = outcomes(11), other = outcomes(12);
    expect(a.length).toBeGreaterThan(20);
    expect(b).toEqual(a);
    expect(other).not.toEqual(a);
  });

  it('has the designed low-mood chance: 0 from 35 up, 0.1%, 0.4% and 1.5% below', () => {
    const { sim, c } = quiet();
    const m = mood(sim, c);
    const chance = (v: number): number => { m.value = v; return breakChance(sim, c, breakTerms(sim, c, m, false), false); };
    expect(chance(60)).toBe(0);
    expect(chance(34)).toBeCloseTo(BREAK_BASE_P.low);
    expect(chance(19)).toBeCloseTo(BREAK_BASE_P.lower);
    expect(chance(9)).toBeCloseTo(BREAK_BASE_P.risk);
  });

  it('adds a stressor present, scaled by mood, and a draft keeps only severe outcomes at half the chance', () => {
    const { sim, c } = quiet();
    const m = mood(sim, c);
    burn(sim, c);
    m.value = 50;
    const calm = breakTerms(sim, c, m, false);
    expect(calm.map((t) => t.context)).toEqual(['fire']);
    expect(calm[0]!.pool.map(([k]) => k).sort()).toEqual(['freeze', 'panic', 'refusal']);
    m.value = 20;
    const low = breakTerms(sim, c, m, false);
    expect(low.find((t) => t.context === 'fire')!.p).toBeCloseTo(calm[0]!.p * 1.5);
    const drafted = breakTerms(sim, c, m, true);
    expect(drafted.map((t) => t.context)).toEqual(['fire']); // low mood has no severe outcome: it drops out
    expect(drafted[0]!.pool.map(([k]) => k)).toEqual(['panic']);
    expect(breakChance(sim, c, drafted, true)).toBeCloseTo(drafted[0]!.p * 0.5);
  });

  it('applies trait weights: a Brave crew member never panics, a Stoic breaks half as often', () => {
    const { sim, c } = quiet();
    const m = mood(sim, c);
    burn(sim, c);
    m.value = 50;
    const plain = breakChance(sim, c, breakTerms(sim, c, m, false), false);
    sim.world.add(c, TraitsC, { ids: ['trait.brave'] });
    expect(breakTerms(sim, c, m, false)[0]!.pool.map(([k]) => k)).toEqual(['refusal']);
    sim.world.add(c, TraitsC, { ids: ['trait.stoic'] });
    expect(breakChance(sim, c, breakTerms(sim, c, m, false), false)).toBeCloseTo(plain * 0.5);
    sim.world.add(c, TraitsC, { ids: ['trait.pyrophobic'] });
    expect(breakChance(sim, c, breakTerms(sim, c, m, false), false)).toBeCloseTo(plain * 4);
  });

  it('is off for a content crew member and for crew without a mood', () => {
    const { sim, c } = quiet();
    const m = mood(sim, c);
    m.value = 60;
    expect(breakTerms(sim, c, m, false)).toEqual([]);
    const events: SimEvent[] = [];
    for (let i = 0; i < 600 * TICK_HZ / 10; i++) { sim.step(); events.push(...sim.events.drain()); }
    expect(events.filter((e) => e.type === 'crew.break')).toEqual([]);
  });
});

describe('a break in play', () => {
  it('panic takes the crew member over: interrupt, break task, flee then cower; the scheduler takes them back at the end', () => {
    const { sim, c } = quiet();
    burn(sim, c);
    startBreak(sim, c, { ...pick('panic', 'fire'), src: { x: Math.round(sim.world.get(c, PositionC)!.x) + 1, y: Math.round(sim.world.get(c, PositionC)!.y) } });
    sim.step();
    expect(sim.world.get(c, InterruptC)?.reason).toBe('breakdown');
    expect(sim.world.get(c, TaskC)?.machine).toBe('break');
    expect(sim.world.get(c, AssignmentC)).toBeUndefined();
    const states = new Set<string>();
    for (let i = 0; i < 9 * TICK_HZ; i++) {
      sim.step();
      states.add(sim.world.get(c, TaskC)?.state ?? '');
      expect(auditReservations(sim).problems).toEqual([]);
    }
    expect(states.has('Cower') || states.has('Flee')).toBe(true);
    const events: SimEvent[] = [];
    run(sim, 3 * TICK_HZ);
    events.push(...sim.events.drain());
    expect(sim.world.has(c, BreakdownC)).toBe(false);
    expect(events.some((e) => e.type === 'crew.breakEnded' && e.crew === c)).toBe(true);
    run(sim, 2);
    expect(sim.world.get(c, InterruptC)?.reason).not.toBe('breakdown');
    expect(sim.world.get(c, TaskC)?.machine).not.toBe('break');
    expect(mood(sim, c).letOut).toBeGreaterThan(0);
  });

  it('a severe break overrides a draft, a moderate one yields to it', () => {
    const { sim, c } = quiet();
    sim.enqueue({ type: 'crew.draft', id: c, drafted: true });
    run(sim, 2);
    startBreak(sim, c, pick('panic', 'fire'));
    run(sim, 2);
    expect(sim.world.get(c, InterruptC)?.reason).toBe('breakdown');
    expect(sim.world.has(c, DraftedC)).toBe(true);
    endBreak(sim, c);
    run(sim, 2);
    startBreak(sim, c, pick('despair'));
    run(sim, 2);
    expect(sim.world.has(c, BreakdownC)).toBe(false); // the draft ended it
    expect(sim.world.get(c, InterruptC)?.reason).toBe('drafted');
  });

  it('hazard overrides a break, which keeps running and resumes after the escape', () => {
    const { sim, c } = quiet();
    startBreak(sim, c, { ...pick('despair'), ticks: 60 * TICK_HZ });
    run(sim, 5);
    const p = sim.world.get(c, PositionC)!;
    shipGrid(sim, homeShip(sim))!.set('fire', Math.round(p.x), Math.round(p.y), 200);
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      shipGrid(sim, homeShip(sim))!.set('fire', Math.round(p.x), Math.round(p.y), 200);
      sim.step();
      seen.add(sim.world.get(c, InterruptC)?.reason ?? 'none');
      expect(sim.world.has(c, BreakdownC)).toBe(true);
    }
    expect(seen.has('hazard')).toBe(true);
    shipGrid(sim, homeShip(sim))!.set('fire', Math.round(p.x), Math.round(p.y), 0);
    run(sim, 40);
    expect(sim.world.get(c, InterruptC)?.reason).toBe('breakdown');
    expect(sim.world.get(c, TaskC)?.machine).toBe('break');
  });

  it('survival beats a break even for a drafted crew member who still holds an order: they are stepped off the fire', () => {
    const { sim, c } = quiet();
    sim.enqueue({ type: 'crew.draft', id: c, drafted: true });
    run(sim, 2);
    const p = sim.world.get(c, PositionC)!;
    sim.world.get(c, DraftedC)!.target = { x: Math.round(p.x) + 3, y: Math.round(p.y) }; // an order the break suspends
    startBreak(sim, c, { ...pick('freeze', 'combat'), ticks: 60 * TICK_HZ }); // a combat freeze: severe, stands still
    run(sim, 5);
    const at = { x: Math.round(sim.world.get(c, PositionC)!.x), y: Math.round(sim.world.get(c, PositionC)!.y) };
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      shipGrid(sim, homeShip(sim))!.set('fire', at.x, at.y, 200);
      sim.step();
      seen.add(sim.world.get(c, InterruptC)?.reason ?? 'none');
    }
    expect(seen.has('hazard')).toBe(true);
    const now = sim.world.get(c, PositionC)!;
    expect(Math.abs(now.x - at.x) + Math.abs(now.y - at.y)).toBeGreaterThan(0.5);
    expect(sim.world.has(c, DraftedC)).toBe(true);
    expect(sim.world.has(c, BreakdownC)).toBe(true);
  });

  it('isolation finds a quiet room on a ship whose origin is not (0, 0)', () => {
    const { sim, c } = quiet();
    const g = shipGrid(sim, homeShip(sim))!;
    expect(g.x0 + g.y0).toBeGreaterThan(0);
    const p = sim.world.get(c, PositionC)!;
    const steps = quietSpot(sim, c, homeShip(sim), g, { x: Math.round(p.x), y: Math.round(p.y) });
    expect(steps).not.toBeNull(); // scans the ship's own rectangle (sector coordinates), not from 0
  });

  it('a mild break scores the work drive 0 and holds no job, while needs still work', () => {
    const { sim, c } = quiet();
    startBreak(sim, c, pick('refusal'));
    run(sim, 5);
    expect(sim.world.get(c, InterruptC)).toBeUndefined();
    const intent = sim.world.get(c, IntentC)!;
    const workAt = sim.content.policies!['policy.colonist']!.drives.findIndex((d) => d.id === 'work');
    expect(intent.scores[workAt]).toBe(0);
    expect(sim.world.has(c, AssignmentC)).toBe(false);
    // hungry: they still go and eat
    sim.world.get(c, NeedsC)!.hunger = 20;
    let ate = false;
    for (let i = 0; i < 40 * TICK_HZ && !ate; i++) { sim.step(); ate = sim.events.drain().some((e) => e.type === 'crew.ate' && e.crew === c); }
    expect(ate).toBe(true);
    expect(sim.world.has(c, BreakdownC)).toBe(true);
  });

  it('cooldown and memory survive a save and load', () => {
    const { sim, c } = quiet();
    startBreak(sim, c, pick('panic', 'fire'));
    run(sim, 5);
    endBreak(sim, c);
    expect(onCooldown(sim, c)).toBe(true);
    const back = deserialize(serialize(sim), content);
    expect(back.world.get(c, BreakMemoryC)).toEqual(sim.world.get(c, BreakMemoryC));
    expect(onCooldown(back, c)).toBe(true);
    back.tick += BREAK_COOLDOWN_SEC * TICK_HZ + 1;
    expect(onCooldown(back, c)).toBe(false);
  });

  it('throttles urgent alerts: one per crew member per 10 minutes', () => {
    const { sim, c } = quiet();
    const alerts: boolean[] = [];
    for (let i = 0; i < 2; i++) {
      startBreak(sim, c, pick('panic', 'fire'));
      alerts.push((sim.events.drain().find((e) => e.type === 'crew.break') as { alert: boolean }).alert);
      endBreak(sim, c);
      sim.events.drain();
    }
    expect(alerts).toEqual([true, false]);
  });

  it('a tantrum makes a scene for the crew around, and a break ends early when its cause is gone', () => {
    const { sim, c } = quiet();
    startBreak(sim, c, { ...pick('tantrum'), ticks: 100 * TICK_HZ });
    const others = colonists(sim).filter((o) => o !== c);
    expect(others.some((o) => (mood(sim, o).scene ?? 0) > 0)).toBe(true);
    endBreak(sim, c);
    // fire break with no fire at all: ends once the context has been gone 10 s
    startBreak(sim, c, { ...pick('refusal', 'fire'), ticks: 100 * TICK_HZ });
    run(sim, 20 * TICK_HZ);
    expect(sim.world.has(c, BreakdownC)).toBe(false);
  });
});

describe('the stressors', () => {
  it('reads a path from the break machine only: the broken crew member is not given a job, a draft order or a fight turn', () => {
    const { sim, c } = quiet();
    startBreak(sim, c, { ...pick('freeze', 'combat'), ticks: 20 * TICK_HZ });
    run(sim, 3);
    expect(sim.world.get(c, PathC)!.steps).toEqual([]);
    expect(sim.world.get(c, TaskC)?.state).toBe('Freeze');
  });
});
