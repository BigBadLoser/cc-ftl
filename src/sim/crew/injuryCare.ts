import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { healMult } from './body';
import { DownedC, RecoveringC } from './components';
import { damageCrew } from './injure';
import { InjuriesC, type Injury } from './injuryTypes';
import { careBed, podModule } from './recovery';
import { tendingOf, treatmentMult } from './treatment';
import { POD_INJURY_HEAL_MULT, SCAR_AFTER_SEC, SCAR_CHANCE, TREAT_SEC, TREAT_XP } from './tuningInjury';
import { grantXp } from './xp';

/**
 * Injuries over time (DESIGN.md "Injuries and cyberware", severity ladder and care tiers), one step of `dt` seconds for one crew member:
 *  - a fresh cut or puncture bleeds hp while they stand, until first aid, a bed or its `bleedSec`;
 *  - a minor injury heals on its own; a serious one only once treated, at its treatment quality (faster in a powered recovery pod), and untreated it
 *    may set as a scar every `SCAR_AFTER_SEC`; a scar and a lost part stay; all healing scales with blood pumping (`healMult`);
 *  - lying in a medical bed (downed and stabilised, or a walking patient) with a medic tending it (`tendingOf`), their serious injuries are
 *    treated one at a time: quality = the medic's care times the medicine of the stay (`treatmentMult`, the herbs of crew/treatment.ts).
 */
export function injuryStep(sim: Sim, id: number, dt: number): void {
  const comp = sim.world.get(id, InjuriesC);
  const kinds = sim.content.injuries?.kinds;
  if (!comp?.list.length || !kinds) return;
  const downed = sim.world.get(id, DownedC);
  const rec = sim.world.get(id, RecoveringC);
  const stay = downed?.stabilized ? downed : rec;
  const pod = stay ? podModule(sim, stay.bed) : undefined;
  if (stay && !pod && careBed(sim, stay.bed)) treat(sim, id, comp.list, stay, dt);
  const heal = healMult(sim, id) * dt;
  let bleed = 0;
  const keep: Injury[] = [];
  for (const inj of comp.list) {
    const k = kinds[inj.kind];
    const before = inj.age;
    inj.age += dt;
    if (inj.bleeding && (stay || inj.age >= (k?.bleedSec ?? 0))) delete inj.bleeding;
    if (inj.bleeding && !downed) bleed += (k?.bleed ?? 0) * dt;
    if (inj.sev === 'minor') inj.heal += heal;
    else if (inj.sev === 'serious' && inj.treated) inj.heal += heal * inj.treated * (pod?.powered ? POD_INJURY_HEAL_MULT : 1);
    else if (inj.sev === 'serious' && Math.floor(inj.age / SCAR_AFTER_SEC) > Math.floor(before / SCAR_AFTER_SEC) && sim.rng.chance(SCAR_CHANCE)) {
      inj.sev = 'scar';
      inj.heal = 0;
      sim.events.emit({ type: 'crew.scarred', crew: id, part: inj.part, kind: inj.kind });
    }
    if ((inj.sev === 'minor' || inj.sev === 'serious') && k && inj.heal >= k.healSec) continue; // healed
    keep.push(inj);
  }
  comp.list = keep;
  if (bleed > 0) damageCrew(sim, id, bleed, null);
}

/** One step of a tending medic's treatment: the first untreated serious injury progresses at their care; done, it is treated at care times the stay's medicine. */
function treat(sim: Sim, id: number, list: readonly Injury[], stay: { bed: number; treated?: number }, dt: number): void {
  const inj = list.find((i) => i.sev === 'serious' && !i.treated);
  if (!inj) return;
  const tend = tendingOf(sim, stay.bed);
  if (!tend.medic) return;
  inj.treat = (inj.treat ?? 0) + dt * tend.mult;
  if (inj.treat < TREAT_SEC) return;
  const bed = sim.world.get(stay.bed, ModuleC);
  inj.treated = tend.mult * (bed ? treatmentMult(sim, shipIdOf(sim, bed), stay) : 1);
  delete inj.treat;
  grantXp(sim, tend.medic, 'medicine', TREAT_XP);
  sim.events.emit({ type: 'crew.injuryTreated', crew: id, part: inj.part, kind: inj.kind, by: tend.medic });
}
