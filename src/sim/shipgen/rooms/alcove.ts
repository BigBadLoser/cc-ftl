/**
 * A corridor alcove's furniture (#581): its pieces side by side, a tile between, centred on its long far wall (the
 * longest run of floor against the wall across from the corridor it opens on), facing the corridor.
 */
import type { Layout } from '../layout';

/** Places `mods` in alcove `room`; the indices placed, or null (nothing placed) where they do not stand there. */
export function furnishAlcove(lay: Layout, room: number, mods: readonly string[]): number[] | null {
  const tiles = lay.roomTiles(room), mine = (x: number, y: number): boolean => lay.at(x, y) === '_' && lay.roomOf[y * lay.w + x] === room;
  const open = (x: number, y: number): boolean => lay.at(x, y) === '_' && lay.roomOf[y * lay.w + x] !== room;
  // (Which way the corridor lies: below the alcove or above it.)
  let down = 0, up = 0;
  for (const t of tiles) { const x = t % lay.w, y = Math.floor(t / lay.w); if (open(x, y + 1)) down++; if (open(x, y - 1)) up++; }
  if (down === up) return null;
  const away = down > up ? -1 : 1, rot = down > up ? 0 : 2;
  // The far wall's runs: floor with wall beyond it, row by row; the longest.
  let best = { y: 0, x0: 0, x1: -1 };
  for (const t of tiles) {
    const x = t % lay.w, y = Math.floor(t / lay.w);
    if (mine(x - 1, y) && lay.at(x - 1, y + away) !== '_' ) continue;
    if (lay.at(x, y + away) === '_') continue;
    let x1 = x;
    while (mine(x1 + 1, y) && lay.at(x1 + 1, y + away) !== '_') x1++;
    if (x1 - x > best.x1 - best.x0) best = { y, x0: x, x1 };
  }
  const ws = mods.map((m) => lay.defs[m]?.footprint[0] ?? 1), span = ws.reduce((a, b) => a + b, 0) + mods.length - 1;
  if (span > best.x1 - best.x0 + 1) return null;
  const start = lay.modules.length;
  let x = best.x0 + Math.floor((best.x1 - best.x0 + 1 - span) / 2);
  for (const [i, m] of mods.entries()) {
    const h = lay.defs[m]?.footprint[1] ?? 1, y = away < 0 ? best.y : best.y - h + 1;
    if (lay.fitError(m, x, y, rot, room) !== null) { while (lay.modules.length > start) lay.pop(); return null; }
    lay.push({ def: m, x, y, rot });
    x += (ws[i] as number) + 1;
  }
  return lay.modules.slice(start).map((_, i) => start + i);
}
