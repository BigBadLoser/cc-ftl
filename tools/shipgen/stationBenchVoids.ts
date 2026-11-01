/** Station bench: enclosed-space (void) classification. */
import type { GenResult } from '../../src/sim';

export interface VoidResult { voidUnintended: number; voidDeliberate: number; voidMethod: string; maskRejected: number }

/** The result's optional `negativeSpace` (tile indices or a boolean/number mask over the template), read defensively. */
function negativeMask(g: GenResult): Uint8Array | null {
  const f = (g as unknown as { negativeSpace?: unknown }).negativeSpace;
  if (f === undefined || f === null || typeof f !== 'object') return null;
  const n = g.width * g.height;
  const out = new Uint8Array(n);
  const a = Array.isArray(f) || ArrayBuffer.isView(f) ? Array.from(f as ArrayLike<unknown>) : f instanceof Set ? [...f] : [];
  if (a.length === n && a.every((v) => typeof v === 'boolean' || v === 0 || v === 1)) a.forEach((v, i) => { out[i] = v ? 1 : 0; });
  else for (const v of a) if (typeof v === 'number' && v >= 0 && v < n) out[v] = 1;
  return out;
}

/** Deliberate-void heuristic (no `negativeSpace` field): large, fairly convex, bounded only by corridors and hull wall. */
const DELIBERATE_MIN = 40, DELIBERATE_FILL = 0.5, DELIBERATE_HALL = 0.9;

/**
 * Enclosed space (not reachable from the template edge through space) split into deliberate and unintended, as shares of
 * floor. A region is deliberate only if it passes DELIBERATE_* (size, convexity, clean edge), whether or not a
 * `negativeSpace` field claims it; a claimed region that fails the test is unintended and counted in `maskRejected`.
 */
export function classifyVoids(g: GenResult, floor: number): VoidResult {
  const W = g.width, H = g.height;
  const at = (x: number, y: number): string => (x < 0 || y < 0 || x >= W || y >= H ? '.' : (g.template.rows[y]?.[x] ?? '.'));
  const seen = new Uint8Array(W * H);
  const flood = (start: number[], keep: (i: number) => void): void => {
    const st = [...start];
    while (st.length) {
      const i = st.pop() as number;
      const x = i % W, y = (i - x) / W;
      if (seen[i] || at(x, y) !== '.') continue;
      seen[i] = 1; keep(i);
      if (x > 0) st.push(i - 1);
      if (x < W - 1) st.push(i + 1);
      if (y > 0) st.push(i - W);
      if (y < H - 1) st.push(i + W);
    }
  };
  const edge: number[] = [];
  for (let x = 0; x < W; x++) edge.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) edge.push(y * W, y * W + W - 1);
  flood(edge, () => undefined);
  const mask = negativeMask(g);
  let unintended = 0, deliberate = 0, rejected = 0;
  for (let i0 = 0; i0 < W * H; i0++) {
    if (seen[i0] || at(i0 % W, Math.floor(i0 / W)) !== '.') continue;
    const cells: number[] = [];
    flood([i0], (i) => cells.push(i));
    const claimed = mask ? cells.filter((i) => mask[i]).length * 2 >= cells.length : true;
    let isDeliberate = false;
    {
      const xs = cells.map((i) => i % W), ys = cells.map((i) => Math.floor(i / W));
      const fill = cells.length / ((Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1));
      // Floor tiles touching the region, directly or behind a wall tile: corridors only?
      let floors = 0, halls = 0;
      const touch = (x: number, y: number): void => {
        const c = at(x, y);
        if (c !== '_' && c !== 'D') return;
        floors++;
        if (g.rooms[g.roomOf[y * W + x] ?? -1]?.role === 'hall') halls++;
      };
      for (const i of cells) {
        const x = i % W, y = (i - x) / W;
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
          const c = at(nx, ny);
          if (c === '#' || c === '=') { for (const [qx, qy] of [[nx + 1, ny], [nx - 1, ny], [nx, ny + 1], [nx, ny - 1]] as const) if (!(qx === x && qy === y)) touch(qx, qy); }
          else touch(nx, ny);
        }
      }
      const passes = cells.length >= DELIBERATE_MIN && fill >= DELIBERATE_FILL && floors > 0 && halls / floors >= DELIBERATE_HALL;
      isDeliberate = claimed && passes;
      if (mask && claimed && !passes) rejected++;
    }
    if (isDeliberate) deliberate += cells.length; else unintended += cells.length;
  }
  return { voidUnintended: floor ? unintended / floor : 0, voidDeliberate: floor ? deliberate / floor : 0, voidMethod: mask ? 'field+checked' : 'heuristic', maskRejected: rejected };
}
