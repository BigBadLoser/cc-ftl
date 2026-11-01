import type { RoomSpec } from '../plan';
import { DIRS4, DIRS8, K } from './grid';
import { isPublic, type Ctx2 } from './kit';
import { leftovers } from './machine';

/**
 * Department halls carry circulation only (docs/STATIONGEN2.md section 3.5): a hall keeps the tiles that join its
 * entrances (every room that opens onto it, and the public side when it opens there) by short paths, widened to two;
 * the rest of its floor becomes rooms off it (stores, plant), or wall where too small. So spare floor never widens a
 * hall.
 */

/** Tiles of `hall` a door from `from` could reach: two steps straight from one of its tiles. */
function entrance(c: Ctx2, hall: ReadonlySet<number>, from: (j: number) => boolean): number[] {
  const g = c.g;
  const out = new Set<number>();
  for (const i of hall) {
    for (const [dx, dy] of DIRS4) {
      const o = g.idx(g.x(i) + 2 * dx, g.y(i) + 2 * dy);
      if (o >= 0 && from(o)) out.add(i);
    }
  }
  return [...out];
}

export function trimHalls(c: Ctx2): void {
  const g = c.g;
  const spare: RoomSpec = { role: 'cargo', mods: ['module.storage_rack', 'module.storage_rack'], w: 3, h: 3 };
  c.rooms.forEach((h, id) => {
    if (h.spec.role !== 'hall' || h.dept === 'public' || h.tiles.length < 24) return;
    const hall = new Set(h.tiles.filter((i) => g.kind[i] === K.Room && g.id[i] === id));
    // Entrances: rooms that open onto it, and the public side if it opens there.
    const groups: number[][] = [];
    c.rooms.forEach((r, k) => {
      if (k === id) return;
      const opens = r.doors.some((d) => d === id || (typeof d === 'object' && d.any.includes(id)));
      if (opens) groups.push(entrance(c, hall, (j) => g.kind[j] === K.Room && g.id[j] === k));
    });
    if (h.doors.some((d) => d === 'public')) groups.push(entrance(c, hall, (j) => isPublic(g, j)));
    for (const d of h.doors) if (typeof d === 'number') groups.push(entrance(c, hall, (j) => g.kind[j] === K.Room && g.id[j] === d));
    const live = groups.filter((t) => t.length > 0);
    if (live.length < 2) return;
    // Grow a tree from the first entrance to the nearest unjoined one, in turn.
    const tree = new Set<number>(live[0]);
    const left = live.slice(1).map((t) => new Set(t));
    while (left.length > 0) {
      const prev = new Map<number, number>();
      let q = [...tree];
      for (const i of q) prev.set(i, -1);
      let hit = -1;
      while (q.length > 0 && hit < 0) {
        const next: number[] = [];
        for (const i of q) {
          if (left.some((t) => t.has(i))) { hit = i; break; }
          for (const j of g.nb(i)) if (hall.has(j) && !prev.has(j)) { prev.set(j, i); next.push(j); }
        }
        q = next;
      }
      if (hit < 0) return;
      for (let i = hit; i >= 0 && !tree.has(i); i = prev.get(i) ?? -1) tree.add(i);
      for (let k = left.length - 1; k >= 0; k--) if ([...(left[k] as Set<number>)].some((i) => tree.has(i))) left.splice(k, 1);
    }
    // Two wide: beside each tile of the tree, one tile across its run (east or south first, else west or north).
    const keep = new Set(tree);
    for (const i of tree) {
      const x = g.x(i), y = g.y(i);
      const vertical = tree.has(g.idx(x, y - 1)) || tree.has(g.idx(x, y + 1));
      const side = vertical ? [g.idx(x + 1, y), g.idx(x - 1, y)] : [g.idx(x, y + 1), g.idx(x, y - 1)];
      const j = side.find((k) => hall.has(k));
      if (j !== undefined) keep.add(j);
    }
    // Corners stay walkable: a kept tile's diagonal step gets its corner tile.
    for (const i of [...keep]) for (const j of g.nb(i, DIRS8)) if (keep.has(j) && !g.nb(i).some((k) => keep.has(k) && g.nb(j).includes(k))) {
      const a = g.idx(g.x(i), g.y(j));
      if (hall.has(a)) keep.add(a);
    }
    const cut = [...hall].filter((i) => !keep.has(i));
    if (cut.length < 8) return;
    h.tiles = h.tiles.filter((i) => keep.has(i));
    for (const i of cut) g.set(i, K.Free);
    leftovers(c, h.dept, cut, [id], () => ({ ...spare, ...(h.dept === 'engineering' ? { role: 'plant', mods: [] } : {}) }));
  });
}
