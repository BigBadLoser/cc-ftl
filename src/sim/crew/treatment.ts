import { ammoCount, consumeAmmo } from '../combat/ammo';
import type { Sim } from '../sim';
import { ModuleC } from '../modules/components';
import { skillOf } from '../combat/operators';
import { SKILL_STEP } from '../tuning';
import { AssignmentC, CrewC, DownedC, JobC, PositionC, RecoveringC, type Downed } from './components';
import { isIncapacitated } from './helpers';
import { careRank } from './care';

/**
 * The heal multiplier of a patient's stay in a medical bed (`ModuleDef.medical`; a recovery pod is one too, crew/recovery.ts): the first tick of a stay with a medicinal item in the ship's stock
 * (`ItemDef.medicine`) uses one up (the best one) and the patient heals that much faster until they get up. 1 in an ordinary bed or without any.
 */
export function treatmentMult(sim: Sim, shipId: number, downed: Pick<Downed, 'bed' | 'treated'>): number {
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

/**
 * Medical beds that have a patient to tend: a stabilised downed patient or a walking one lying in a medical bed (not a recovery pod: it needs no medic; never a still-fighting enemy, crew/care.ts).
 * The tend jobs follow this set (systems/autojobs.ts).
 */
export function bedsToTend(sim: Sim): Set<number> {
  const beds = new Set<number>();
  const medicalBed = (id: number): boolean => {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    return !!m && m.hp > 0 && !!def?.medical && !def.recovery;
  };
  for (const id of sim.world.query(DownedC)) {
    const d = sim.world.get(id, DownedC);
    if (d?.stabilized && medicalBed(d.bed) && careRank(sim, id) !== 'never') beds.add(d.bed);
  }
  for (const id of sim.world.query(RecoveringC)) {
    const bed = sim.world.get(id, RecoveringC)?.bed ?? 0;
    if (medicalBed(bed) && careRank(sim, id) !== 'never') beds.add(bed);
  }
  return beds;
}

/**
 * Who is tending the medical bed `bed` and what that is worth: the crew member who holds its tend job and stands beside it working (not carried off, downed or
 * asleep), and their care multiplier, `1 + SKILL_STEP` per medicine level. Nobody tending (or any bed that is no medical bed): `{ medic: 0, mult: 1 }`. The one
 * answer for the downed heal in systems/vitals.ts and a walking patient's in crew/recovery.ts; the XP goes to `medic`.
 */
export function tendingOf(sim: Sim, bed: number): { medic: number; mult: number } {
  for (const id of sim.world.query(JobC)) {
    const job = sim.world.get(id, JobC);
    const medic = job?.kind === 'tend' && job.target === bed ? job.reservedBy : 0;
    if (!medic || isIncapacitated(sim, medic) || sim.world.get(medic, AssignmentC)?.jobId !== id) continue;
    if (sim.world.get(medic, CrewC)?.activity !== 'working' || !sim.world.has(medic, PositionC)) continue;
    return { medic, mult: 1 + SKILL_STEP * Math.max(0, skillOf(sim, medic, 'medicine')) };
  }
  return { medic: 0, mult: 1 };
}
