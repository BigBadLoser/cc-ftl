import { BodyC } from '../body';
import { shipById } from '../combat/ships';
import { breachesOf } from '../crew/breach';
import type { Job } from '../crew/components';
import { BUILD_TICKS } from '../crew/handlers';
import { findJobAt } from '../crew/helpers';
import { finishStruct } from '../crew/jobWork';
import { destroyJob, structCostKey } from '../items/stacks';
import { shipGrid } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { TICK_HZ } from '../time';
import { EMPTY_CHARGE_MULT } from '../tuning';
import type { Drone, DroneTarget } from './components';
import { steer } from './space';
import type { DroneJobDef } from './types';
import type { Candidate, KindRules } from './work';

type Seal = Extract<DroneJobDef, { kind: 'seal' }>;

/**
 * What one wall costs in the drone's supply item (`structCosts`, the crew's own wall cost), or null when its supply does not cover the whole
 * cost (a drone carries one item): then it takes no seal work.
 */
export function sealCost(sim: Sim, d: Drone): number | null {
  const supply = sim.content.drones?.[d.def]?.supply;
  const key = structCostKey(Struct.Wall);
  const cost = key ? sim.content.structCosts[key] ?? [] : [];
  if (!supply || cost.some((q) => q.item !== supply.item)) return null;
  const n = cost.reduce((t, q) => t + q.count, 0);
  return n <= supply.capacity ? n : null;
}

const isBreach = (sim: Sim, ship: number, x: number, y: number): boolean => {
  const grid = shipGrid(sim, ship);
  return !!grid && breachesOf(grid).some((t) => t.x === x && t.y === y);
};

/**
 * The repair drone's seal job (DESIGN.md "Drones"): from outside, close a hole in the hull of its own ship with a wall. It hovers over the
 * hole in space for the crew's wall time (over its `rate`), then the wall goes up through the crew's own finish (`finishStruct`) and the
 * drone's load pays the cost. Crew may be on the same hole; whoever finishes first wins and the other's job lapses.
 */
export const seal: KindRules<Seal> = {
  where: 'space',
  candidates(sim, ship, _job, d) {
    const grid = shipGrid(sim, ship);
    const cost = d && sealCost(sim, d);
    if (!grid || !d || cost === null || cost === undefined || (d.load ?? 0) < cost || shipById(sim, ship)?.state === 'wreck') return [];
    return breachesOf(grid).map((t) => ({ kind: 'seal', id: 0, x: t.x, y: t.y, rank: 0 }) satisfies Candidate);
  },
  valid: (sim, ship, t) => isBreach(sim, ship, t.x, t.y),
  work(sim, id, d, t, job) {
    const b = sim.world.get(id, BodyC);
    const def = sim.content.drones?.[d.def];
    const cost = sealCost(sim, d);
    if (!b || !def || cost === null || (d.load ?? 0) < cost) return 'done';
    if (!steer(b, t.x + 0.5, t.y + 0.5, def.speed * (d.charge <= 0 ? EMPTY_CHARGE_MULT : 1))) return 'working';
    d.work += 1 / TICK_HZ;
    if (d.work < (BUILD_TICKS[Struct.Wall] as number) / TICK_HZ / job.rate) return 'working';
    const wall: Job = { category: 'firefighting', kind: 'build', x: t.x, y: t.y, struct: Struct.Wall, work: 0, progress: 0, reservedBy: 0 };
    if (finishStruct(sim, wall) === 'wait') return 'working'; // someone stands on the hole: keep hovering and try again, nothing is spent
    const crew = findJobAt(sim, d.ship, t.x, t.y);
    if (crew) destroyJob(sim, crew); // the crew's wall job on this hole is no longer needed
    d.load = (d.load ?? 0) - cost;
    sim.events.emit({ type: 'drone.sealed', drone: id, ship: d.ship, x: t.x, y: t.y });
    return 'done';
  },
};

/** A seal claims its hole by tile. */
export const sealKey = (t: DroneTarget): string => `seal:${t.x},${t.y}`;
