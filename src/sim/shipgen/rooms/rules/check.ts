import { accessTiles, footprintTiles, openTilesOf, type Tile } from '../../../modules/footprint';
import type { ModuleDef } from '../../../registry';

/** A module in room or layout tiles. Rot 0 faces south (its user stands below it), 1 west, 2 north, 3 east. */
export interface Piece { def: string; x: number; y: number; rot: number }

/**
 * Whether a furnished room works (the one owner of this question for the rule furnisher, its tests and the mocks): no
 * piece overlaps another or leaves the floor, every access tile is open floor, every entry (the floor tile inside each
 * door) is open, and open floor flooded from the first entry, never across furniture (beds and chairs included, but through a
 * module's own open tiles, the seat notch of a research module), reaches every entry, every piece (an access tile, or a tile beside it when it has none) and every free floor tile.
 * Returns the problems found, none when the room works.
 */
export function roomProblems(floor: (x: number, y: number) => boolean, entries: readonly Tile[], pieces: readonly Piece[], defs: Record<string, ModuleDef>): string[] {
  const out: string[] = [];
  const key = (x: number, y: number): number => (y + 4096) * 8192 + x + 4096;
  const taken = new Map<number, string>(), open = new Set<number>();
  for (const p of pieces) {
    const d = defs[p.def];
    if (!d) { out.push(`no module ${p.def}`); continue; }
    for (const t of footprintTiles(d, p.x, p.y, p.rot)) {
      const k = key(t.x, t.y);
      if (!floor(t.x, t.y)) out.push(`${p.def} at ${p.x},${p.y} leaves the floor`);
      if (taken.has(k)) out.push(`${p.def} at ${p.x},${p.y} overlaps ${taken.get(k)}`);
      taken.set(k, p.def);
    }
    for (const t of openTilesOf(d, p.x, p.y, p.rot)) open.add(key(t.x, t.y));
  }
  for (const p of pieces) {
    const d = defs[p.def];
    if (!d) continue;
    const own = new Set(footprintTiles(d, p.x, p.y, p.rot).map((t) => key(t.x, t.y)));
    for (const t of accessTiles(d, p.x, p.y, p.rot)) {
      if (!own.has(key(t.x, t.y)) && (!floor(t.x, t.y) || taken.has(key(t.x, t.y)))) out.push(`${p.def} at ${p.x},${p.y}: access ${t.x},${t.y} blocked`);
    }
  }
  for (const e of entries) if (taken.has(key(e.x, e.y))) out.push(`entry ${e.x},${e.y} blocked`);
  const first = entries[0];
  if (!first) return [...out, 'no entry'];
  const reach = new Set<number>();
  const todo: Tile[] = [first];
  let free = 0;
  while (todo.length > 0) {
    const t = todo.pop() as Tile, k = key(t.x, t.y);
    if (reach.has(k) || (taken.has(k) && !open.has(k)) || !floor(t.x, t.y)) continue;
    reach.add(k);
    todo.push({ x: t.x + 1, y: t.y }, { x: t.x - 1, y: t.y }, { x: t.x, y: t.y + 1 }, { x: t.x, y: t.y - 1 });
  }
  for (const e of entries) if (!reach.has(key(e.x, e.y))) out.push(`entry ${e.x},${e.y} cut off`);
  for (const p of pieces) {
    const d = defs[p.def];
    if (!d) continue;
    const at = accessTiles(d, p.x, p.y, p.rot);
    const near = at.length > 0 ? at : footprintTiles(d, p.x, p.y, p.rot).flatMap((t) => [{ x: t.x + 1, y: t.y }, { x: t.x - 1, y: t.y }, { x: t.x, y: t.y + 1 }, { x: t.x, y: t.y - 1 }]);
    if (!near.some((t) => reach.has(key(t.x, t.y)))) out.push(`${p.def} at ${p.x},${p.y} unreachable`);
  }
  // Free floor cut off: counted over the floor the pieces and the flood know, plus its ring (enough for any room shape).
  const seen = new Set<number>();
  const visit: Tile[] = [first];
  while (visit.length > 0) {
    const t = visit.pop() as Tile, k = key(t.x, t.y);
    if (seen.has(k) || !floor(t.x, t.y)) continue;
    seen.add(k);
    if (!taken.has(k) || open.has(k)) free++;
    visit.push({ x: t.x + 1, y: t.y }, { x: t.x - 1, y: t.y }, { x: t.x, y: t.y + 1 }, { x: t.x, y: t.y - 1 });
  }
  if (free > reach.size) out.push(`${free - reach.size} floor tile(s) cut off`);
  return out;
}
