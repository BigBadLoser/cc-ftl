import { describe, expect, it } from 'vitest';
import type { RoofHit, Window } from './hits';
import { paintRoofDamage, type RoofLayers } from './paint';

/** A window onto an endless plain roof at global (gx, gy): blue plating, grey structure, purlin spans every 16 rows. */
function roofWindow(w: number, h: number, gx = 0, gy = 0): { win: Window; layers: RoofLayers } {
  const n = w * h;
  const fill = (rgb: (x: number, y: number) => [number, number, number]): Uint8ClampedArray => {
    const a = new Uint8ClampedArray(n * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a.set([...rgb(gx + x, gy + y), 255], (y * w + x) * 4);
    return a;
  };
  return {
    win: { w, h, gx, gy, roof: new Uint8Array(n).fill(1) },
    layers: {
      plate: fill(() => [70, 100, 140]),
      struct: fill((x, y) => (y % 16 === 0 && x % 40 !== 0 ? [150, 160, 170] : [60, 66, 74])),   // (spans between joists)
      bare: fill(() => [60, 66, 74]),
    },
  };
}

const alphaAt = (o: Uint8ClampedArray, w: number, x: number, y: number): number => o[(y * w + x) * 4 + 3] as number;

describe('roof damage overlay', () => {
  it('a heavy hit tears the plating open round where it landed, and leaves the far roof alone', () => {
    const { win, layers } = roofWindow(160, 100);
    const hit: RoofHit = { x: 80, y: 50, power: 90, seed: 1234, wear: 0 };
    const o = paintRoofDamage(win, layers, [hit]);
    expect(alphaAt(o, 160, 80, 50)).toBe(255);
    expect(alphaAt(o, 160, 2, 2)).toBe(0);
    let opaque = 0;
    for (let i = 3; i < o.length; i += 4) if (o[i] === 255) opaque++;
    expect(opaque).toBeGreaterThan(200);
  });

  it('a light hit only dents and scorches: nothing opaque', () => {
    const { win, layers } = roofWindow(160, 100);
    const o = paintRoofDamage(win, layers, [{ x: 80, y: 50, power: 20, seed: 99, wear: 0 }]);
    let marked = 0;
    for (let i = 3; i < o.length; i += 4) {
      expect(o[i]).toBeLessThan(255);
      if ((o[i] as number) > 0) marked++;
    }
    expect(marked).toBeGreaterThan(0);
  });

  it('a light hit on worn plating gives way', () => {
    const { win, layers } = roofWindow(160, 100);
    const o = paintRoofDamage(win, layers, [{ x: 80, y: 50, power: 20, seed: 99, wear: 0.8 }]);
    expect(alphaAt(o, 160, 80, 50)).toBe(255);
  });

  it('is the same every time, and two overlapping windows agree where they overlap', () => {
    const a = roofWindow(220, 120, 0, 0);
    const b = roofWindow(220, 120, 80, 0);
    const hits = (gx: number): RoofHit[] => [{ x: 150 - gx, y: 60, power: 120, seed: 7, wear: 0 }, { x: 175 - gx, y: 70, power: 30, seed: 8, wear: 0 }];
    const oa = paintRoofDamage(a.win, a.layers, hits(0));
    expect(paintRoofDamage(a.win, a.layers, hits(0))).toEqual(oa);
    const ob = paintRoofDamage(b.win, b.layers, hits(80));
    let differ = 0;
    for (let y = 20; y < 100; y++) {
      for (let x = 120; x < 180; x++) {
        for (let c = 0; c < 4; c++) if (oa[(y * 220 + x) * 4 + c] !== ob[(y * 220 + x - 80) * 4 + c]) differ++;
      }
    }
    expect(differ).toBe(0);
  });
});
