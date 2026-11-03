import { JobC, PathC } from '../../crew/components';
import type { Tile } from '../../crew/pathfind';
import type { AirSource } from '../../eva/sources';
import type { Sim } from '../../sim';
import { TICK_HZ } from '../../time';
import { REFILL_FILL_SEC } from '../../tuning';
import { attachJob } from '../task';

/**
 * The refill machine (docs/ARCHITECTURE.md "Refill machine"): `ToAirlock` (the walk), then `Fill`, at an airlock's suit tile (3 s, the tank
 * filled from its store) or at a hovering shuttle's hatch spot (`Fill` is the moment at the hull, then the crew member drifts out and back
 * on an `EvaFloat {mode: 'refill'}` and the tank is filled at the turn). It is a personal errand job like a suit errand, so it nests the
 * same way: started with `resume` it sets the job it was started for aside and hands it back when the tank is full. `Fill` is `finish`
 * class (only hard reasons end it).
 */

/** Start a refill errand for a crew member at `src`; `steps` is the walk to its tile. Returns the errand's job entity. */
export function startRefill(sim: Sim, crew: number, src: AirSource, steps: readonly Tile[], resume?: number): number {
  const id = sim.world.createEntity();
  sim.world.add(id, JobC, {
    category: 'operating', kind: 'refill', x: src.tile.x, y: src.tile.y, struct: 0, progress: 0, reservedBy: crew,
    work: Math.max(1, src.kind === 'airlock' ? Math.round(REFILL_FILL_SEC * TICK_HZ) : 1),
    target: src.id, errandFor: crew, ...(resume ? { resume, heldSince: sim.tick } : {}),
  });
  attachJob(sim, crew, id);
  (sim.world.get(crew, PathC) as { steps: Tile[] }).steps = [...steps];
  return id;
}
