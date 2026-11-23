import type { Region, RegionGrid } from './regions';

/** What a compiled `RegionGrid` is asked after the wall rule: stranded floor. */

/**
 * Floor that cannot be walked to from the first hall, as [x, y, region] of one tile a stranded region: a room with no
 * door, or a hall cut off from the rest (but not a region standing `apart`: a module reached across open ground). The fit-out places nothing solid while any floor is stranded.
 */
export function stranded(g: RegionGrid, cell: string[] = g.compile()): [number, number, number][] {
  const apart = g.apart;
  const { size, half } = g;
  const walk = (k: number): boolean => cell[k] === '_' || cell[k] === 'D';
  const start = cell.findIndex((c, k) => c === '_' && (g.own[k] as number) >= 0 && (g.regions[g.own[k] as number] as Region).hall);
  if (start < 0) return [];
  const seen = new Uint8Array(cell.length);
  const stack = [start];
  seen[start] = 1;
  while (stack.length > 0) {
    const k = stack.pop() as number;
    for (const j of [k - 1, k + 1, k - size, k + size]) if (j >= 0 && j < cell.length && !seen[j] && walk(j)) { seen[j] = 1; stack.push(j); }
  }
  const out = new Map<number, [number, number, number]>();
  for (let k = 0; k < cell.length; k++) {
    if (cell[k] !== '_' || seen[k]) continue;
    const id = g.own[k] as number;
    if (apart.has(id)) continue;
    if (!out.has(id)) out.set(id, [(k % size) - half, Math.floor(k / size) - half, id]);
  }
  return [...out.values()];
}
