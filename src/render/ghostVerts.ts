import { Struct } from "../sim/structure";
import { nearOut, wallMask, type KindAt } from "./tiles";

/**
 * Tiles carrying a front-ghost vertical edge line (`tile.hull.ghost.vert`, drawn at the tile's front corner): the
 * corners where the near hull's silhouette turns or ends (walls pass 12, complib.ghost_verts).
 */
export function ghostVerts(kindAt: KindAt, width: number, height: number): { x: number; y: number }[] {
  return vertsOver(kindAt, 0, 0, width, height);
}

/**
 * The ghost verts whose tile lies in [x0, x1) x [y0, y1) (one chunk view's share). A vert at tile (x, y) only depends
 * on the hull tiles in [x, x + 1] x [y, y + 1], so the sweep reaches one tile past the rectangle's +x / +y sides.
 */
export function ghostVertsIn(kindAt: KindAt, x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
  return vertsOver(kindAt, x0, y0, x1 + 1, y1 + 1).filter((t) => t.x >= x0 && t.y >= y0 && t.x < x1 && t.y < y1);
}

function vertsOver(kindAt: KindAt, x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
  const seg = new Map<string, { x: number; y: number; dirs: Set<string>; n: number }>();
  const put = (px: number, py: number, d: string) => {
    const k = `${px},${py}`;
    const e = seg.get(k) ?? { x: px, y: py, dirs: new Set<string>(), n: 0 };
    e.dirs.add(d);
    e.n++;
    seg.set(k, e);
  };
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      if (kindAt(x, y) !== Struct.Wall) continue;
      const o = nearOut(kindAt, x, y);
      if (!o) continue;
      const m = wallMask(kindAt, x, y);
      const segs: [number, number, number, number, string][] = [];
      if (o === 1 && m & 8) segs.push([x - 0.5, y + 0.5, x + 0.5, y + 0.5, "y"]);
      if (o === 2 && m & 1) segs.push([x + 0.5, y - 0.5, x + 0.5, y + 0.5, "x"]);
      if (o === 3) segs.push([x - 0.5, y + 0.5, x + 0.5, y - 0.5, "d"]);
      for (const [ax, ay, bx, by, d] of segs) {
        put(ax, ay, d);
        put(bx, by, d);
      }
    }
  return [...seg.values()].filter((e) => e.n === 1 || e.dirs.size > 1).map((e) => ({ x: e.x - 0.5, y: e.y - 0.5 }));
}
