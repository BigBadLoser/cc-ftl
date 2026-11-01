import type { ModuleDef } from '../../registry';
import { accessTile, footprintTiles, openTilesOf, type Tile } from '../../modules/footprint';
import { CHAIR, SLEEP, TABLE, around, bedSides, chairFront, useKind } from '../useTiles';

/**
 * Use rules: whether a furnished layout leaves every piece usable (after the clearance and access terms of Merrell et
 * al. 2011 and Yu et al. 2011, and Tutenel et al. 2009's Clearance features). Generation-time walking is stricter than
 * the sim's: crew may not cross a bed, so a bed or table in an aisle blocks it. Layout placement enforces the same
 * rules (shipgen/layout.ts); this checks a finished template.
 *
 * - A bed needs one tile of clear, reachable floor beside a long side. Neither long side may touch another bed or a
 *   table (a wall, a locker or a planter is fine).
 * - A piece with an access tile needs it clear (or a chair facing the piece) and reachable.
 * - Any other solid piece needs one clear, reachable tile beside it, to be serviced from.
 * - A chair faces clear floor or a surface it is used at (a table, or a piece whose access tile it sits on), never the
 *   back of a locker.
 * - A table needs a chair or a clear, reachable tile beside it.
 *
 * Pieces off the floor (hull containers) and in rooms crew cannot reach (a drone's sealed bays) are not checked.
 */

export type UseBreak = 'bedNoSide' | 'bedBeside' | 'accessBlocked' | 'boxedIn' | 'chairFacing' | 'tableNoSeat';

export interface UseIssue { kind: UseBreak; def: string; x: number; y: number; module: number }

interface Mod { def: string; x: number; y: number; rot: number }

const N4: readonly Tile[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

/** Check every module of a layout (rows and modules as in a ShipTemplate; `roomOf` to skip unreachable rooms). */
export function checkUse(rows: readonly string[], modules: readonly Mod[], defs: Record<string, ModuleDef>, roomOf?: Int16Array): UseIssue[] {
  const H = rows.length;
  const W = Math.max(...rows.map((r) => r.length));
  const cell = (x: number, y: number): string => (x < 0 || y < 0 || y >= H ? '.' : (rows[y]?.[x] ?? '.'));
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
  const occ = new Int32Array(W * H).fill(-1);
  const blocks = new Uint8Array(W * H);
  modules.forEach((m, i) => {
    const d = defs[m.def];
    if (!d) return;
    const open = openTilesOf(d, m.x, m.y, m.rot);
    for (const t of footprintTiles(d, m.x, m.y, m.rot)) {
      const c = cell(t.x, t.y);
      if (!inside(t.x, t.y) || (c !== '_' && c !== 'D')) continue;
      const j = t.y * W + t.x;
      occ[j] = i;
      // Lights, deck markings, chairs and an airlock's open tiles are walked over; beds are not (at generation).
      blocks[j] = !open.some((o) => o.x === t.x && o.y === t.y) && (d.solid || SLEEP.has(m.def)) ? 1 : 0;
    }
  });
  const passable = (x: number, y: number): boolean => inside(x, y) && (cell(x, y) === '_' || cell(x, y) === 'D') && blocks[y * W + x] === 0;
  /** Clear: passable and holding nothing a crew member would have to stand around (a chair is not clear). */
  const clear = (x: number, y: number): boolean => passable(x, y) && modules[occ[y * W + x] as number]?.def !== CHAIR;
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
  const reachedRoom = new Set<number>();
  if (roomOf) for (let i = 0; i < W * H; i++) if (seen[i]) reachedRoom.add(roomOf[i] ?? -1);
  const usable = (t: Tile): boolean => clear(t.x, t.y) && seen[t.y * W + t.x] === 1;
  const modAt = (t: Tile): Mod | null => (inside(t.x, t.y) && (occ[t.y * W + t.x] as number) >= 0 ? (modules[occ[t.y * W + t.x] as number] as Mod) : null);

  const out: UseIssue[] = [];
  modules.forEach((m, i) => {
    const d = defs[m.def];
    if (!d) return;
    const tiles = footprintTiles(d, m.x, m.y, m.rot).filter((t) => cell(t.x, t.y) === '_');
    if (tiles.length === 0) return;
    if (roomOf && !tiles.some((t) => reachedRoom.has(roomOf[t.y * W + t.x] ?? -1))) return;
    const flag = (kind: UseBreak): void => { out.push({ kind, def: m.def, x: m.x, y: m.y, module: i }); };
    const kind = useKind(m.def, d, m.x, m.y, m.rot);
    if (kind === 'sides') {
      const sides = bedSides(d, m.x, m.y, m.rot);
      if (!sides.some((s) => s.some(usable))) flag('bedNoSide');
      if (sides.some((s) => s.some((t) => { const o = modAt(t); return !!o && o !== m && (SLEEP.has(o.def) || TABLE.has(o.def)); }))) flag('bedBeside');
    } else if (kind === 'front') {
      const f = chairFront(m.x, m.y, m.rot);
      const o = modAt(f);
      const od = o ? defs[o.def] : undefined;
      const a = o && od ? accessTile(od, o.x, o.y, o.rot) : null;
      const usedAt = !!o && (TABLE.has(o.def) || (!!a && a.x === m.x && a.y === m.y));
      if (!usedAt && !clear(f.x, f.y)) flag('chairFacing');
    } else if (kind === 'access') {
      const a = accessTile(d, m.x, m.y, m.rot) as Tile;
      const seat = modAt(a);
      if (!usable(a) && !(seat?.def === CHAIR && seen[a.y * W + a.x] === 1)) flag('accessBlocked');
    } else if (kind === 'ring') {
      if (!around(d, m.x, m.y, m.rot).some(usable)) flag('boxedIn');
    } else if (TABLE.has(m.def)) {
      if (!around(d, m.x, m.y, m.rot).some((t) => usable(t) || modAt(t)?.def === CHAIR)) flag('tableNoSeat');
    }
  });
  return out;
}
