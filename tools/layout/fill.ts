/** The Room tool's fill: a click inside an enclosed open area floors exactly that area as a new room, whatever its shape. */
import { inBounds, outsideOf, paint, type Layout, type Tile } from './layout';

/** The open tiles joined (four ways) to (x, y), when they are enclosed (none reaches outside the ship); null on a tile that is not open or not enclosed. */
export function enclosedAt(l: Layout, x: number, y: number): Tile[] | null {
  const open = (tx: number, ty: number): boolean => inBounds(l, tx, ty) && l.cells[ty]?.[tx] === '.';
  if (!open(x, y) || outsideOf(l).has(y * l.width + x)) return null;
  const seen = new Set<number>([y * l.width + x]), todo: Tile[] = [[x, y]], out: Tile[] = [];
  while (todo.length) {
    const [tx, ty] = todo.pop() as Tile;
    out.push([tx, ty]);
    for (const [nx, ny] of [[tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1]] as Tile[]) {
      const i = ny * l.width + nx;
      if (open(nx, ny) && !seen.has(i)) { seen.add(i); todo.push([nx, ny]); }
    }
  }
  return out;
}

/** Floor an enclosed area as room `id` of `role` (its walls stay as they are). */
export function fillRoom(l: Layout, tiles: readonly Tile[], role: string, id: number): Layout {
  const rooms = l.rooms.map((r) => ({ ...r }));
  while (rooms.length < id) rooms.push({ role: 'hall' });
  rooms[id] = { role };
  return paint({ ...l, rooms }, tiles, '_', id);
}
