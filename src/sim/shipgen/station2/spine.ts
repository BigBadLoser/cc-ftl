import type { Grid, TileRect } from './grid';
import { nearPublic } from './kit';

/**
 * The machine strategy's geometry (docs/STATIONGEN2.md section 3.4, "machine"): a straight service corridor two tiles
 * wide runs across the parcel, square to the station's axes, and the machine rooms (rectangles sized by their design)
 * stand in a row along either side of it, sharing walls. A guard post three wide joins the corridor's middle to the
 * public side. On a curved ring a straight corridor keeps every machine room's door wall straight, which a corridor
 * that follows the curve cannot.
 */

export interface Spine {
  corridor: number[];
  post: number[];
  /** The rects (with walls) in the order of `sizes`. */
  rects: TileRect[];
}

interface Span { s: number; e: number }

export function planSpine(g: Grid, tiles: readonly number[], sizes: readonly [number, number][]): Spine | null {
  const P = new Set(tiles);
  let sx = 0, sy = 0;
  for (const i of tiles) { sx += g.x(i); sy += g.y(i); }
  const horizFirst = Math.abs(sy) >= Math.abs(sx);
  let best: Spine | null = null, bestWaste = Infinity;
  for (const horiz of [horizFirst, !horizFirst]) {
    // Local frame: u along the corridor, v across it.
    const at = (u: number, v: number): number => (horiz ? g.idx(u, v) : g.idx(v, u));
    const us = tiles.map((i) => (horiz ? g.x(i) : g.y(i))), vs = tiles.map((i) => (horiz ? g.y(i) : g.x(i)));
    const u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
    const W = u1 - u0 + 1, H = v1 - v0 + 1;
    const sum = new Int32Array((W + 1) * (H + 1));
    for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) {
      sum[(v + 1) * (W + 1) + u + 1] = (P.has(at(u0 + u, v0 + v)) ? 1 : 0) + (sum[v * (W + 1) + u + 1] as number) + (sum[(v + 1) * (W + 1) + u] as number) - (sum[v * (W + 1) + u] as number);
    }
    const inside = (ua: number, va: number, ub: number, vb: number): boolean => {
      if (ua < u0 || va < v0 || ub > u1 || vb > v1) return false;
      const a = ua - u0, b = va - v0, c = ub - u0 + 1, d = vb - v0 + 1;
      return (sum[d * (W + 1) + c] as number) - (sum[b * (W + 1) + c] as number) - (sum[d * (W + 1) + a] as number) + (sum[b * (W + 1) + a] as number) === (c - a) * (d - b);
    };
    for (let cv = v0 + 2; cv + 3 <= v1; cv++) {
      // The corridor's floor rows cv and cv+1, walls cv-1 and cv+2; the longest run inside the parcel, off the public side.
      let run: Span | null = null;
      for (let u = u0, s: number | null = null; u <= u1 + 1; u++) {
        const ok = u <= u1 && inside(u, cv - 1, u, cv + 2) && ![cv - 1, cv, cv + 1, cv + 2].some((v) => nearPublic(g, at(u, v)));
        if (ok && s === null) s = u;
        if (!ok && s !== null) { if (!run || u - 1 - s > run.e - run.s) run = { s, e: u - 1 }; s = null; }
      }
      if (!run || run.e - run.s < 8) continue;
      // The guard post: three wide from the corridor's middle to the public side, whichever side reaches it first.
      const um = (run.s + run.e) >> 1;
      let post: number[] | null = null, postSide = 0;
      for (const dir of [-1, 1]) {
        const col: number[] = [];
        for (let v = dir < 0 ? cv - 1 : cv + 2; v >= v0 - 1 && v <= v1 + 1; v += dir) {
          const row = [um - 1, um, um + 1].map((u) => at(u, v));
          if (row.some((i) => !P.has(i))) break;
          col.push(...row);
          if (row.some((i) => nearPublic(g, i))) { if (!post || col.length < post.length) { post = [...col]; postSide = dir; } break; }
        }
      }
      if (!post) continue;
      // Rects along both sides, flush on the corridor walls; the post's columns are kept clear on its side.
      const placed: (TileRect | null)[] = sizes.map(() => null);
      const used: Record<number, Span[]> = { [-1]: [], [1]: [] };
      if (postSide !== 0) used[postSide]?.push({ s: um - 2, e: um + 2 });
      const order = sizes.map((_, k) => k).sort((a, b) => (sizes[b] as number[])[0]! * (sizes[b] as number[])[1]! - (sizes[a] as number[])[0]! * (sizes[a] as number[])[1]!);
      let ok = true;
      for (const k of order) {
        const [w0, h0] = sizes[k] as [number, number];
        let pick: { u: number; side: number; w: number; h: number; d: number } | null = null;
        for (const [w, h] of w0 === h0 ? [[w0, h0]] : [[w0, h0], [h0, w0]]) {
          for (const side of [-1, 1]) {
            const spans = used[side] as Span[];
            // Snap positions: against an existing room (shared wall) or the guard post, else anywhere on the run.
            const cands = new Set<number>([um - ((w as number) + 1) - 1, um + 1, ...spans.flatMap((p) => [p.e, p.s - (w as number) - 1])]);
            for (let u = run.s - 1; u + (w as number) + 1 <= run.e + 1; u++) cands.add(u);
            for (const u of cands) {
              const ue = u + (w as number) + 1;
              if (u < run.s - 1 || ue > run.e + 1) continue;
              // Interiors may not overlap anything; walls may overlap walls.
              if (spans.some((p) => !(ue <= p.s || u >= p.e) && !(ue === p.s || u === p.e))) continue;
              const va = side < 0 ? cv - 2 - (h as number) : cv + 2, vb = side < 0 ? cv - 1 : cv + 3 + (h as number);
              if (!inside(u, va, ue, vb)) continue;
              const shared = spans.some((p) => p.e === u || p.s === ue) ? 0 : 1;
              const d = shared * 100 + Math.abs(u + ((w as number) >> 1) - um);
              if (!pick || d < pick.d) pick = { u, side, w: w as number, h: h as number, d };
            }
          }
        }
        if (!pick) { ok = false; break; }
        (used[pick.side] as Span[]).push({ s: pick.u, e: pick.u + pick.w + 1 });
        const va = pick.side < 0 ? cv - 2 - pick.h : cv + 2;
        placed[k] = horiz ? { x: pick.u, y: va, w: pick.w + 2, h: pick.h + 2 } : { x: va, y: pick.u, w: pick.h + 2, h: pick.w + 2 };
      }
      if (!ok) continue;
      const corridor: number[] = [];
      for (let u = run.s; u <= run.e; u++) corridor.push(at(u, cv), at(u, cv + 1));
      // Prefer the layout that leaves the least floor over (a tight row), then the shorter corridor.
      const area = placed.reduce((t, r) => t + (r ? r.w * r.h : 0), 0);
      const waste = tiles.length - area - corridor.length - post.length + corridor.length * 0.3;
      if (waste < bestWaste) { bestWaste = waste; best = { corridor, post, rects: placed as TileRect[] }; }
    }
  }
  return best;
}
