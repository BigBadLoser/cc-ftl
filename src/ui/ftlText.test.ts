import { describe, expect, it } from 'vitest';
import type { UiFtl } from './api';
import { ftlState } from './ftlText';

const base: UiFtl = { ship: 1, state: 'idle', blocker: null, charge: 0, max: 40, ordered: false, queued: false, pilot: null };

describe('ftlState', () => {
  it('names each state', () => {
    expect(ftlState(base)).toBe('Idle 0/40 s');
    expect(ftlState({ ...base, state: 'heading', pilot: 'Ada' })).toBe('Ada heading to the helm');
    expect(ftlState({ ...base, state: 'charging', charge: 12.9 })).toBe('Charging 12/40 s');
    expect(ftlState({ ...base, state: 'ready', charge: 40 })).toBe('Ready');
    expect(ftlState({ ...base, state: 'waiting', blocker: 'helmOffline' })).toMatch(/no power/);
  });
});
