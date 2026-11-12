import { abortTask } from '../ai/task';
import type { Sim } from '../sim';
import { releaseBedOwner } from './beds';

/**
 * A crew member leaves play alive (a visiting guest taken home, an enemy crew let go or released): their job and bed claim are dropped and the
 * entity is removed, no corpse. The one owner of "gone, not dead" (`killCrew` is the other way out).
 */
export function removeCrew(sim: Sim, id: number): void {
  abortTask(sim, id, 'removed');
  releaseBedOwner(sim, id);
  sim.world.destroyEntity(id);
}
