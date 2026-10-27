import { ShipC } from '../combat/components';
import type { Sim } from '../sim';
import { HullPlanC } from './types';

/**
 * The ship's plan loses a tile: its truss was taken down with the ordinary deconstruct job (the player gave that tile up). The plan stays
 * otherwise as it is; an empty plan is cleared.
 */
export function dropPlanTile(sim: Sim, ship: number, x: number, y: number): void {
  const plan = sim.world.get(ship, HullPlanC);
  if (!plan || !sim.world.has(ship, ShipC)) return;
  plan.tiles = plan.tiles.filter((t) => t.x !== x || t.y !== y);
  if (plan.tiles.length === 0) sim.world.remove(ship, HullPlanC);
}
