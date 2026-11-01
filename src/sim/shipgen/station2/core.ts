import type { TileRect } from './grid';

/**
 * The core centre slot (docs/STATIONGEN2.md, concentric): a department walled off inside the inner ring, entered from
 * it. Its occupant now is engineering: its machine rooms in two rows either side of a straight service corridor, the
 * guard post three wide from the corridor's middle to the ring (the only way in). The slot is the least rectangle that
 * holds that layout, and the inner ring runs round it square: a round slot would leave its corners as floor nobody
 * needs. Another occupant (a rotunda) can plug in with its own shape.
 */

/**
 * A core block in block coordinates (0..w-1, 0..h-1), walls included: rects in the order of the sizes given, the
 * corridor (two rows, wall to wall across the block but for its end walls), the post, and the floor left over.
 */
export interface CoreBlock { w: number; h: number; rects: TileRect[]; corridor: TileRect; post: TileRect; spare: number }

const cache = new Map<string, CoreBlock>();

/** Is tile (x, y) inside a block centred on the station (x from -floor(w / 2), y from -floor(h / 2))? */
export const inBlock = (b: { w: number; h: number }, x: number, y: number): boolean => {
  const x0 = -Math.floor(b.w / 2), y0 = -Math.floor(b.h / 2);
  return x >= x0 && x < x0 + b.w && y >= y0 && y < y0 + b.h;
};

/** The block's top-left tile on the station grid. */
export const blockOrigin = (b: { w: number; h: number }): [number, number] => [-Math.floor(b.w / 2), -Math.floor(b.h / 2)];

/**
 * The least block (by area, then least floor over) for these rooms (interior sizes): every split of the rooms between
 * the two rows and every turn of each is tried. Rooms in a row share walls; the post stands in the shorter row,
 * between the rooms nearest the middle.
 */
export function coreBlock(sizes: readonly [number, number][]): CoreBlock {
  const key = sizes.map(([w, h]) => `${w}x${h}`).join(',');
  const hit = cache.get(key);
  if (hit) return hit;
  const n = sizes.length;
  let best: CoreBlock | null = null, bestKey = Infinity;
  for (let code = 0; code < 4 ** n; code++) {
    // Per room: bit 0 the row (0 top), bit 1 turned.
    const rows: { k: number; w: number; h: number }[][] = [[], []];
    for (let k = 0, c = code; k < n; k++, c >>= 2) {
      const [a, b] = sizes[k] as [number, number];
      const turned = (c & 2) !== 0;
      if (turned && a === b) { rows.length = 0; break; }
      (rows[c & 1] as { k: number; w: number; h: number }[]).push({ k, w: turned ? b : a, h: turned ? a : b });
    }
    if (rows.length === 0) continue;
    const width = (r: { w: number }[]): number => r.reduce((t, x) => t + x.w + 1, 0) + 1;
    const [top, bot] = rows as [{ k: number; w: number; h: number }[], { k: number; w: number; h: number }[]];
    // The post (three wide and its far wall) goes in the narrower row.
    const postTop = width(top) <= width(bot);
    const W = Math.max(width(top) + (postTop ? 4 : 0), width(bot) + (postTop ? 0 : 4), 12);
    const hT = Math.max(0, ...top.map((x) => x.h)), hB = Math.max(0, ...bot.map((x) => x.h));
    const H = (top.length > 0 ? hT + 2 : 1) + 2 + (bot.length > 0 ? hB + 2 : 1);
    const used = top.reduce((t, x) => t + x.w * x.h, 0) + bot.reduce((t, x) => t + x.w * x.h, 0);
    const v = W * H * 1000 + (W * H - used) + Math.abs(W - H) * 0.01;
    if (v >= bestKey) continue;
    // Lay it out: rows centred, the post between the rooms nearest the middle of its row.
    const rects: TileRect[] = new Array<TileRect>(n);
    const cv = (top.length > 0 ? hT + 2 : 1);
    let post: TileRect = { x: 0, y: 0, w: 0, h: 0 };
    const lay = (row: { k: number; w: number; h: number }[], isTop: boolean, withPost: boolean): void => {
      const total = width(row) + (withPost ? 4 : 0);
      let x = Math.floor((W - total) / 2);
      // The post after the room whose end is nearest the block's middle.
      let at = -1;
      if (withPost) {
        let e = x, bestD = Infinity;
        for (let j = -1; j < row.length; j++) {
          if (j >= 0) e += (row[j] as { w: number }).w + 1;
          if (Math.abs(e + 2 - W / 2) < bestD) { bestD = Math.abs(e + 2 - W / 2); at = j; }
        }
      }
      const placePost = (): void => {
        post = isTop ? { x: x + 1, y: 0, w: 3, h: cv } : { x: x + 1, y: cv + 2, w: 3, h: H - cv - 2 };
        x += 4;
      };
      if (withPost && at === -1) placePost();
      row.forEach((r, j) => {
        rects[r.k] = { x, y: isTop ? cv - 2 - r.h : cv + 2, w: r.w + 2, h: r.h + 2 };
        x += r.w + 1;
        if (withPost && at === j) placePost();
      });
    };
    lay(top, true, postTop);
    lay(bot, false, !postTop);
    bestKey = v;
    best = { w: W, h: H, rects, corridor: { x: 1, y: cv, w: W - 2, h: 2 }, post, spare: 0 };
  }
  const out = best as CoreBlock;
  // Floor left over: in no room (walls included), not corridor or post (the corridor's two end walls aside).
  const used = new Set<number>();
  for (const r of [...out.rects, out.corridor, out.post]) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) used.add(y * out.w + x);
  out.spare = out.w * out.h - used.size - 2;
  cache.set(key, out);
  return out;
}
