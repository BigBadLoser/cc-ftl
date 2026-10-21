/**
 * Starmap outline geometry for the view: a soft field around points and segments, contoured with marching squares into
 * closed loops, returned as an SVG path in map units. Generated galaxy data never changes, so callers cache by id.
 */

export type P = [number, number];

const TABLE: Record<number, [number, number][]> = {
  1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]],
  8: [[2, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]],
};

function segDist(px: number, py: number, a: P, b: P): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * vx + (py - a[1]) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(px - a[0] - t * vx, py - a[1] - t * vy);
}

/**
 * The outline around `points` and `links` (segments): the iso-line of a sum of Gaussians of width `sig` around each
 * point (and 0.8 x a narrower one along each segment), sampled every `step` units. Holes come out as inner loops (draw
 * with fill-rule evenodd).
 */
export function fluidOutline(points: readonly P[], links: readonly [P, P][], sig: number, step: number): string {
  if (!points.length) return '';
  const thr = 0.42;
  const pad = sig * 3;
  const x0 = Math.min(...points.map((p) => p[0])) - pad;
  const y0 = Math.min(...points.map((p) => p[1])) - pad;
  const nx = Math.ceil((Math.max(...points.map((p) => p[0])) + pad - x0) / step);
  const ny = Math.ceil((Math.max(...points.map((p) => p[1])) + pad - y0) / step);
  // Each point and segment only adds to the cells within REACH widths of it (beyond that its Gaussian is < 0.1%).
  const F = Array.from({ length: ny + 1 }, () => new Float64Array(nx + 1));
  const REACH = 3;
  const splat = (bx0: number, by0: number, bx1: number, by1: number, f: (x: number, y: number) => number) => {
    const i0 = Math.max(0, Math.floor((bx0 - x0) / step));
    const i1 = Math.min(nx, Math.ceil((bx1 - x0) / step));
    const j0 = Math.max(0, Math.floor((by0 - y0) / step));
    const j1 = Math.min(ny, Math.ceil((by1 - y0) / step));
    for (let j = j0; j <= j1; j++) {
      const row = F[j]!;
      for (let i = i0; i <= i1; i++) row[i]! += f(x0 + i * step, y0 + j * step);
    }
  };
  const rp = sig * 1.25 * REACH;
  for (const p of points) {
    splat(p[0] - rp, p[1] - rp, p[0] + rp, p[1] + rp, (x, y) => Math.exp(-((Math.hypot(x - p[0], y - p[1]) / (sig * 1.25)) ** 2)));
  }
  const rl = sig * REACH;
  for (const [a, b] of links) {
    splat(Math.min(a[0], b[0]) - rl, Math.min(a[1], b[1]) - rl, Math.max(a[0], b[0]) + rl, Math.max(a[1], b[1]) + rl,
      (x, y) => 0.8 * Math.exp(-((segDist(x, y, a, b) / sig) ** 2)));
  }
  const segs: [P, P][] = [];
  const lerp = (a: number, b: number, va: number, vb: number) => a + ((thr - va) / (vb - va)) * (b - a);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v0 = F[j]![i]!;
      const v1 = F[j]![i + 1]!;
      const v2 = F[j + 1]![i + 1]!;
      const v3 = F[j + 1]![i]!;
      const X = x0 + i * step;
      const Y = y0 + j * step;
      const e: P[] = [[lerp(X, X + step, v0, v1), Y], [X + step, lerp(Y, Y + step, v1, v2)], [lerp(X, X + step, v3, v2), Y + step], [X, lerp(Y, Y + step, v0, v3)]];
      const c = (v0 > thr ? 1 : 0) | (v1 > thr ? 2 : 0) | (v2 > thr ? 4 : 0) | (v3 > thr ? 8 : 0);
      for (const [a, b] of TABLE[c] ?? []) segs.push([e[a]!, e[b]!]);
    }
  }
  // Chain the segments into closed loops.
  const key = (p: P) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
  const adj = new Map<string, number[]>();
  segs.forEach((sg, k) => {
    for (const p of sg) adj.set(key(p), [...(adj.get(key(p)) ?? []), k]);
  });
  const used = new Set<number>();
  let d = '';
  for (let k = 0; k < segs.length; k++) {
    if (used.has(k)) continue;
    used.add(k);
    const loop: P[] = [segs[k]![0], segs[k]![1]];
    let cur = segs[k]![1];
    for (;;) {
      const nxt = (adj.get(key(cur)) ?? []).find((m) => !used.has(m));
      if (nxt === undefined) break;
      used.add(nxt);
      const sg = segs[nxt]!;
      cur = key(sg[0]) === key(cur) ? sg[1] : sg[0];
      loop.push(cur);
    }
    d += 'M' + loop.map((p) => `${p[0].toFixed(0)} ${p[1].toFixed(0)}`).join(' L') + 'Z';
  }
  return d;
}
