import { drawFromStores } from '../items/stock';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { returnToCargo } from '../upgrades/fit';
import { PositionC, type Job } from './components';
import { addInjury } from './injure';
import { InjuriesC } from './injuryTypes';
import { implantDef } from './implants';
import { ImplantsC, OperationsC, type Operation, type SurgeryOutcome } from './implantTypes';
import { botchShare, lyingIn, operationError, stockFor, surgeryChance, theatreFits, theatreOf } from './surgery';

/**
 * The end of an operation (#311): one roll of the seeded sim rng against the surgeon's chance (crew/surgery.ts `surgeryChance`). Done, it does what the
 * operation says; failed, the part takes a surgical wound; botched, the part is destroyed (the brain only badly hurt: there is no cyber brain). Surgery
 * never kills outright, but a lost heart or lungs downs the patient and bleeding afterwards can. The operation leaves the queue either way.
 */

/** Fit an implant now (an operation's success, and `debug.setCrew.implants`): a replacement takes the place of the flesh part and its injuries. */
export function fitImplant(sim: Sim, id: number, part: string, item: string): void {
  const def = implantDef(sim, item);
  if (!def) return;
  let imps = sim.world.get(id, ImplantsC);
  if (!imps) {
    imps = { list: [] };
    sim.world.add(id, ImplantsC, imps);
  }
  imps.list.push({ part, item });
  const inj = sim.world.get(id, InjuriesC);
  if (def.kind === 'replacement' && inj) inj.list = inj.list.filter((i) => i.part !== part);
}

/** Take an implant out: an augment leaves the part as it was; a replacement leaves it lost (a limb as amputated). */
function removeImplant(sim: Sim, id: number, part: string, item: string): void {
  const imps = sim.world.get(id, ImplantsC);
  if (!imps) return;
  const at = imps.list.findIndex((f) => f.part === part && f.item === item);
  if (at < 0) return;
  imps.list.splice(at, 1);
  if (!imps.list.length) sim.world.remove(id, ImplantsC);
  if (implantDef(sim, item)?.kind !== 'replacement') return;
  if (sim.content.injuries?.parts[part]?.group === 'limb') setLost(sim, id, part, 'injury.amputated');
  else addInjury(sim, id, part, 'injury.surgical', 'destroyed');
}

/** The part is lost as `kind` (amputated): its injuries go and one destroyed entry stays. */
function setLost(sim: Sim, id: number, part: string, kind: string): void {
  let inj = sim.world.get(id, InjuriesC);
  if (!inj) {
    inj = { list: [] };
    sim.world.add(id, InjuriesC, inj);
  }
  inj.list = inj.list.filter((i) => i.part !== part);
  inj.list.push({ part, kind, sev: 'destroyed', age: 0, heal: 0 });
}

function succeed(sim: Sim, id: number, op: Operation, ship: number): boolean {
  switch (op.kind) {
    case 'fit':
      if (!op.item || drawFromStores(sim, ship, op.item, 1) < 1) return false; // the implant went meanwhile: the operation waits for stock
      fitImplant(sim, id, op.part, op.item);
      return true;
    case 'remove': {
      const pos = sim.world.get(id, PositionC);
      removeImplant(sim, id, op.part, op.item ?? '');
      if (pos && op.item) returnToCargo(sim, ship, op.item, pos);
      return true;
    }
    case 'repair': {
      const inj = sim.world.get(id, InjuriesC);
      if (inj) inj.list = inj.list.filter((i) => i.part !== op.part || (i.sev !== 'serious' && i.sev !== 'scar'));
      return true;
    }
    case 'amputate':
      setLost(sim, id, op.part, 'injury.amputated');
      return true;
  }
}

/** A failed operation: a surgical wound on the part, or (botched) the part destroyed and a fitted implant's item ruined. */
function fail(sim: Sim, id: number, op: Operation, ship: number, botched: boolean): void {
  if (botched && op.kind === 'fit' && op.item) drawFromStores(sim, ship, op.item, 1);
  const brain = sim.content.injuries?.parts[op.part]?.slot === 'brain';
  addInjury(sim, id, op.part, 'injury.surgical', brain ? 'spare' : botched ? 'destroyed' : undefined);
}

/** The surgery job's work is done: roll, then do it (or not), and take the operation off the queue. */
export function finishSurgery(sim: Sim, surgeon: number, job: Job): void {
  const patient = job.target ?? 0;
  const ops = sim.world.get(patient, OperationsC);
  const op = ops?.list[0];
  const bed = job.bed ?? 0;
  const where = theatreOf(sim, bed);
  const pos = sim.world.get(patient, PositionC);
  // The planner rechecks the job only every SURGERY_STEP_TICKS: the patient may have left the bed, the rig or the implant gone, since. Every outcome waits for stock.
  if (!ops || !op || op.id !== job.surgery?.op || !where || !pos || lyingIn(sim, patient) !== bed || !theatreFits(sim, bed, op) || !stockFor(sim, patient, op) || operationError(sim, patient, op)) return;
  const ship = shipIdOf(sim, pos);
  const chance = surgeryChance(sim, surgeon, patient, op, where);
  const r = sim.rng.next();
  const outcome: SurgeryOutcome = r < chance ? 'success' : r >= 1 - (1 - chance) * botchShare(where) ? 'botched' : 'failure';
  if (outcome === 'success') {
    if (!succeed(sim, patient, op, ship)) return;
  } else fail(sim, patient, op, ship, outcome === 'botched');
  ops.list.shift();
  if (!ops.list.length) sim.world.remove(patient, OperationsC);
  sim.events.emit({ type: 'crew.surgery', crew: patient, by: surgeon, kind: op.kind, part: op.part, ...(op.item ? { item: op.item } : {}), outcome });
}
