import { shipIdOf, shipGrid } from '../regions';
import type { Job } from '../crew/components';
import type { Sim } from '../sim';
import { airlockUsable, donSuit, doffSuit, isSuited, isThin } from './suit';
import { PositionC } from '../crew/components';
import { drawAir } from './airLedger';
import { startRefillFloat } from './refillFloat';
import { VehicleC } from '../vehicles/components';

/**
 * One tick of a suit or refill errand at the airlock `job.target`. Fitting takes `donSec` and gives the crew member a full suit
 * from the airlock's stock (if another got the last one meanwhile, the errand just ends). Taking it off takes `doffSec`,
 * stows the suit there with a full tank, and waits while the air at the spot is thin.
 */
export function performSuitJob(sim: Sim, crew: number, job: Job, speed: number): 'done' | 'working' | 'wait' {
  const airlock = job.target ?? 0;
  if (job.kind === 'refill' && sim.world.has(airlock, VehicleC)) {
    job.progress = Math.min(job.work, job.progress + speed);
    if (job.progress < job.work) return 'working';
    startRefillFloat(sim, crew, airlock); // at the hull tile of the hatch: drift out and back, the tank swapped at the turn
    return 'done';
  }
  if (!airlockUsable(sim, airlock)) return 'done';
  const pos = sim.world.get(crew, PositionC);
  const grid = pos && shipGrid(sim, shipIdOf(sim, pos));
  if (job.kind === 'suitOff' && grid && pos && isThin(grid, pos.x, pos.y)) return 'wait';
  job.progress = Math.min(job.work, job.progress + speed);
  if (job.progress < job.work) return 'working';
  if (job.kind === 'refill') drawAir(sim, crew, { kind: 'airlock', id: airlock });
  else if (job.kind === 'suitUp') donSuit(sim, crew, airlock);
  else if (isSuited(sim, crew)) doffSuit(sim, crew, airlock);
  return 'done';
}
