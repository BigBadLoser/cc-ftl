import { AssignmentC, CrewC, JobC, PositionC } from '../crew/components';
import type { Tile } from '../crew/pathfind';
import { CarryingC } from '../items/components';
import { isTileWalkable } from '../modules/walk';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { CartRestC, StasisC } from './components';
import { floorTiles } from './place';
import { floorSlabs, onCart, walking } from './query';
import { SLAB_ITEM } from './tuning';

/** The four sides a cart can stand on, in the order ties are broken. */
const SIDES: readonly (readonly [number, number])[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];

/** Where the carrier's job points (the prisoner while sealing, the hatch while stowing, the source while fetching), or null. */
function targetOf(sim: Sim, crew: number): Tile | null {
  const job = sim.world.get(sim.world.get(crew, AssignmentC)?.jobId ?? 0, JobC);
  return job ? { x: job.x, y: job.y } : null;
}

/**
 * Where a cart parks beside a carrier standing on `at`: two free floor tiles straight out from them on one side (the near one beside them), on
 * the side most toward `target` first and never covering it, else any side; null when no side has room. `cartRest` (query.ts) documents the rule.
 */
export function parkCart(sim: Sim, crew: number, at: Tile, target: Tile | null): { x: number; y: number; rot: 0 | 1 } | null {
  const ship = shipIdOf(sim, at);
  const grid = shipGrid(sim, ship);
  if (!grid) return null;
  const taken = new Set<string>();
  for (const s of floorSlabs(sim.world)) for (const t of s.tiles) taken.add(`${t.x},${t.y}`);
  for (const id of sim.world.query(CartRestC)) {
    const r = sim.world.get(id, CartRestC);
    if (r && id !== crew) for (const t of floorTiles(r.x, r.y, r.rot)) taken.add(`${t.x},${t.y}`);
  }
  if (target) taken.add(`${target.x},${target.y}`);
  const free = (x: number, y: number): boolean => grid.inBounds(x, y) && isTileWalkable(sim, grid, x, y) && grid.get('struct', x, y) !== Struct.Door && !taken.has(`${x},${y}`);
  const toward = ([dx, dy]: readonly [number, number]): number => (target ? dx * (target.x - at.x) + dy * (target.y - at.y) : 0);
  const sides = SIDES.map((d, i) => ({ d, i })).sort((a, b) => toward(b.d) - toward(a.d) || a.i - b.i);
  for (const { d: [dx, dy] } of sides) {
    const near = { x: at.x + dx, y: at.y + dy }, far = { x: at.x + 2 * dx, y: at.y + 2 * dy };
    if (!free(near.x, near.y) || !free(far.x, far.y)) continue;
    return { x: Math.min(near.x, far.x), y: Math.min(near.y, far.y), rot: dx !== 0 ? 0 : 1 };
  }
  return null;
}

/** Each tick: a carrier who stopped gets their cart parked once (kept while they stand); walking or no longer carting clears it. */
export function keepCartRests(sim: Sim): void {
  for (const id of [...sim.world.query(CartRestC)]) {
    if (!onCart(sim.world, id) || walking(sim.world, id)) sim.world.remove(id, CartRestC);
  }
  const carriers = new Set<number>();
  // Crew, not a `CarryingC` query: querying makes the store exist, and runs that never carried anything keep their saved shape.
  for (const id of sim.world.query(CrewC)) if (sim.world.get(id, CarryingC)?.item === SLAB_ITEM) carriers.add(id);
  for (const id of sim.world.query(StasisC)) {
    const s = sim.world.get(id, StasisC);
    if (s?.at === 'carried') carriers.add(s.carrier);
  }
  for (const crew of [...carriers].sort((a, b) => a - b)) {
    const pos = sim.world.get(crew, PositionC);
    if (!pos || sim.world.has(crew, CartRestC) || walking(sim.world, crew)) continue;
    const rest = parkCart(sim, crew, { x: pos.x, y: pos.y }, targetOf(sim, crew));
    if (rest) sim.world.add(crew, CartRestC, rest);
  }
}
