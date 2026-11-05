import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { CrewC, DeadC, newGame, opinionOf, personOf, type Sim } from '../sim';
import { behavioursOf, effectsOf, historyOf, summaryOf } from './socialSnapshot';
import { buildSocial } from './socialSnapshot';
import { bondBoth, bondTo } from '../sim/crew/bonds';
import { TICK_HZ } from '../sim/time';

const place = (n: string): string | undefined => ({ fenix: 'Fenix Alpha' } as Record<string, string>)[n];
const op = (reasons: { id: string; d: number; tick: number; at?: string }[], score = 55, kind?: 'friend' | 'rival') => ({ score, reasons, touched: 0, kind });

describe('social history', () => {
  it('merges the same event on both sides into one "both" line, oldest first', () => {
    const mine = op([{ id: 'fought', d: 12, tick: 100, at: 'fenix' }, { id: 'chat', d: 3, tick: 900 }]);
    const theirs = op([{ id: 'fought', d: 10, tick: 100, at: 'fenix' }, { id: 'rescued', d: 30, tick: 500 }]);
    const h = historyOf(mine, theirs, 100 + 60 * TICK_HZ * 2, place);
    expect(h.map((l) => [l.who, l.text])).toEqual([['both', 'Fought together at Fenix Alpha'], ['them', 'Was carried to safety'], ['me', 'Good talks']]);
    expect(h[0]!.agoSec).toBe(120 - 0);
    expect(h.every((l) => l.good)).toBe(true);
  });
  it('keeps a same-id reason apart when it happened at another time or moved the other way', () => {
    const h = historyOf(op([{ id: 'row', d: -5, tick: 10 }]), op([{ id: 'row', d: -5, tick: 20 }]), 40, place);
    expect(h.map((l) => l.who)).toEqual(['me', 'them']);
    expect(h.every((l) => !l.good)).toBe(true);
  });
  it('summarises by the earliest named place, else the strongest reason', () => {
    const f = op([{ id: 'chat', d: 3, tick: 5 }, { id: 'fought', d: 12, tick: 50, at: 'fenix' }], 60, 'friend');
    expect(summaryOf(f, undefined, place)).toBe('Friends since Fenix Alpha');
    const r = op([{ id: 'row', d: -9, tick: 5 }, { id: 'grated', d: -2, tick: 6 }], -60, 'rival');
    expect(summaryOf(r, r, place)).toBe('Rivals: shouting matches');
    expect(summaryOf(undefined, undefined, place)).toBe('Acquaintance');
  });
  it('reads effects from the label held', () => {
    expect(effectsOf(op([], 60, 'friend'), 'Lyra').map((e) => e.text)).toEqual(['+4 mood nearby', '×1.05 work beside Lyra']);
    expect(effectsOf(op([], -60, 'rival'), 'Mox')[0]).toEqual({ text: '−6 mood nearby', good: false });
    expect(effectsOf(op([], 10), 'X')).toEqual([]);
  });
  it('lists only the behaviours that exist, for friends and rivals', () => {
    expect(behavioursOf(op([], 60, 'friend'), 'Ines', 'Lyra').map((b) => b.text)).toEqual(['Ines and Lyra prefer to eat together', 'Ines and Lyra prefer to take breaks together', 'Ines and Lyra prefer to sleep near each other']);
    expect(behavioursOf(op([], -60, 'rival'), 'Ines', 'Mox')[0]!.text).toContain('apart');
    expect(behavioursOf(op([], 10), 'Ines', 'X')).toEqual([]);
  });
});

describe('the reason timestamp', () => {
  it('is the tick the reason last happened, updated when it merges', () => {
    const sim: Sim = newGame(1, content);
    const [a, b] = sim.world.query(CrewC);
    bondTo(sim, a!, b!, 3, 'chat');
    const first = sim.tick;
    for (let i = 0; i < 5; i++) sim.step();
    bondTo(sim, a!, b!, 2, 'chat');
    const r = opinionOf(sim, personOf(sim, a!), personOf(sim, b!))!.reasons;
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: 'chat', tick: sim.tick });
    expect(sim.tick).toBeGreaterThan(first);
  });
  it('builds the sections from the live sim', () => {
    const sim = newGame(1, content);
    const crew = sim.world.query(CrewC);
    const [a, b, c] = crew;
    bondBoth(sim, a!, b!, 60, 'fought');
    bondTo(sim, a!, c!, -60, 'row');
    const s = buildSocial(sim, a!, place);
    expect(s.friends[0]).toMatchObject({ id: b, tag: 'mutual', section: 'friends' });
    expect(s.rivals[0]).toMatchObject({ id: c, tag: 'one-sided' });
    expect(s.friends[0]!.history[0]!.who).toBe('both');
    expect(s.caps).toEqual({ friends: 3, rivals: 2 });
    expect(s.friends.length + s.rivals.length + s.crew.length).toBeLessThanOrEqual(crew.length - 1);
    sim.world.add(b!, DeadC, {} as never);
    expect(buildSocial(sim, a!, place).friends).toHaveLength(0);
  });
});
