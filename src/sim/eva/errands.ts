import type { Job, Position } from '../crew/components';
import { origin } from '../crew/helpers';
import { walkSignature, type Tile } from '../crew/pathfind';
import { hopField } from '../crew/hops';
import { ModuleC } from '../modules/components';
import { AirlockC } from '../modules/airlock';
import type { Sim } from '../sim';
import type { ShipGrid } from '../shipGrid';
import { planWalk } from './route';
import { airlockUsable, suitNeeded, suitTile } from './suit';
import { shipIdOf, shipGrid } from '../regions';

/** An airlock to fit or stow a suit at, with the walk to its suit tile. */
export interface SuitSource {
  airlock: number;
  steps: Tile[];
}

/** True for the personal errands the sim makes for a crew member (nobody else may pick them up). */
export function isErrand(job: Job): boolean {
  return job.kind === 'suitUp' || job.kind === 'suitOff' || job.kind === 'refill';
}

function onGrid(sim: Sim, airlock: number, shipId: number): boolean {
  return shipIdOf(sim, sim.world.get(airlock, ModuleC)) === shipId;
}

/**
 * The best airlock on the crew member's grid to get a suit from (any usable one has a suit, #416): one with a walk to its suit tile that
 * keeps out of thin air. Shortest walk wins, then the lowest module id. Null when there is none.
 */
export function findSuitSource(sim: Sim, crew: number, pos: Position): SuitSource | null {
  let best: SuitSource | null = null;
  for (const id of sim.world.query(AirlockC)) {
    const at = suitTile(sim, id);
    if (!at || !airlockUsable(sim, id) || !onGrid(sim, id, shipIdOf(sim, pos))) continue;
    const plan = planWalk(sim, crew, shipIdOf(sim, pos), origin(pos), at);
    if (!plan || plan.thin) continue;
    if (!best || plan.steps.length < best.steps.length) best = { airlock: id, steps: plan.steps };
  }
  return best;
}

/**
 * How much of the grid a crew member without a suit can walk from `at`: the walkable tiles they reach keeping out of thin air (the walk of
 * their own errands unsuited, `walkOpts`). Derived data, never saved: kept per grid while its walk signature holds.
 */
function airSpace(sim: Sim, shipId: number, grid: ShipGrid, at: Tile): number {
  const sig = walkSignature(sim, grid, true);
  let memo = airMemo.get(grid);
  if (!memo || memo.sig !== sig) airMemo.set(grid, (memo = { sig, size: new Map() }));
  const key = (at.y - grid.y0) * grid.width + (at.x - grid.x0);
  let n = memo.size.get(key);
  if (n === undefined) {
    const hops = hopField(sim, shipId, at, { avoidThin: true });
    n = 0;
    for (let y = grid.y0; hops && y < grid.y0 + grid.height; y++) for (let x = grid.x0; x < grid.x0 + grid.width; x++) if (hops(x, y) >= 0) n++;
    memo.size.set(key, n);
  }
  return n;
}
const airMemo = new WeakMap<ShipGrid, { sig: string; size: Map<number, number> }>();

/**
 * Where a suited crew member may take the suit off: an airlock on their grid whose suit tile has breathable air, in the biggest air space
 * they can reach, nearest first. Once unsuited they keep out of thin air, so a suit stowed in a side pocket of air (a greenhouse standing on
 * its own across open ground) would leave them stranded there, cut off from the beds, mess and stores. Where every airlock opens on the same
 * air (an ordinary ship) this is simply the nearest. The one answer to "where may a suit be stowed", for the idle stow and the player's order.
 */
export function findSuitStow(sim: Sim, crew: number, pos: Position): SuitSource | null {
  const shipId = shipIdOf(sim, pos);
  const grid = shipGrid(sim, shipId);
  let best: (SuitSource & { air: number }) | null = null;
  for (const id of sim.world.query(AirlockC)) {
    const at = suitTile(sim, id);
    if (!grid || !at || !airlockUsable(sim, id) || !onGrid(sim, id, shipId) || suitNeeded(grid, at.x, at.y)) continue;
    const air = airSpace(sim, shipId, grid, at);
    if (best && air < best.air) continue;
    const plan = planWalk(sim, crew, shipId, origin(pos), at);
    if (plan && (!best || air > best.air || plan.steps.length < best.steps.length)) best = { airlock: id, steps: plan.steps, air };
  }
  return best && { airlock: best.airlock, steps: best.steps };
}
