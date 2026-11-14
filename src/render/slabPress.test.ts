import { describe, expect, it } from 'vitest';
import { FACE, corners, faceMask, frame, pressSlab, sample, type Px } from './slabPress';

/** A synthetic slab sprite: grey body with a parallelogram face (FACE tone) long along the screen diagonal. */
function slab(): Px {
  const w = 40, h = 30;
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    d.set([60, 60, 70, 255], i);
    // face: a parallelogram, 20 px long along (2,1), 6 rows tall... drawn per row: x from 4 + 2*(y-8) over 14 px
    if (y >= 8 && y < 18) {
      const x0 = 4 + 2 * (y - 8);
      if (x >= x0 && x < x0 + 14) d.set([...FACE, 255], i);
    }
  }
  return { w, h, d };
}

/** A figure: opaque white block with a dark band, 6 x 12. */
function figure(): Px {
  const w = 6, h = 12;
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(y < 3 ? [20, 20, 20, 255] : [230, 230, 230, 255], (y * w + x) * 4);
  return { w, h, d };
}

describe('slab press maths', () => {
  it('finds the face by its tone, only opaque pixels', () => {
    const s = slab();
    const m = faceMask(s);
    expect(m.reduce((a, b) => a + b, 0)).toBe(10 * 14);
    s.d[(10 * s.w + 10) * 4 + 3] = 100;                         // a translucent face pixel is not face
    expect(faceMask(s).reduce((a, b) => a + b, 0)).toBe(10 * 14 - 1);
  });

  it('takes four corners of the parallelogram', () => {
    const s = slab();
    const q = corners(faceMask(s), s.w, s.h);
    expect(q).toHaveLength(4);
    const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
    expect(Math.min(...ys)).toBeCloseTo(8.5);
    expect(Math.max(...ys)).toBeCloseTo(17.5);
    expect(Math.min(...xs)).toBeCloseTo(4.5);
    expect(Math.max(...xs)).toBeCloseTo(4 + 2 * 9 + 13 + 0.5);
    expect(corners(new Uint8Array(40 * 30), 40, 30)).toHaveLength(0);
  });

  it('builds a frame on the long edge, never mirrored, head at the top end', () => {
    const q = corners(faceMask(slab()), 40, 30);
    const f = frame(q);
    expect(f.u[0] * f.v[1] - f.u[1] * f.v[0]).toBeGreaterThan(0);
    expect(Math.hypot(...f.v)).toBeGreaterThanOrEqual(Math.hypot(...f.u));
    expect(f.v[1]).toBeGreaterThan(0);                           // v runs down the screen: feet lowest
  });

  it('samples the figure inside the face only', () => {
    const s = slab();
    const m = faceMask(s);
    const fld = sample(s, m, figure(), frame(corners(m, s.w, s.h)), true);
    let on = 0;
    for (let i = 0; i < m.length; i++) {
      if (!m[i]) expect(fld.a[i]).toBe(0);
      else if (fld.a[i]! > 0.5) on++;
    }
    expect(on).toBeGreaterThan(30);
  });

  it('presses: face pixels change, everything else is untouched; no face gives null', () => {
    const s = slab();
    const r = pressSlab(s, figure());
    expect(r).not.toBeNull();
    let changed = 0;
    for (let i = 0; i < r!.mask.length; i++) {
      const same = [0, 1, 2, 3].every((k) => r!.pressed[i * 4 + k] === s.d[i * 4 + k]);
      if (!r!.mask[i]) expect(same).toBe(true);
      else if (!same) changed++;
    }
    expect(changed).toBeGreaterThan(60);
    const bare: Px = { w: 4, h: 4, d: new Uint8ClampedArray(64) };
    expect(pressSlab(bare, figure())).toBeNull();
  });
});
