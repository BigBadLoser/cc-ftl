import { describe, expect, it } from 'vitest';
import type { UiJob } from './api';
import { JOBS_PHONE_KEY, readJobsOpen, writeJobsOpen } from './phoneHud';
import { trackerRows } from './jobsTracker';

const job = (o: Partial<UiJob>): UiJob => ({ key: 'k', id: 1, kind: 'delivery', issuer: 'X', title: 'Deliver a sealed crate (3 Metal)', detail: '', reward: 100, turnsLeft: 10, where: 'Kord Beta', hops: 2, here: false, ready: true, target: null, ...o });

describe('trackerRows', () => {
  it('is empty with no jobs', () => expect(trackerRows({ active: [] })).toEqual([]));
  it('describes a delivery and a bounty', () => {
    const rows = trackerRows({ active: [job({ key: 'a' }), job({ key: 'b', kind: 'bounty', title: 'Destroy the Red Maw', here: true, hops: 0, turnsLeft: 1 })] });
    expect(rows[0]).toMatchObject({ key: 'a', fact: 'Kord Beta · 10 turns left', state: '2 jumps', warn: false });
    expect(rows[1]).toMatchObject({ state: 'Target in this node', fact: 'Kord Beta · 1 turn left', warn: true });
  });
  it('flags a missing crate and an unreachable job', () => {
    const rows = trackerRows({ active: [job({ ready: false }), job({ hops: null })] });
    expect(rows[0]).toMatchObject({ state: 'Crate missing', warn: true });
    expect(rows[1]?.state).toBe('out of range');
  });
});

describe('jobs tracker phone state', () => {
  it('remembers the expanded state for the session', () => {
    const mem = new Map<string, string>();
    const store = () => ({ getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) });
    expect(readJobsOpen(store)).toBe(false);
    writeJobsOpen(true, store);
    expect(mem.get(JOBS_PHONE_KEY)).toBe('1');
    expect(readJobsOpen(store)).toBe(true);
  });
});
