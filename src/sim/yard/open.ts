import { shipGrid } from '../regions';
import type { Sim } from '../sim';
import { Struct, writeStruct } from '../structure';
import { NORMAL_CO2, NORMAL_O2, NORMAL_TEMP } from '../tuning';
import type { YardOrder } from './types';

type Tile = { x: number; y: number };
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
const key = (t: Tile): string => `${t.x},${t.y}`;

/**
 * The walls an order's build has turned inward: the ship's old outer hull where the new section joins on, and any of the order's own walls laid
 * against it (a plan drawn beside the hull rather than over it). A candidate is a plain wall (no module on it) that is one of the order's walls or
 * touches one of its tiles side on; it opens once no tile round it, corners included, is open space, a truss or another ship's, so the outer
 * ring (and every wall still facing out, like a cross wall before the rest of the plan) stays shut. Interior walls of the old ship never touch
 * the new tiles, so the rooms the player built are left alone.
 */
export function innerWalls(sim: Sim, o: YardOrder): Tile[] {
  const grid = shipGrid(sim, o.ship);
  if (!grid) return [];
  const order = new Set([...o.floor, ...o.walls].map(key));
  const own = (x: number, y: number): boolean => grid.inBounds(x, y) && grid.get('ship', x, y) === o.ship;
  const shut = (x: number, y: number): boolean => own(x, y) && grid.get('struct', x, y) !== Struct.Space && grid.get('struct', x, y) !== Struct.Beam;
  const cand = new Map<string, Tile>();
  const consider = (t: Tile): void => {
    if (!own(t.x, t.y) || grid.get('struct', t.x, t.y) !== Struct.Wall || (grid.has('module') && grid.get('module', t.x, t.y) !== 0)) return;
    if (N8.every(([dx, dy]) => shut(t.x + dx, t.y + dy))) cand.set(key(t), t);
  };
  for (const w of o.walls) consider(w);
  for (const t of [...o.floor, ...o.walls]) {
    for (const [dx, dy] of N4) {
      const n = { x: t.x + dx, y: t.y + dy };
      if (!order.has(key(n))) consider(n);
    }
  }
  return [...cand.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

/** The air of the room a section joins: the mean of the ship's floor tiles across the walls it opens (normal air when it joins none). */
function joinedAir(sim: Sim, o: YardOrder, walls: readonly Tile[]): NonNullable<YardOrder['air']> {
  const grid = sim.sector.grid;
  const order = new Set([...o.floor, ...o.walls].map(key));
  let n = 0, o2 = 0, co2 = 0, temp = 0;
  for (const w of walls) {
    for (const [dx, dy] of N4) {
      const x = w.x + dx, y = w.y + dy;
      if (order.has(`${x},${y}`) || grid.get('struct', x, y) !== Struct.Floor || grid.get('ship', x, y) !== o.ship) continue;
      n++;
      o2 += grid.get('o2', x, y);
      co2 += grid.get('co2', x, y);
      temp += grid.get('temp', x, y);
    }
  }
  return n ? { o2: o2 / n, co2: co2 / n, temp: temp / n } : { o2: NORMAL_O2, co2: NORMAL_CO2, temp: NORMAL_TEMP };
}

/** Give tiles the order's air (o2, co2, temperature), through the grid. */
function fill(sim: Sim, tiles: readonly Tile[], air: NonNullable<YardOrder['air']>): void {
  const grid = sim.sector.grid;
  for (const t of tiles) {
    grid.set('o2', t.x, t.y, air.o2);
    grid.set('co2', t.x, t.y, air.co2);
    grid.set('temp', t.x, t.y, air.temp);
  }
}

/**
 * Whether turning the wall at `t` to floor would let air out: the section's own floor, and the old walls already opened into it, are walked from the
 * tiles beside the wall, and any of them touching open space, a truss or another ship's tile is a breach. (Ship floor beyond the opened walls is not
 * walked: a hole elsewhere in the old ship is not this wall's doing.)
 */
function breaches(sim: Sim, o: YardOrder, t: Tile, patch: Set<string>): boolean {
  const grid = shipGrid(sim, o.ship);
  if (!grid) return true;
  const seen = new Set<string>();
  const stack = N4.map(([dx, dy]) => ({ x: t.x + dx, y: t.y + dy })).filter((n) => patch.has(key(n)));
  while (stack.length) {
    const c = stack.pop() as Tile;
    if (seen.has(key(c))) continue;
    seen.add(key(c));
    for (const [dx, dy] of N4) {
      const n = { x: c.x + dx, y: c.y + dy };
      if (n.x === t.x && n.y === t.y) continue;
      if (!grid.inBounds(n.x, n.y) || grid.get('ship', n.x, n.y) !== o.ship || grid.get('struct', n.x, n.y) === Struct.Space || grid.get('struct', n.x, n.y) === Struct.Beam) return true;
      if (patch.has(key(n))) stack.push(n);
    }
  }
  return false;
}

/**
 * The old hull a build has turned inward goes at once, with no crew job: each wall `innerWalls` finds (no open space round it, corners included) that
 * would not let the air out of the section (`breaches`) becomes floor, takes the air of the room it joins, and the section's floor takes it too.
 * Called while the crew work, so a wall goes the moment the wall that shuts it in is built. Repeats until nothing more is safe to open (one opening
 * can free the next). Returns how many walls opened.
 */
export function openInnerWalls(sim: Sim, o: YardOrder): number {
  const grid = shipGrid(sim, o.ship);
  if (!grid) return 0;
  const patch = new Set(o.floor.filter((t) => grid.get('struct', t.x, t.y) === Struct.Floor).map(key));
  for (const t of o.opens ?? []) patch.add(key(t));
  let total = 0;
  for (;;) {
    const ready = innerWalls(sim, o).filter((t) => !breaches(sim, o, t, patch));
    if (!ready.length) return total;
    o.air ??= joinedAir(sim, o, ready);
    for (const t of ready) {
      writeStruct(grid, t.x, t.y, Struct.Floor);
      patch.add(key(t));
    }
    fill(sim, [...patch].map((k) => ({ x: Number(k.split(',')[0]), y: Number(k.split(',')[1]) })), o.air);
    o.opens = [...(o.opens ?? []), ...ready];
    total += ready.length;
  }
}
