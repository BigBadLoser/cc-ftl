import type { Canvas } from './canvas';

/**
 * Wall thinning, the last structural pass before fit-out (every generator: ships and stations). Rooms, blocks and
 * hull fill each draw their own walls, so walls pile up where parts meet:
 *   - slabs: plating, taper wedges and filled pockets are solid wall with no floor nearby;
 *   - double hulls: a second wall layer outside a room's own wall;
 *   - double partitions: two rooms placed side by side, each with its own wall.
 * The pass turns slab interiors into floor of the neighbouring room, folds the inner wall of a double hull and one wall
 * of every double partition into the room beside it. It never touches the outline (any tile touching space, 8
 * neighbours): stair-stepped tapers and chamfers are the silhouette and stay exactly as drawn. Rooms that
 * must keep their exact box (sealed pods, docks, engines, hangars) are never grown.
 */

const N4: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export interface ThinOpts {
  /** May room `label` grow into this tile? */
  canGrow: (label: number) => boolean;
  /** Rank of a room as the one to absorb a slab (higher first): corridors before rooms. */
  rank: (label: number) => number;
  /** Twice the y of the mirror axis (builder coordinates): ties go outboard, so mirrored hulls stay mirrored. */
  axis2: number;
}

/** What the pass did: slabs absorbed, wall tiles folded into rooms, outline tiles changed (always 0). */
export interface ThinStats {
  slabs: number;
  folded: number;
  outlineChanged: number;
}

export function thinWalls(cv: Canvas, o: ThinOpts): ThinStats {
  const S = cv.size;
  const c = cv.cells;
  const lab = cv.label;
  const out: ThinStats = { slabs: 0, folded: 0, outlineChanged: 0 };
  /** Distance of a raw canvas row from the mirror axis (doubled). */
  const off = (rawY: number): number => Math.abs(2 * (rawY - (S >> 1)) - o.axis2);
  // Work inside the used box (plus a margin) only.
  let x0 = S, y0 = S, x1 = 0, y1 = 0;
  for (let k = 0; k < c.length; k++) {
    if (c[k] === '.') continue;
    const x = k % S;
    const y = (k - x) / S;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  if (x1 < x0) return out;
  x0 = Math.max(1, x0 - 1); y0 = Math.max(1, y0 - 1); x1 = Math.min(S - 2, x1 + 1); y1 = Math.min(S - 2, y1 + 1);
  const at = (x: number, y: number): string => c[y * S + x] ?? '.';
  /** The outline: every non-space tile touching space (8 neighbours). The pass must leave it exactly as it was. */
  const outline = (): Set<number> => {
    const set = new Set<number>();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (at(x, y) !== '.' && nearSpace(x, y)) set.add(y * S + x);
    return set;
  };
  /** Something a wall bounds: floor, a door, a beam, a container. */
  const bounded = (ch: string): boolean => ch !== '#' && ch !== '.';
  const thick = (x: number, y: number): boolean => {
    if (at(x, y) !== '#') return false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (bounded(at(x + dx, y + dy))) return false;
    return true;
  };
  const nearSpace = (x: number, y: number): boolean => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) === '.') return true;
    return false;
  };

  const before = outline();

  // 1. Slabs: components of thick wall.
  const seen = new Uint8Array(S * S);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const k0 = y * S + x;
      if (seen[k0] || !thick(x, y)) continue;
      const comp: number[] = [];
      const stack = [k0];
      seen[k0] = 1;
      while (stack.length > 0) {
        const k = stack.pop() as number;
        comp.push(k);
        const kx = k % S;
        const ky = (k - kx) / S;
        for (const [dx, dy] of N4) {
          const j = (ky + dy) * S + kx + dx;
          if (!seen[j] && thick(kx + dx, ky + dy)) { seen[j] = 1; stack.push(j); }
        }
      }
      const fill = comp.filter((k) => !nearSpace(k % S, (k - (k % S)) / S));
      // A slab that is all outline (a stair-stepped edge, a chamfer) is the silhouette: it stays.
      if (fill.length === 0) continue;
      out.slabs += absorb(fill) ? 1 : 0;
    }
  }

  /** Turn a slab interior into floor of the best neighbouring room, opening the single walls between them. */
  function absorb(fill: number[]): boolean {
    const inFill = new Set(fill);
    const votes = new Map<number, { n: number; walls: number[]; out: number }>();
    for (const k of fill) {
      const kx = k % S;
      const ky = (k - kx) / S;
      for (const [dx, dy] of N4) {
        // Through one or two walls (a slab against a double wall) to a room's floor.
        for (const span of [1, 2]) {
          const path = Array.from({ length: span }, (_, i) => (ky + (i + 1) * dy) * S + kx + (i + 1) * dx);
          const r = (ky + (span + 1) * dy) * S + kx + (span + 1) * dx;
          if (path.some((w) => c[w] !== '#' || inFill.has(w)) || c[r] !== '_') continue;
          const L = lab[r] as number;
          if (L < 0 || !o.canGrow(L)) break;
          const v = votes.get(L) ?? { n: 0, walls: [], out: 0 };
          v.n++;
          v.out += off((r - (r % S)) / S);
          // The wall next to the slab opens; with two, the far one opens first (both, in order).
          v.walls.push(...path.reverse());
          votes.set(L, v);
          break;
        }
      }
    }
    const best = [...votes.entries()].sort((a, b) => o.rank(b[0]) - o.rank(a[0]) || b[1].n - a[1].n || b[1].out / b[1].n - a[1].out / a[1].n || a[0] - b[0])[0];
    if (!best) return false;
    const [L, v] = best;
    // Open only walls whose floor neighbours all belong to L (or the slab): never merge two other rooms.
    const open = v.walls.filter((w) => {
      const wx = w % S;
      const wy = (w - wx) / S;
      if (nearSpace(wx, wy)) return false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const j = (wy + dy) * S + wx + dx;
          if (c[j] === '_' && lab[j] !== L) return false;
          if (c[j] === 'D') return false;
        }
      }
      return true;
    });
    if (open.length === 0) return false;
    // Only the slab pieces that touch an opened wall become floor; the rest stays wall.
    const reach = new Set<number>();
    const stack = open.flatMap((w) => N4.map(([dx, dy]) => w + dy * S + dx).filter((j) => inFill.has(j)));
    for (const j of stack) reach.add(j);
    while (stack.length > 0) {
      const k = stack.pop() as number;
      for (const [dx, dy] of N4) {
        const j = k + dy * S + dx;
        if (inFill.has(j) && !reach.has(j)) { reach.add(j); stack.push(j); }
      }
    }
    for (const k of [...reach, ...open]) { c[k] = '_'; lab[k] = L; }
    return reach.size > 0;
  }

  // 2. Double (and triple) partitions and double hulls: floor A | wall | wall (| wall) | floor B (or space) in a straight
  // line. One wall per round folds into the room beside it; three rounds thin a triple seam to one wall.
  for (let round = 0; round < 3; round++) {
    const fold: [number, number][] = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (c[y * S + x] !== '_') continue;
        const A = lab[y * S + x] as number;
        if (A < 0 || !o.canGrow(A)) continue;
        for (const [dx, dy] of N4) {
          const w = at(x + dx, y + dy);
          const w2 = at(x + 2 * dx, y + 2 * dy);
          if ((w !== '#' && w !== 'D') || (w2 !== '#' && w2 !== 'D') || nearSpace(x + dx, y + dy)) continue;
          if ((w === 'D') !== (w2 === 'D')) continue;
          // The first tile past the walls (a third wall is allowed: a triple seam).
          const k = at(x + 3 * dx, y + 3 * dy) === '#' && w2 === '#' ? 4 : 3;
          const b = at(x + k * dx, y + k * dy);
          // A double hull (floor | wall | hull | space): the inner wall becomes floor, the outline stays.
          if (b === '.' && k === 3 && w === '#') { fold.push([(y + dy) * S + x + dx, A]); continue; }
          if (b !== '_') continue;
          const B = lab[(y + k * dy) * S + x + k * dx] as number;
          if (B === A) continue;
          // Grow the room that ranks lower as an absorber (rooms before corridors), so corridors keep their width.
          if (o.canGrow(B) && o.rank(B) < o.rank(A)) continue;
          // Equal claims: across a row the outboard room grows (mirror-safe), across a column the western one.
          if (o.canGrow(B) && o.rank(B) === o.rank(A)) {
            if (dy !== 0 && (off(y) < off(y + k * dy) || (off(y) === off(y + k * dy) && dy < 0))) continue;
            if (dx !== 0 && dx < 0) continue;
          }
          fold.push([(y + dy) * S + x + dx, A]);
        }
      }
    }
    let n = 0;
    for (const [kk, A] of fold) {
      const kx = kk % S;
      const ky = (kk - kx) / S;
      let ok = c[kk] === '#' || c[kk] === 'D';
      for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1 && ok; dx++) {
        const j = (ky + dy) * S + kx + dx;
        if (c[j] === '_' && lab[j] !== A) ok = false;
      }
      if (!ok) continue;
      c[kk] = '_';
      lab[kk] = A;
      n++;
    }
    out.folded += n;
    if (n === 0) break;
  }
  const after = outline();
  for (const k of before) if (!after.has(k)) out.outlineChanged++;
  for (const k of after) if (!before.has(k)) out.outlineChanged++;
  return out;
}
