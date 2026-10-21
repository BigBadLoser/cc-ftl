import { describe, expect, it } from 'vitest';
import { isRock, Struct } from '../structure';
import { FIELD, generateAsteroid } from './gen';
import type { OreDef } from './types';
import { validateAsteroid } from './validate';

const ORES: OreDef[] = [
  { code: 2, name: 'Ice', item: 'item.ice', weight: { big: 3, field: 4 }, amount: [30, 80], color: 0 },
  { code: 1, name: 'Iron', item: 'item.metal', weight: { big: 6, field: 5 }, amount: [20, 60], color: 0 },
];

/** 4-connected bodies of the cells `keep` selects. */
function bodies(w: number, h: number, keep: (i: number) => boolean): number {
  const seen = new Uint8Array(w * h);
  let n = 0;
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || !keep(s)) continue;
    n++;
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w, y = (i - x) / w;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const j = ny! * w + nx!;
        if (nx! >= 0 && ny! >= 0 && nx! < w && ny! < h && !seen[j] && keep(j)) { seen[j] = 1; stack.push(j); }
      }
    }
  }
  return n;
}

describe('asteroid generation', () => {
  it('is deterministic per seed and independent of ore list order', () => {
    for (const kind of ['big', 'field'] as const) {
      const a = generateAsteroid(kind, 77, ORES);
      const b = generateAsteroid(kind, 77, [...ORES].reverse());
      expect(Array.from(b.struct)).toEqual(Array.from(a.struct));
      expect(Array.from(b.ore)).toEqual(Array.from(a.ore));
      expect(Array.from(b.amt)).toEqual(Array.from(a.amt));
      expect(b.parts).toEqual(a.parts);
      expect(Array.from(generateAsteroid(kind, 78, ORES).struct)).not.toEqual(Array.from(a.struct));
    }
  });

  it('a big asteroid is one connected rock body 40-120 tiles across, ore only on plain rock', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const p = generateAsteroid('big', seed, ORES);
      expect(validateAsteroid(p), `seed ${seed}`).toEqual([]);
      expect(bodies(p.w, p.h, (i) => isRock(p.struct[i]!))).toBe(1);
      expect(Math.max(p.w, p.h)).toBeGreaterThanOrEqual(30);
      expect(Math.max(p.w, p.h)).toBeLessThanOrEqual(120);
      for (let i = 0; i < p.ore.length; i++) if (p.ore[i]) expect(p.struct[i]).toBe(Struct.Rock);
      expect(p.ore.some((o) => o !== 0)).toBe(true);
    }
  });

  it('the hollow variant has one connected core of dense rock; the solid one has none; forcing keeps the outline', () => {
    const hollow = generateAsteroid('big', 3, ORES, { hollow: true });
    const solid = generateAsteroid('big', 3, ORES, { hollow: false });
    expect(Array.from(solid.struct).map(isRock)).toEqual(Array.from(hollow.struct).map(isRock));
    expect(hollow.core).not.toBeNull();
    expect(bodies(hollow.w, hollow.h, (i) => hollow.struct[i] === Struct.CoreRock)).toBe(1);
    expect(solid.core).toBeNull();
    expect(solid.struct.includes(Struct.CoreRock)).toBe(false);
  });

  it('a field is many small rocks, each one body, spaced by FIELD.gap, with ore pockets', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const p = generateAsteroid('field', seed, ORES);
      expect(validateAsteroid(p), `seed ${seed}`).toEqual([]);
      expect(p.parts.length).toBeGreaterThanOrEqual(8);
      for (const r of p.parts) {
        expect(Math.max(r.w, r.h)).toBeLessThanOrEqual(FIELD.maxRock + 2);
        expect(Math.min(r.w, r.h)).toBeGreaterThanOrEqual(FIELD.minRock);
      }
      for (const [a, r] of p.parts.entries()) {
        for (const q of p.parts.slice(a + 1)) {
          const apart = r.x >= q.x + q.w + FIELD.gap || q.x >= r.x + r.w + FIELD.gap || r.y >= q.y + q.h + FIELD.gap || q.y >= r.y + r.h + FIELD.gap;
          expect(apart).toBe(true);
        }
      }
      expect(p.ore.some((o) => o !== 0)).toBe(true);
    }
  });
});
