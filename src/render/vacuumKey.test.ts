import { describe, expect, it } from 'vitest';
import { vacuumKey } from './gridView';

describe('vacuumKey', () => {
  it('changes only when a tile crosses the vacuum line, not with every o2 change', () => {
    const o2 = new Float32Array(256).fill(21);
    const k = vacuumKey(o2);
    o2[7] = 12; // thinner air, still not vacuum
    expect(vacuumKey(o2)).toBe(k);
    o2[200] = 1; // vacuum
    const v = vacuumKey(o2);
    expect(v).not.toBe(k);
    o2[200] = 0.5;
    expect(vacuumKey(o2)).toBe(v);
  });

  it('tells apart which tile is vacuum, also in a short last word', () => {
    const a = new Float32Array(20).fill(21);
    const b = new Float32Array(20).fill(21);
    a[17] = 0;
    b[18] = 0;
    expect(vacuumKey(a)).not.toBe(vacuumKey(b));
    expect(vacuumKey(undefined)).toBe('');
  });
});
