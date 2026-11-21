import type { Layout } from './layout';

/** Each tile's open ground to the nearest hull tile, eight ways (1 beside the hull). */
export function openness(lay: Layout): Int32Array {
  const { w, h } = lay;
  const d = new Int32Array(w * h).fill(-1);
  const queue: number[] = [];
  for (let i = 0; i < w * h; i++) if (lay.cells[i] !== '.') { d[i] = 0; queue.push(i); }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q] as number, x = i % w, y = Math.floor(i / w);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy, j = ny * w + nx;
      if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h && d[j] === -1) { d[j] = (d[i] as number) + 1; queue.push(j); }
    }
  }
  for (let i = 0; i < w * h; i++) if (d[i] === -1) d[i] = 99;
  return d;
}

/** The cable from a tile beside the turret down to the hull: each step one nearer, straight on where it can. */
export function cableFrom(w: number, from: number, reach: Int32Array): number[] {
  const run = [from];
  let i = from, dir = -1;
  while ((reach[i] as number) > 1) {
    const x = i % w, steps = [x < w - 1 ? i + 1 : -1, x > 0 ? i - 1 : -1, i + w, i - w];
    const next = steps.map((j, k) => ({ j, k })).filter(({ j }) => j >= 0 && reach[j] === (reach[i] as number) - 1);
    const pick = next.find((q) => q.k === dir) ?? next[0];
    if (!pick) break;
    i = pick.j; dir = pick.k;
    run.push(i);
  }
  return run;
}
