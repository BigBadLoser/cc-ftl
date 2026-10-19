import { describe, expect, it } from 'vitest';
import type { EventDef } from './defs';
import { drawEvent, poolFor } from './engine';
import { run, storySim } from './testkit';
import { TICK_HZ } from '../time';
import { spawnShip } from '../combat/ships';
import type { SimEvent } from '../events';

const notice = (extra: Partial<EventDef>): EventDef => ({ title: 'N', text: 'n', mode: 'notice', triggers: [{ kind: 'periodic', weight: 1 }], ...extra });
const decision = (extra: Partial<EventDef>): EventDef => ({
  title: 'D', text: 'd', mode: 'decision', triggers: [{ kind: 'periodic', weight: 1 }], choices: [{ id: 'ok', label: 'ok', outcome: {} }], ...extra,
});

describe('pools', () => {
  it('filters by danger tier and faction territory', () => {
    const sim = storySim({
      any: notice({}),
      calm: notice({ danger: { max: 1 } }),
      hot: notice({ danger: { min: 2 } }),
      corp: notice({ factions: ['corp'] }),
      open: notice({ factions: [null] }),
      chain: notice({ triggers: [{ kind: 'chain' }] }),
      arr: notice({ triggers: [{ kind: 'arrival', weight: 1 }] }),
    });
    const ids = (kind: 'periodic' | 'arrival'): string[] => poolFor(sim, kind).map((p) => p.id);
    expect(ids('periodic')).toEqual(['any', 'calm', 'open']);
    expect(ids('arrival')).toEqual(['arr']);
    sim.story.context = { danger: 3, faction: 'corp' };
    expect(ids('periodic')).toEqual(['any', 'hot', 'corp']);
  });

  it('respects eligibility, once and cooldown', () => {
    const sim = storySim({
      needsFlag: notice({ eligible: [{ kind: 'flag', flag: 'x' }] }),
      once: notice({ once: true }),
      cool: notice({ cooldownSec: 10 }),
    });
    expect(poolFor(sim, 'periodic').map((p) => p.id)).toEqual(['once', 'cool']);
    sim.story.flags['x'] = 1;
    expect(poolFor(sim, 'periodic').map((p) => p.id)).toEqual(['needsFlag', 'once', 'cool']);
    sim.story.seen['once'] = { count: 1, last: 0 };
    sim.story.seen['cool'] = { count: 1, last: 0 };
    expect(poolFor(sim, 'periodic').map((p) => p.id)).toEqual(['needsFlag']);
    run(sim, 10 * TICK_HZ);
    expect(poolFor(sim, 'periodic').map((p) => p.id)).toEqual(['needsFlag', 'cool']);
  });

  it('sums trigger weights and draws in proportion, deterministically', () => {
    const ev = { heavy: notice({ triggers: [{ kind: 'periodic', weight: 3 }] }), light: notice({ triggers: [{ kind: 'periodic', weight: 1 }] }) };
    const counts = (seed: number): Record<string, number> => {
      const sim = storySim(ev, [], seed);
      const out: Record<string, number> = { heavy: 0, light: 0 };
      for (let i = 0; i < 400; i++) out[drawEvent(sim, 'periodic') as string]!++;
      return out;
    };
    const a = counts(5);
    expect(counts(5)).toEqual(a);
    expect(a['heavy']! / 400).toBeGreaterThan(0.68);
    expect(a['heavy']! / 400).toBeLessThan(0.82);
  });

  it('returns null from an empty pool', () => {
    expect(drawEvent(storySim({}), 'arrival')).toBeNull();
  });
});

describe('triggers over time', () => {
  it('periodic draws are off until configured, then fire about every interval, never in combat or over a decision', () => {
    const sim = storySim({ d: decision({}) });
    run(sim, 100 * TICK_HZ);
    expect(sim.story.active).toBeNull();
    sim.enqueue({ type: 'story.setContext', periodicSec: 30 });
    const foe = spawnShip(sim, { name: 'H', rows: ['###', '#_#', '###'] }, { gridId: 2, faction: 'hostile', x: 30, y: 30 });
    run(sim);
    expect(sim.sector.inCombat).toBe(true);
    run(sim, 60 * TICK_HZ);
    expect(sim.story.active).toBeNull();
    sim.enqueue({ type: 'debug.capture', gridId: foe });
    run(sim, 2);
    expect(sim.sector.inCombat).toBe(false);
    run(sim, 2);
    expect(sim.story.active?.event).toBe('d');
    expect(sim.story.seen['d']?.count).toBe(1);
    run(sim, 100 * TICK_HZ);
    expect(sim.story.seen['d']?.count).toBe(1);
  });

  it('arrival draws from the arrival pool for the context', () => {
    const sim = storySim({
      a: notice({ triggers: [{ kind: 'arrival', weight: 1 }], factions: ['corp'] }),
      b: notice({ triggers: [{ kind: 'arrival', weight: 1 }], factions: ['pirates'] }),
    });
    sim.enqueue({ type: 'story.setContext', danger: 2, faction: 'pirates' });
    sim.enqueue({ type: 'story.arrive' });
    run(sim);
    expect(Object.keys(sim.story.seen)).toEqual(['b']);
  });
});

describe('notices', () => {
  it('a notice applies its effects and is announced; a lead opens its decision; leads lapse', () => {
    const sim = storySim({
      lead: notice({ lead: 'd', expireSec: 5, effects: [{ type: 'flag', flag: 'saw' }] }),
      d: decision({ triggers: [{ kind: 'chain' }] }),
    });
    const events: SimEvent[] = [];
    sim.enqueue({ type: 'story.fire', event: 'lead' });
    run(sim);
    events.push(...sim.events.drain());
    const started = events.find((e) => e.type === 'story.started');
    expect(started).toMatchObject({ event: 'lead', mode: 'notice' });
    expect(sim.story.flags['saw']).toBe(1);
    expect(sim.story.active).toBeNull();
    const id = sim.story.notices[0]?.id as number;
    sim.enqueue({ type: 'story.openNotice', notice: id });
    run(sim);
    expect(sim.story.active?.event).toBe('d');
    expect(sim.story.notices).toHaveLength(0);

    sim.enqueue({ type: 'story.fire', event: 'lead' });
    run(sim, 6 * TICK_HZ);
    expect(sim.story.notices).toHaveLength(0);
  });

  it('dismissing a notice drops it', () => {
    const sim = storySim({ lead: notice({ lead: 'x' }), x: decision({}) });
    sim.enqueue({ type: 'story.fire', event: 'lead' });
    run(sim);
    sim.enqueue({ type: 'story.dismissNotice', notice: sim.story.notices[0]?.id as number });
    run(sim);
    expect(sim.story.notices).toHaveLength(0);
  });
});
