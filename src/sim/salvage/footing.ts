import { CrewC, DeadC, PositionC } from '../crew/components';
import type { ShipGrid } from '../shipGrid';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';

/**
 * Floors that strand nobody when they come down (#286 slice 3). Stripping a wreck must not cut its crew off: a floor that splits the deck
 * left (an articulation tile of the Floor and Door tiles, 4-neighbour) would leave a piece nobody can walk to, and a floor that is the only
 * footing of the tile a crew member stands on (a hull-ring tile beside it, or the floor itself) would leave them floating with nothing to
 * walk on. Taking only floors that do neither keeps the deck one piece down to its last tile, which is the only one that has to strand
 * whoever takes it (the site's pickup and closing lift fetch them).
 */

interface Tile { x: number; y: number }

const deck = (grid: ShipGrid, ship: number, x: number, y: number): boolean => {
  if (!grid.inBounds(x, y) || grid.get('ship', x, y) !== ship) return false;
  const k = grid.get('struct', x, y);
  return k === Struct.Floor || k === Struct.Door;
};

/** The deck tiles whose removal splits the deck (iterative Tarjan over each piece), as `y * 4096 + x` keys. */
function cutTiles(grid: ShipGrid, ship: number): Set<number> {
  const key = (x: number, y: number): number => y * 4096 + x;
  const order = new Map<number, number>();
  const low = new Map<number, number>();
  const cut = new Set<number>();
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  let n = 0;
  for (let y0 = grid.y0; y0 < grid.y0 + grid.height; y0++) {
    for (let x0 = grid.x0; x0 < grid.x0 + grid.width; x0++) {
      if (!deck(grid, ship, x0, y0) || order.has(key(x0, y0))) continue;
      const root = key(x0, y0);
      order.set(root, n);
      low.set(root, n++);
      let rootKids = 0;
      const stack: { x: number; y: number; parent: number; i: number }[] = [{ x: x0, y: y0, parent: -1, i: 0 }];
      while (stack.length) {
        const f = stack[stack.length - 1]!;
        const k = key(f.x, f.y);
        if (f.i < steps.length) {
          const [dx, dy] = steps[f.i++]!;
          const x = f.x + dx, y = f.y + dy, c = key(x, y);
          if (!deck(grid, ship, x, y) || c === f.parent) continue;
          if (order.has(c)) {
            low.set(k, Math.min(low.get(k)!, order.get(c)!));
            continue;
          }
          order.set(c, n);
          low.set(c, n++);
          if (k === root) rootKids++;
          stack.push({ x, y, parent: k, i: 0 });
          continue;
        }
        stack.pop();
        if (f.parent < 0) continue;
        low.set(f.parent, Math.min(low.get(f.parent)!, low.get(k)!));
        if (f.parent !== root && low.get(k)! >= order.get(f.parent)!) cut.add(f.parent);
      }
      if (rootKids > 1) cut.add(root);
    }
  }
  return cut;
}

/** True if tile p still has something to stand on (a non-Space tile itself, or one beside it) once `t` is Space. */
function footing(grid: ShipGrid, p: Tile, t: Tile): boolean {
  const solid = (x: number, y: number): boolean => !(x === t.x && y === t.y) && grid.inBounds(x, y) && grid.get('struct', x, y) !== Struct.Space;
  if (solid(p.x, p.y)) return true;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && solid(p.x + dx, p.y + dy)) return true;
  return false;
}

/** Of `floors` (deck tiles of `ship`), those that strand nobody when they come down; all of them when none does (the last tile). */
export function strandNobody<T extends Tile>(sim: Sim, ship: number, floors: T[]): T[] {
  const grid = shipGrid(sim, ship);
  if (!grid || floors.length <= 1) return floors;
  const cut = cutTiles(grid, ship);
  const standing: Tile[] = [];
  for (const id of sim.world.query(CrewC, PositionC)) {
    const p = sim.world.get(id, PositionC)!;
    if (!sim.world.has(id, DeadC) && shipIdOf(sim, p) === ship) standing.push({ x: p.x, y: p.y });
  }
  const safe = floors.filter((t) => !cut.has(t.y * 4096 + t.x) && standing.every((p) => Math.max(Math.abs(p.x - t.x), Math.abs(p.y - t.y)) > 1 || footing(grid, p, t)));
  return safe.length ? safe : floors;
}
