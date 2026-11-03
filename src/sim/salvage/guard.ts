import { shipById } from '../combat/ships';
import type { Sim } from '../sim';

/** True for a derelict wreck: the build tools never work on one (salvage is the only way to take it apart). */
export function isWreck(sim: Sim, ship: number): boolean {
  return shipById(sim, ship)?.state === 'wreck';
}
