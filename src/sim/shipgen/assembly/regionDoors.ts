import type { Region, RegionGrid, Shape } from './regions';

/**
 * Doors for one room of a compiled grid (`RegionGrid.compile`): straight wall tiles with its floor on one side and an
 * allowed region's floor opposite, within a tile of its painted extent `sh`. Onto a hall where the room touches one; a
 * room it may open into (`access`) is the way in only where no hall is. One door in the middle of the frontage (its
 * bow end with `doorFirst`), several spread along it; in a wall along `doorAlong` where there is one.
 */
export function addDoors(cell: string[], id: number, rg: Region, sh: Shape, grid: Pick<RegionGrid, 'half' | 'at' | 'regions'>): void {
  const half = grid.half, size = 2 * half;
  const c = (x: number, y: number): string => (x < -half || y < -half || x >= half || y >= half ? '.' : (cell[(y + half) * size + x + half] as string));
  const floor = (x: number, y: number): number => (c(x, y) === '_' ? grid.at(x, y) : -3);
  const hall = (b: number): boolean => b >= 0 && b !== id && (grid.regions[b] as Region).hall;
  const ok = (b: number): boolean => b >= 0 && b !== id && (rg.access ? rg.access.includes(b) : hall(b));
  const cands: [number, number][] = [], onHall: [number, number][] = [], along: [number, number][] = [];
  const ya = Math.max(-half + 1, sh.y0 - 1), yb = Math.min(half - 2, sh.y1 + 1), xa = Math.max(-half + 1, sh.x0 - 1), xb = Math.min(half - 2, sh.x1 + 1);
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    if (c(x, y) !== '#') continue;
    const n = floor(x, y - 1), s = floor(x, y + 1), e = floor(x + 1, y), w = floor(x - 1, y);
    const alongX = c(x - 1, y) === '#' && c(x + 1, y) === '#', alongY = c(x, y - 1) === '#' && c(x, y + 1) === '#';
    const inX = alongX && ((n === id && ok(s)) || (s === id && ok(n))), inY = alongY && ((e === id && ok(w)) || (w === id && ok(e)));
    if (!inX && !inY) continue;
    ([n, s, e, w].some(hall) ? onHall : cands).push([x, y]);
    if ([n, s, e, w].some(hall) && ((rg.doorAlong === 'x' && inX) || (rg.doorAlong === 'y' && inY))) along.push([x, y]);
  }
  const pick = along.length > 0 ? along : onHall.length > 0 ? onHall : cands;
  for (let k = 0; k < Math.min(rg.doors, pick.length); k++) {
    const [x, y] = (rg.doorFirst ? pick.reduce((a, b) => (b[0] < a[0] || (b[0] === a[0] && b[1] < a[1]) ? b : a)) : pick[Math.floor(((k + 0.5) * pick.length) / Math.min(rg.doors, pick.length))]) as [number, number];
    cell[(y + half) * size + x + half] = 'D';
  }
}
