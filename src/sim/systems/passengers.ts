import { tendCarried } from '../scene/carried';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';

/** Once a second, in any grid: what happens to a passenger a scene handed on is the event's to answer, after its pocket is gone too (scene/carried.ts). */
export function passengerSystem(sim: Sim): void {
  if (sim.tick % TICK_HZ !== 0) return;
  tendCarried(sim);
}
