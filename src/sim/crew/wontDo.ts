import type { Sim } from '../sim';
import { WontDoC, type WontDoId } from './background';
import { traitDefs } from './traits';

/** The one owner of "will this crew member not do this": their `WontDoC`, or a trait that says so (old saves, debug-set traits). */
export function wontDo(sim: Sim, id: number, what: WontDoId): boolean {
  if (sim.world.get(id, WontDoC)?.ids.includes(what)) return true;
  return traitDefs(sim, id).some((d) => d.wontDo === what);
}
