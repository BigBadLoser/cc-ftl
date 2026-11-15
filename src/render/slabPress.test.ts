import { describe, expect, it } from 'vitest';
import { FACE, UV_WINDOW, corners, faceMask, frame, pressSlab, pressSlabUv, sample, sampleUv, uvMask, type Px } from './slabPress';

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

/** A synthetic UV pass: a 40 x 40 grey sprite whose face (30 x 20 px) is mapped by `uvAt(x, y)` -> [u, v] in 0..1, or null off the face. */
function uvSlab(uvAt: (x: number, y: number) => [number, number] | null): { sp: Px; uv: Px } {
  const w = 40, h = 40;
  const sp = { w, h, d: new Uint8ClampedArray(w * h * 4) };
  const uv = { w, h, d: new Uint8ClampedArray(w * h * 4) };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    sp.d.set([60, 60, 70, 255], i);
    const p = uvAt(x, y);
    if (!p) continue;
    sp.d.set([...FACE, 255], i);                              // (the colour key never reads it here: the UV buffer finds the face)
    uv.d.set([Math.round(p[0] * 255), Math.round(p[1] * 255), 255, 255], i);
  }
  return { sp, uv };
}
/** The window's fraction (0..1) back to a face u or v. */
const inU = (f: number): number => UV_WINDOW.u0 + f * (UV_WINDOW.u1 - UV_WINDOW.u0);
const inV = (f: number): number => UV_WINDOW.v0 + f * (UV_WINDOW.v1 - UV_WINDOW.v0);
const head = (): Px => {                                      // 4 x 8 figure: opaque only in its top two rows (the head), left column dark
  const w = 4, h = 8;
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < 2; y++) for (let x = 0; x < w; x++) d.set(x === 0 ? [20, 20, 20, 255] : [230, 230, 230, 255], (y * w + x) * 4);
  return { w, h, d };
};
const changed = (a: Px, b: Uint8ClampedArray, x: number, y: number): boolean => [0, 1, 2].some((c) => a.d[(y * a.w + x) * 4 + c] !== b[(y * a.w + x) * 4 + c]);

describe('slab press through the UV pass', () => {
  // an upright face: x 5..34 across (u), y 10..29 down, head (v high) at the top
  const upright = (x: number, y: number): [number, number] | null => (x >= 5 && x < 35 && y >= 10 && y < 30 ? [inU((x - 5 + 0.5) / 30), inV(1 - (y - 10 + 0.5) / 20)] : null);

  it('finds the face from the UV flag, on opaque sprite pixels only', () => {
    const { sp, uv } = uvSlab(upright);
    expect(uvMask(sp, uv).reduce((a, b) => a + b, 0)).toBe(30 * 20);
    sp.d[(15 * 40 + 15) * 4 + 3] = 0;
    expect(uvMask(sp, uv).reduce((a, b) => a + b, 0)).toBe(30 * 20 - 1);
  });

  it('puts the figure head at the face head and its right to u, filling the window', () => {
    const { sp, uv } = uvSlab(upright);
    const r = pressSlabUv(sp, uv, head())!;
    expect(r.mask.reduce((a, b) => a + b, 0)).toBe(600);
    for (const x of [8, 20, 32]) expect(changed(sp, r.pressed, x, 12)).toBe(true);          // the head: the top quarter of the face
    for (const x of [8, 20, 32]) expect(changed(sp, r.pressed, x, 25)).toBe(true);          // (every face px is the lifted face colour)
    const dark = (x: number, y: number): number => r.pressed[(y * 40 + x) * 4]!;
    expect(dark(7, 12)).toBeLessThan(dark(30, 12));                                          // the figure's dark left column is on the face's left
    expect(dark(30, 12)).toBeGreaterThan(dark(30, 27));                                      // the lit head above the bare face below it
    expect(r.pressed[(5 * 40 + 5) * 4]).toBe(60);                                            // off the face: untouched
  });

  it('follows a tilted, foreshortened face: the map is the UV, not a quad fitted to the mask', () => {
    // the same face seen on a slant: rows shear right and the lower rows are squeezed (v is not linear in y)
    const tilt = (x: number, y: number): [number, number] | null => {
      if (y < 8 || y >= 32) return null;
      const t = (y - 8 + 0.5) / 24;
      const row = t * t;                                       // foreshortening: v falls quickly at the top, slowly at the bottom
      const x0 = 4 + 6 * t;
      return x >= x0 && x < x0 + 24 ? [inU((x - x0 + 0.5) / 24), inV(1 - row)] : null;
    };
    const { sp, uv } = uvSlab(tilt);
    const m = uvMask(sp, uv);
    const fld = sampleUv(sp, uv, m, head());
    const top = (y: number): number => { let s = 0, n = 0; for (let x = 0; x < 40; x++) if (m[y * 40 + x]) { s += fld.a[y * 40 + x]!; n++; } return s / n; };
    // the figure's head (its top quarter) reaches 1 - v < 0.265, i.e. t^2 < 0.265, t < 0.51: down to row y 20 (a face as even as its mask
    // would stop at t = 0.265, y 14): the UV's squeeze is what puts it there
    expect(top(12)).toBeGreaterThan(0.9);
    expect(top(18)).toBeGreaterThan(0.9);
    expect(top(23)).toBe(0);
  });

  it('never turns the figure: a face seen head-down shows its prisoner head-down (the figure turns with the slab)', () => {
    const down = (x: number, y: number): [number, number] | null => { const p = upright(x, y); return p && [1 - p[0], 1 - p[1]]; };   // the face turned 180 deg: head at the bottom
    const r = pressSlabUv(uvSlab(down).sp, uvSlab(down).uv, head())!;
    expect(r.pressed[(27 * 40 + 20) * 4]).toBeGreaterThan(r.pressed[(12 * 40 + 20) * 4]!);   // the lit head is at the bottom
  });

  it('is null without a face', () => {
    const { sp, uv } = uvSlab(() => null);
    expect(pressSlabUv(sp, uv, head())).toBeNull();
  });
});
