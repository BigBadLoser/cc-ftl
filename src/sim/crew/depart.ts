import { abortTask } from '../ai/task';
import type { Sim } from '../sim';
import { releaseBed, releaseBedOwner } from './beds';
import { DownedC, RecoveringC } from './components';

/**
 * A crew member leaves play alive (a visiting guest taken home, an enemy crew let go or released): their job and bed claim are dropped and the
 * entity is removed, no corpse. The one owner of "gone, not dead" (`killCrew` is the other way out).
 */
export function removeCrew(sim: Sim, id: number): void {
  abortTask(sim, id, 'removed');
  // A patient's bed reservation (downed on the floor with a bed claimed, lying in a bed or pod) goes with them, or the bed stays unusable.
  const downed = sim.world.get(id, DownedC);
  if (downed) releaseBed(sim, downed.bed, id);
  const rec = sim.world.get(id, RecoveringC);
  if (rec) releaseBed(sim, rec.bed, id);
  releaseBedOwner(sim, id);
  sim.world.destroyEntity(id);
}
