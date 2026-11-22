import { skillOf } from '../combat/operators';
import { shipStoreCount } from '../items/stock';
import { ModuleC } from '../modules/components';
import { rigFacing } from '../modules/rig';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { canBeInjured, injuriesOf, partDestroyed } from './body';
import { DownedC, JobC, PositionC, PrioritiesC, RecoveringC, type Job } from './components';
import { isIncapacitated, refusesWork } from './helpers';
import { implantDef, implantOn, partTakes } from './implants';
import { DERMAL_PART, OperationsC, type Operation, type OperationKind } from './implantTypes';
import { STRANDED_RETRY_SEC } from './tuningInjury';
import {
  SURGERY_AMPUTATE_SEC, SURGERY_BASE_CHANCE, SURGERY_BED_BOTCH_SHARE, SURGERY_BED_PENALTY, SURGERY_BOTCH_SHARE, SURGERY_CHANCE_MAX, SURGERY_CHANCE_MIN,
  SURGERY_CHANCE_PER_LEVEL, SURGERY_FIT_SEC, SURGERY_FIT_TIER_SEC, SURGERY_REMOVE_SEC, SURGERY_REPAIR_DIFFICULTY, SURGERY_REPAIR_SEC, SURGERY_TIER_DIFFICULTY,
  SURGERY_URGENT_DIFFICULTY, SURGERY_URGENT_SEC,
} from './tuningSurgery';
import { workBlocked } from './workBlock';

/**
 * Surgery (DESIGN.md "Injuries and cyberware", #311): the one answer to "may this operation be done on this patient" (`operationError`), "where"
 * (`theatreOf`, `theatreFits`), "how likely is it to go well" (`surgeryChance`) and "is the patient waiting to be operated on" (`seeksSurgery`). The patient
 * walks to a medical bed (one with a surgical rig first) through the recover drive (crew/beds.ts `bedUseOf`), or a downed one is carried there; the surgery jobs
 * are posted by systems/surgery.ts and finished in crew/surgeryOutcome.ts. Pure reads.
 */

/** What a part is for surgery: in the body map (or the skin, for implants only). */
const partDef = (sim: Sim, part: string) => sim.content.injuries?.parts[part];

/** Brain and spine work needs a surgery-grade bed (a surgical rig beside it). */
export function needsRig(sim: Sim, part: string): boolean {
  const slot = partDef(sim, part)?.slot;
  return slot === 'brain' || slot === 'spine';
}

/** Is a lost limb still there to take off (destroyed, not yet amputated)? */
const unamputated = (sim: Sim, id: number, part: string): boolean => injuriesOf(sim, id).some((i) => i.part === part && i.sev === 'destroyed' && i.kind !== 'injury.amputated');

/**
 * Why the operation cannot be done on this patient now, or null. One answer for the queue command, the planner and the Health tab's greyed reasons
 * (app/surgeryDetail.ts turns the reason into words). Stock is not part of it: an operation waits for its implant (`stockFor`).
 */
export function operationError(sim: Sim, id: number, op: Pick<Operation, 'kind' | 'part' | 'item'>): string | null {
  if (!canBeInjured(sim, id)) return 'noBody';
  const def = partDef(sim, op.part);
  if (!def && !(op.part === DERMAL_PART && (op.kind === 'fit' || op.kind === 'remove'))) return 'noPart';
  const limb = def?.group === 'limb';
  switch (op.kind) {
    case 'fit': {
      const imp = op.item ? implantDef(sim, op.item) : undefined;
      if (!imp) return 'notImplant';
      if (!partTakes(sim, op.part, imp.slot)) return 'wrongPart';
      if (implantOn(sim, id, op.part, imp.kind)) return 'implantFitted';
      if (imp.kind === 'augment') return partDestroyed(sim, id, op.part) ? 'partLost' : null;
      return limb && unamputated(sim, id, op.part) ? 'amputateFirst' : null;
    }
    case 'remove': {
      const fitted = op.item ? implantDef(sim, op.item) : undefined;
      if (!fitted || implantOn(sim, id, op.part, fitted.kind)?.item !== op.item) return 'noImplant';
      return fitted.kind === 'replacement' && def?.vital ? 'vital' : null; // taking out a cyber heart would kill them
    }
    case 'repair':
      if (limb) return 'notOrgan';
      if (partDestroyed(sim, id, op.part)) return 'partLost';
      return injuriesOf(sim, id).some((i) => i.part === op.part && (i.sev === 'serious' || i.sev === 'scar')) ? null : 'nothingToRepair';
    case 'amputate':
      if (!limb) return 'notLimb';
      return unamputated(sim, id, op.part) ? null : 'notLost';
  }
}

/** A fit operation that saves a life: a replacement for a lost vital organ (heart, lungs). */
export function isUrgent(sim: Sim, id: number, op: Pick<Operation, 'kind' | 'part' | 'item'>): boolean {
  return op.kind === 'fit' && !!partDef(sim, op.part)?.vital && partDestroyed(sim, id, op.part) && implantDef(sim, op.item ?? '')?.kind === 'replacement';
}

/** The patient's ship has the operation's implant in stock (true when it needs none). */
export function stockFor(sim: Sim, id: number, op: Pick<Operation, 'kind' | 'item'>): boolean {
  if (op.kind !== 'fit') return true;
  const pos = sim.world.get(id, PositionC);
  return !!pos && !!op.item && shipStoreCount(sim, shipIdOf(sim, pos), op.item) > 0;
}

/** The patient's queue (empty for none). */
export const operationsOf = (sim: Sim, id: number): readonly Operation[] => sim.world.get(id, OperationsC)?.list ?? [];

/** The operation the patient is to have next: the head of the queue, while it can be done, its implant is in stock and they have not given up on it lately. */
export function readyOperation(sim: Sim, id: number): Operation | undefined {
  const op = operationsOf(sim, id)[0];
  if (!op || operationError(sim, id, op) || !stockFor(sim, id, op)) return undefined;
  if (op.untended !== undefined && sim.tick - op.untended < STRANDED_RETRY_SEC * TICK_HZ) return undefined;
  return op;
}

/** Does the patient go and lie down for surgery (a walking one), or need carrying to it (a downed one)? */
export const seeksSurgery = (sim: Sim, id: number): boolean => !!readyOperation(sim, id);

/** Must their next operation be at a surgery-grade bed (brain or spine)? */
export const surgeryNeedsRig = (sim: Sim, id: number): boolean => {
  const op = readyOperation(sim, id);
  return !!op && needsRig(sim, op.part);
};

/**
 * Is the bed surgery-grade: a powered, intact surgical rig faces its foot (modules/rig.ts `rigFacing`). The one answer for the operation's place, the odds,
 * the planner, the bed choice and the Health tab.
 */
export function surgeryGrade(sim: Sim, bed: number): boolean {
  const rig = sim.world.get(rigFacing(sim.world, sim.content.modules, bed), ModuleC);
  return !!rig && rig.hp > 0 && rig.powered && rig.enabled;
}

/** Where a module operates: a surgery-grade medical bed (`rig`), a plain one (`bed`; intact, not a recovery pod), or neither. */
export function theatreOf(sim: Sim, bed: number): 'rig' | 'bed' | undefined {
  const m = sim.world.get(bed, ModuleC);
  const def = m && sim.content.modules[m.def];
  if (!m || !def || m.hp <= 0 || !def.medical || def.recovery) return undefined;
  return surgeryGrade(sim, bed) ? 'rig' : 'bed';
}

/** May the operation be done in `bed`: a surgery-grade bed, or a plain medical bed when it is not brain or spine work. */
export function theatreFits(sim: Sim, bed: number, op: Pick<Operation, 'part'>): boolean {
  const t = theatreOf(sim, bed);
  return t === 'rig' || (t === 'bed' && !needsRig(sim, op.part));
}

/** The bed the crew member lies in (walking patient, or stabilised downed one), or 0. */
export function lyingIn(sim: Sim, id: number): number {
  const rec = sim.world.get(id, RecoveringC);
  if (rec) return rec.bed;
  const d = sim.world.get(id, DownedC);
  return d?.stabilized ? d.bed : 0;
}

/** Is the patient lying where their next operation can be done (they stay in the bed for it)? */
export function awaitsSurgeryAt(sim: Sim, id: number, bed: number): boolean {
  const op = readyOperation(sim, id);
  return !!op && theatreFits(sim, bed, op);
}

/** The surgery job on a patient, if one is posted: [job id, job]. */
export function surgeryJobOf(sim: Sim, patient: number): [number, Job] | undefined {
  for (const id of sim.world.query(JobC)) {
    const j = sim.world.get(id, JobC);
    if (j?.kind === 'surgery' && j.target === patient) return [id, j];
  }
  return undefined;
}

/** Is a surgeon at work on the patient right now? */
export const surgeryUnderway = (sim: Sim, patient: number): boolean => (surgeryJobOf(sim, patient)?.[1].progress ?? 0) > 0;

/** Give up waiting in the bed: the next operation is marked `untended` now. */
export function giveUpSurgery(sim: Sim, id: number): void {
  const op = sim.world.get(id, OperationsC)?.list[0];
  if (op) op.untended = sim.tick;
}

/** How hard the operation is (taken off the chance): by implant tier for fitting and removing, plus a dying patient's urgency. */
function difficulty(sim: Sim, id: number, op: Pick<Operation, 'kind' | 'part' | 'item'>): number {
  const tier = implantDef(sim, op.item ?? '')?.tier ?? 1;
  const base = op.kind === 'fit' || op.kind === 'remove' ? (tier - 1) * SURGERY_TIER_DIFFICULTY : op.kind === 'repair' ? SURGERY_REPAIR_DIFFICULTY : 0;
  return base + (isUrgent(sim, id, op) ? SURGERY_URGENT_DIFFICULTY : 0);
}

/** The chance the operation goes well with this surgeon at a surgery-grade bed or a plain one: their Medicine, the place and the difficulty. */
export function surgeryChance(sim: Sim, surgeon: number, patient: number, op: Pick<Operation, 'kind' | 'part' | 'item'>, where: 'rig' | 'bed'): number {
  const p = SURGERY_BASE_CHANCE + SURGERY_CHANCE_PER_LEVEL * Math.max(0, skillOf(sim, surgeon, 'medicine')) - difficulty(sim, patient, op) - (where === 'bed' ? SURGERY_BED_PENALTY : 0);
  return Math.min(SURGERY_CHANCE_MAX, Math.max(SURGERY_CHANCE_MIN, p));
}

/** The share of failures that are botched at a surgery-grade bed or a plain one. */
export const botchShare = (where: 'rig' | 'bed'): number => (where === 'bed' ? SURGERY_BED_BOTCH_SHARE : SURGERY_BOTCH_SHARE);

/** Seconds of a surgeon's work the operation takes at work speed 1. */
export function operationSec(sim: Sim, id: number, op: Pick<Operation, 'kind' | 'part' | 'item'>): number {
  if (isUrgent(sim, id, op)) return SURGERY_URGENT_SEC;
  const tier = implantDef(sim, op.item ?? '')?.tier ?? 1;
  const by: Record<OperationKind, number> = { fit: SURGERY_FIT_SEC + (tier - 1) * SURGERY_FIT_TIER_SEC, remove: SURGERY_REMOVE_SEC, repair: SURGERY_REPAIR_SEC, amputate: SURGERY_AMPUTATE_SEC };
  return by[op.kind];
}

/** Could this crew member operate on `patient` now: not the patient, on their feet, medical work on and not blocked, willing to work (the Health tab's best surgeon). */
export function couldOperate(sim: Sim, crew: number, patient: number): boolean {
  if (crew === patient || isIncapacitated(sim, crew) || refusesWork(sim, crew) || workBlocked(sim, crew, 'medical')) return false;
  return (sim.world.get(crew, PrioritiesC)?.medical ?? 0) > 0;
}
