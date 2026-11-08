import { ammoCount, consumeAmmo } from '../combat/ammo';
import type { Sim } from '../sim';
import { ModuleC } from '../modules/components';
import type { Downed } from './components';

/**
 * The heal multiplier of a patient's stay in a medical bed (`ModuleDef.medical`): the first tick of a stay with a medicinal item in the ship's stock
 * (`ItemDef.medicine`) uses one up (the best one) and the patient heals that much faster until they get up. 1 in an ordinary bed or without any.
 */
export function treatmentMult(sim: Sim, shipId: number, downed: Downed): number {
  if (downed.treated) return downed.treated;
  const bed = sim.world.get(downed.bed, ModuleC);
  if (!bed || !sim.content.modules[bed.def]?.medical) return 1;
  let best: { item: string; mult: number } | null = null;
  for (const [item, def] of Object.entries(sim.content.items)) {
    if (def.medicine && (!best || def.medicine.healMult > best.mult) && ammoCount(sim, shipId, item) > 0) best = { item, mult: def.medicine.healMult };
  }
  if (!best || !consumeAmmo(sim, shipId, best.item)) return 1;
  downed.treated = best.mult;
  sim.events.emit({ type: 'crew.treated', bed: downed.bed, item: best.item, ship: shipId });
  return best.mult;
}
