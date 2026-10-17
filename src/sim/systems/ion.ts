import { IonC } from '../combat/components';
import type { Sim } from '../sim';

/** Ends ion disablement when its timer runs out (the power system skips modules that carry IonC). */
export function ionSystem(sim: Sim): void {
  for (const id of [...sim.world.query(IonC)]) {
    if ((sim.world.get(id, IonC)?.until ?? 0) <= sim.tick) sim.world.remove(id, IonC);
  }
}
