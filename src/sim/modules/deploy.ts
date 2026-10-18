import type { Sim } from '../sim';
import { DEPLOY_GATES_ACTIONS } from '../tuning';
import { DeployC } from './components';
import { ModuleC } from './components';

/** True when the module's roof part is fully out, or when it has none, or when deploy gating is switched off. */
export function isDeployed(sim: Sim, id: number): boolean {
  if (!DEPLOY_GATES_ACTIONS) return true;
  const m = sim.world.get(id, ModuleC);
  if (!m || sim.content.modules[m.def]?.deploySec === undefined) return true;
  return (sim.world.get(id, DeployC)?.amount ?? 0) >= 1;
}
