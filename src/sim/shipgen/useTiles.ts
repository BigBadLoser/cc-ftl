import type { ModuleDef } from '../registry';
import { accessTile, footprintTiles, hullRow, rotatedSize, type Tile } from '../modules/footprint';

/**
 * The tiles a piece is used from, for placement (shipgen/layout.ts) and for the checker (rooms/usage.ts): a bed's long
 * sides, a chair's front, the ring of tiles around a piece. Beds and tables are the pieces that may not lie beside a bed.
 */

export const SLEEP = new Set(['module.bed', 'module.med_bed']);
/** Tables (a bench is a seat: it needs a free side, like any other piece). */
export const TABLE = new Set(['module.mess_table']);
export const CHAIR = 'module.chair';
/** The tile a seated crew member faces: r0 -y, r1 +x, r2 +y, r3 -x. */
export const FACING: readonly Tile[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
const N4: readonly Tile[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

/** A bed's two long sides: the lines of tiles just outside its long edges. */
export function bedSides(def: ModuleDef, x: number, y: number, rot: number): [Tile[], Tile[]] {
  const [w, h] = rotatedSize(def, rot);
  if (h >= w) {
    const col = (cx: number): Tile[] => Array.from({ length: h }, (_, j) => ({ x: cx, y: y + j }));
    return [col(x - 1), col(x + w)];
  }
  const row = (cy: number): Tile[] => Array.from({ length: w }, (_, i) => ({ x: x + i, y: cy }));
  return [row(y - 1), row(y + h)];
}

/** The tile a chair faces. */
export function chairFront(x: number, y: number, rot: number): Tile {
  const f = FACING[rot % 4] as Tile;
  return { x: x + f.x, y: y + f.y };
}

/** Tiles orthogonally next to the footprint, outside it. */
export function around(def: ModuleDef, x: number, y: number, rot: number): Tile[] {
  const tiles = footprintTiles(def, x, y, rot);
  const seen = new Set(tiles.map((t) => `${t.x},${t.y}`));
  const out: Tile[] = [];
  for (const t of tiles) for (const n of N4) {
    const k = `${t.x + n.x},${t.y + n.y}`;
    if (!seen.has(k)) { seen.add(k); out.push({ x: t.x + n.x, y: t.y + n.y }); }
  }
  return out;
}

/** What a piece needs kept clear to be used: 'sides' (a bed), 'front' (a chair), 'access' (its access tile), 'ring'. */
export function useKind(id: string, def: ModuleDef, x: number, y: number, rot: number): 'sides' | 'front' | 'access' | 'ring' | null {
  if (def.airlock || hullRow(def, x, y, rot).length > 0) return null;
  if (SLEEP.has(id)) return 'sides';
  if (id === CHAIR) return 'front';
  if (!def.solid) return null;
  const a = accessTile(def, x, y, rot);
  if (a && !footprintTiles(def, x, y, rot).some((t) => t.x === a.x && t.y === a.y)) return 'access';
  return TABLE.has(id) ? null : 'ring';
}
