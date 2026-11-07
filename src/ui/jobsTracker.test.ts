import { describe, expect, it } from 'vitest';
import type { UiJob } from './api';
import { trackerGroups } from './jobsTracker';

const job = (o: Partial<UiJob>): UiJob => ({ key: 'k', id: 1, kind: 'delivery', issuer: 'X', title: 'Deliver a sealed crate (3 Metal)', detail: '', reward: 100, turnsLeft: 10, where: 'Kord Beta', hops: 2, here: false, ready: true, target: null, ...o });

describe('trackerGroups', () => {
  it('is empty with no jobs', () => expect(trackerGroups({ active: [] })).toEqual({ here: [], away: [] }));
  it('puts this node\'s jobs first, with what to do there', () => {
    const g = trackerGroups({ active: [job({ key: 'a' }), job({ key: 'b', kind: 'bounty', here: true, hops: 0, turnsLeft: 1 })] });
    expect(g.here.map((r) => r.key)).toEqual(['b']);
    expect(g.here[0]).toMatchObject({ line: 'Target in this node', urgent: true, problem: false, turnsLeft: 1 });
    expect(g.away[0]).toMatchObject({ key: 'a', title: 'Deliver a sealed crate', full: 'Deliver a sealed crate (3 Metal)', line: 'Kord Beta · 2 jumps', urgent: false, reward: 100 });
  });
  it('orders the rest by distance, unreachable last', () => {
    const g = trackerGroups({ active: [job({ key: 'far', hops: 4 }), job({ key: 'none', hops: null }), job({ key: 'near', hops: 1 })] });
    expect(g.away.map((r) => r.key)).toEqual(['near', 'far', 'none']);
    expect(g.away[0]?.line).toBe('Kord Beta · 1 jump');
    expect(g.away[2]?.line).toBe('Kord Beta · out of range');
  });
  it('flags a missing crate as a problem, here or away, but only time makes a job urgent', () => {
    const g = trackerGroups({ active: [job({ ready: false }), job({ key: 'h', ready: false, here: true, hops: 0 })] });
    expect(g.away[0]).toMatchObject({ line: 'Crate missing · 2 jumps', urgent: false, problem: true });
    expect(g.here[0]).toMatchObject({ line: 'Crate missing', problem: true });
  });
});
