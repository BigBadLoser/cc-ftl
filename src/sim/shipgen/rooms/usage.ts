import type { ModuleDef } from '../../registry';
import { accessTile, footprintTiles, hullRow, openTilesOf, rotatedSize, type Tile } from '../../modules/footprint';

/**
 * Use rules: whether a furnished layout leaves every piece usable (after the clearance and access terms of Merrell et
 * al. 2011 and Yu et al. 2011, and Tutenel et al. 2009's Clearance features). Generation-time walking is stricter than
 * the sim's: crew may not cross a bed, so a bed or table in an aisle blocks it.
 *
 * - A bed needs one tile of clear, reachable floor beside a long side. Neither long side may touch another bed or a
 *   table (a wall, a locker or a planter is fine).
 * - A piece with an access tile needs it clear (or a chair facing the piece) and reachable.
 * - Any other solid piece needs one clear, reachable tile beside it, to be serviced from.
 * - A chair faces clear floor or a surface it is used at (a table, or a piece whose access tile it sits on), never the
 *   back of a locker.
 * - A table needs a chair or a clear, reachable tile beside it.
 */

export type UseBreak = 'bedNoSide' | 'bedBeside' | 'accessBlocked' | 'boxedIn' | 'chairFacing' | 'tableNoSeat';

export interface UseIssue { kind: UseBreak; def: string; x: number; y: number; module: number }

interface Mod { def: string; x: number; y: number; rot: number }

const SLEEP = new Set(['module.bed', 'module.med_bed']);
const TABLE = new Set(['module.mess_table', 'module.bench']);
const CHAIR = 'module.chair';
/** The tile a seated crew member faces: r0 -y, r1 +x, r2 +y, r3 -x. */
const FACING: readonly Tile[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
const N4: readonly Tile[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

/** Check every module of a layout (rows and modules as in a ShipTemplate). */
export function checkUse(rows: readonly string[], modules: readonly Mod[], defs: Record<string, ModuleDef>): UseIssue[] {
  const H = rows.length;
  const W = Math.max(...rows.map((r) => r.length));
  const cell = (x: number, y: number): string => (x < 0 || y < 0 || y >= H ? '.' : (rows[y]?.[x] ?? '.'));
  const occ = new Int32Array(W * H).fill(-1);
  const blocks = new Uint8Array(W * H);
  modules.forEach((m, i) => {
    const d = defs[m.def];
    if (!d) return;
    const wall = hullRow(d, m.x, m.y, m.rot);
    const open = openTilesOf(d, m.x, m.y, m.rot);
    for (const t of footprintTiles(d, m.x, m.y, m.rot)) {
      if (t.x < 0 || t.y < 0 || t.x >= W || t.y >= H || wall.some((w) => w.x === t.x && w.y === t.y)) continue;
      const j = t.y * W + t.x;
      occ[j] = i;
      const isOpen = open.some((o) => o.x === t.x && o.y === t.y);
      // Lights, deck markings, chairs and an airlock's open tiles are walked over; beds are not (at generation).
      blocks[j] = !isOpen && (d.solid || SLEEP.has(m.def)) ? 1 : 0;
    }
  });
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
  const floorish = (x: number, y: number): boolean => { const c = cell(x, y); return c === '_' || c === 'D'; };
  const passable = (x: number, y: number): boolean => inside(x, y) && floorish(x, y) && blocks[y * W + x] === 0;
  /** Clear: passable and holding nothing a crew member would have to stand around (a chair is not clear). */
  const clear = (x: number, y: number): boolean => {
    if (!passable(x, y)) return false;
    const o = occ[y * W + x] as number;
    return o < 0 || modules[o]?.def !== CHAIR;
  };
  // Reachable: flood from every door over passable tiles.
  const seen = new Uint8Array(W * H);
  const stack: number[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (cell(x, y) === 'D' && passable(x, y)) { seen[y * W + x] = 1; stack.push(y * W + x); }
  while (stack.length > 0) {
    const i = stack.pop() as number;
    const x = i % W, y = Math.floor(i / W);
    for (const n of N4) {
      const nx = x + n.x, ny = y + n.y;
      if (passable(nx, ny) && !seen[ny * W + nx]) { seen[ny * W + nx] = 1; stack.push(ny * W + nx); }
    }
  }
  const usable = (x: number, y: number): boolean => clear(x, y) && seen[y * W + x] === 1;
  const modAt = (x: number, y: number): Mod | null => (inside(x, y) && (occ[y * W + x] as number) >= 0 ? (modules[occ[y * W + x] as number] as Mod) : null);

  const out: UseIssue[] = [];
  const flag = (kind: UseBreak, m: Mod, i: number): void => { out.push({ kind, def: m.def, x: m.x, y: m.y, module: i }); };
  modules.forEach((m, i) => {
    const d = defs[m.def];
    if (!d || d.airlock || hullRow(d, m.x, m.y, m.rot).length > 0) return;
    const tiles = footprintTiles(d, m.x, m.y, m.rot);
    const [w, h] = rotatedSize(d, m.rot);
    if (SLEEP.has(m.def)) {
      // The long sides: the two lines of tiles along the footprint's long axis.
      const sides: Tile[][] = h >= w
        ? [tiles.filter((t) => t.x === m.x).map((t) => ({ x: t.x - 1, y: t.y })), tiles.filter((t) => t.x === m.x + w - 1).map((t) => ({ x: t.x + 1, y: t.y }))]
        : [tiles.filter((t) => t.y === m.y).map((t) => ({ x: t.x, y: t.y - 1 })), tiles.filter((t) => t.y === m.y + h - 1).map((t) => ({ x: t.x, y: t.y + 1 }))];
      if (!sides.some((s) => s.some((t) => usable(t.x, t.y)))) flag('bedNoSide', m, i);
      if (sides.some((s) => s.some((t) => { const o = modAt(t.x, t.y); return !!o && o !== m && (SLEEP.has(o.def) || TABLE.has(o.def)); }))) flag('bedBeside', m, i);
      return;
    }
    if (m.def === CHAIR) {
      const f = FACING[m.rot % 4] as Tile;
      const tx = m.x + f.x, ty = m.y + f.y;
      const o = modAt(tx, ty);
      const oDef = o ? defs[o.def] : undefined;
      const usedAt = !!o && !!oDef && (TABLE.has(o.def) || (() => { const a = accessTile(oDef, o.x, o.y, o.rot); return !!a && a.x === m.x && a.y === m.y; })());
      if (!usedAt && !clear(tx, ty)) flag('chairFacing', m, i);
      return;
    }
    const around = (): Tile[] => {
      const set = new Map<number, Tile>();
      for (const t of tiles) for (const n of N4) {
        const x = t.x + n.x, y = t.y + n.y;
        if (!tiles.some((u) => u.x === x && u.y === y)) set.set(y * W + x, { x, y });
      }
      return [...set.values()];
    };
    if (TABLE.has(m.def)) {
      if (!around().some((t) => usable(t.x, t.y) || modAt(t.x, t.y)?.def === CHAIR)) flag('tableNoSeat', m, i);
      return;
    }
    if (!d.solid) return;
    const a = accessTile(d, m.x, m.y, m.rot);
    if (a && !tiles.some((t) => t.x === a.x && t.y === a.y)) {
      const seat = modAt(a.x, a.y);
      const ok = usable(a.x, a.y) || (seat?.def === CHAIR && seen[a.y * W + a.x] === 1);
      if (!ok) flag('accessBlocked', m, i);
      return;
    }
    if (!around().some((t) => usable(t.x, t.y))) flag('boxedIn', m, i);
  });
  return out;
}
