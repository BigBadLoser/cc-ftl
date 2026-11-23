import { CrewC, PositionC, type Sim } from '../sim';
import { skillOf } from '../sim/combat/operators';
import { canBeInjured } from '../sim/crew/body';
import { implantsOf, isNamedItem, partTakes } from '../sim/crew/implants';
import { DERMAL_PART, type Operation, type OperationKind } from '../sim/crew/implantTypes';
import {
  couldOperate, lyingIn, operationError, operationsOf, readyOperation, stockFor, surgeryChance, surgeryJobOf, theatreFits, theatreOf,
} from '../sim/crew/surgery';
import { shipStoreCount } from '../sim/items/stock';
import { ModuleC } from '../sim/modules/components';
import { shipIdOf } from '../sim/regions';
import { playerCrewPackedOk } from '../sim/story/world';
import type { UiOperationOption, UiOperations, UiPartIcon } from '../ui/crewDetailApi';
import { partIcon } from './healthDetail';

/**
 * The Health tab's surgery section (#311): the queue with each operation's status, and the picker's options per part (greyed with the sim's reason,
 * crew/surgery.ts `operationError`), the implants in stock, where it can be done and the best free surgeon's odds. Reads the sim only; the buttons send
 * `crew.queueOperation` / `crew.cancelOperation`.
 */

const SKIN = { id: DERMAL_PART, name: 'Skin', icon: 'part-skin' as UiPartIcon, mirror: false };

/** The sim's reasons in words (`what`: the part's name, lower case). */
function why(reason: string, what: string): string {
  const words: Record<string, string> = {
    wrongPart: 'no implant fits here', implantFitted: 'an implant is already fitted', amputateFirst: `amputate the lost ${what} first`,
    partLost: `a lost ${what} can only be replaced`, noImplant: 'no implant fitted', vital: 'they cannot live without it',
    notOrgan: 'a limb heals by treatment', nothingToRepair: 'nothing to repair', notLimb: 'not a limb', notLost: 'only a lost limb',
    queued: 'already queued', noStock: 'none in stock',
  };
  return words[reason] ?? reason;
}

/** The parts the picker lists: the body map, then the skin. */
function partsOf(sim: Sim): { id: string; name: string; icon: UiPartIcon; mirror: boolean }[] {
  const body = Object.entries(sim.content.injuries?.parts ?? {}).map(([id, def]) => ({ id, name: def.name, icon: partIcon(def), mirror: def.side === 'left' }));
  return [...body, SKIN];
}

/** The picker's mark of named cyberware (its colour) and its tooltip line. */
const namedOf = (sim: Sim, item: string): { named?: true; tip?: string } => (isNamedItem(sim, item) ? { named: true, tip: sim.content.items[item]?.description } : {});
const itemName = (sim: Sim, item?: string): string => (item ? (sim.content.items[item]?.name ?? item) : '');

function label(sim: Sim, op: Pick<Operation, 'kind' | 'part' | 'item' | 'urgent'>): string {
  const part = (op.part === DERMAL_PART ? SKIN.name : (sim.content.injuries?.parts[op.part]?.name ?? op.part)).toLowerCase();
  const by: Record<OperationKind, string> = { fit: `Fit ${itemName(sim, op.item)}`, remove: `Remove ${itemName(sim, op.item)}`, repair: `Repair ${part}`, amputate: `Amputate ${part}` };
  return `${op.urgent ? 'Urgent: ' : ''}${by[op.kind]}`;
}

/** The best surgeon who could operate now (crew/surgery.ts `couldOperate`) on the patient's ship, by Medicine. */
function bestSurgeon(sim: Sim, patient: number): number {
  const ship = shipIdOf(sim, sim.world.get(patient, PositionC));
  let best = 0, skill = -Infinity;
  for (const id of playerCrewPackedOk(sim)) {
    const s = skillOf(sim, id, 'medicine');
    if (couldOperate(sim, id, patient) && shipIdOf(sim, sim.world.get(id, PositionC)) === ship && s > skill) [best, skill] = [id, s];
  }
  return best;
}

/** "success 82% with a rig, 62% without" for the best surgeon (with a rig only, for brain and spine). */
function oddsOf(sim: Sim, patient: number, surgeon: number, op: Pick<Operation, 'kind' | 'part' | 'item'>): string {
  if (!surgeon) return '';
  const pct = (w: 'rig' | 'bed') => `${Math.round(surgeryChance(sim, surgeon, patient, op, w) * 100)}%`;
  const slot = sim.content.injuries?.parts[op.part]?.slot;
  return slot === 'brain' || slot === 'spine' ? `success ${pct('rig')} with a rig` : `success ${pct('rig')} with a rig, ${pct('bed')} without`;
}

function statusOf(sim: Sim, id: number, op: Operation, n: number): string {
  if (n > 0) return n === 1 ? '2nd in line' : n === 2 ? '3rd in line' : `${n + 1}th in line`;
  if (!stockFor(sim, id, op)) return 'waiting for stock';
  if (!readyOperation(sim, id)) return 'gave up waiting';
  const job = surgeryJobOf(sim, id)?.[1];
  if (job) return job.progress > 0 ? `in surgery, ${Math.round((job.progress / job.work) * 100)}%` : job.reservedBy ? 'surgeon on the way' : 'waiting for a surgeon';
  return theatreFits(sim, lyingIn(sim, id), op) ? 'waiting for a surgeon' : 'on the way to a bed';
}

/** The operations open on one part of this patient, in order: fit, repair, amputate, remove. */
function optionsFor(sim: Sim, id: number, part: { id: string; name: string }, surgeon: number): UiOperationOption[] {
  const what = part.name.toLowerCase();
  const queued = new Set(operationsOf(sim, id).map((o) => `${o.kind}|${o.part}`));
  const check = (op: Pick<Operation, 'kind' | 'part' | 'item'>): string | undefined => {
    const err = queued.has(`${op.kind}|${op.part}`) ? 'queued' : operationError(sim, id, op);
    return err ? why(err, what) : undefined;
  };
  const ship = shipIdOf(sim, sim.world.get(id, PositionC));
  const fits = Object.entries(sim.content.items).filter(([, d]) => d.implant && partTakes(sim, part.id, d.implant.slot));
  const open = fits.filter(([item]) => !check({ kind: 'fit', part: part.id, item }));
  const implants = open.map(([item, d]) => ({ id: item, name: d.name, ...namedOf(sim, item), stock: shipStoreCount(sim, ship, item), odds: oddsOf(sim, id, surgeon, { kind: 'fit', part: part.id, item }) }));
  const lost = sim.content.injuries?.parts[part.id] ? operationError(sim, id, { kind: 'repair', part: part.id }) === 'partLost' : false;
  const anyReplacement = open.some(([, d]) => d.implant?.kind === 'replacement');
  const fitDisabled = !fits.length ? 'no implant fits here' : !open.length ? check({ kind: 'fit', part: part.id, item: fits[0]![0] }) : !implants.some((i) => i.stock > 0) ? why('noStock', what) : undefined;
  const fitted = implantsOf(sim, id).filter((f) => f.part === part.id);
  const removes = fitted.map((f) => ({ id: f.item, name: itemName(sim, f.item), ...namedOf(sim, f.item), stock: 1, note: check({ kind: 'remove', part: part.id, item: f.item }) ?? 'fitted', odds: oddsOf(sim, id, surgeon, { kind: 'remove', part: part.id, item: f.item }) }));
  const out: UiOperationOption[] = [
    {
      kind: 'fit', label: 'Fit implant', note: anyReplacement ? (lost ? `replaces the lost ${what}` : `replaces the ${what}`) : 'an augment', implants,
      ...(fitDisabled ? { disabled: fitDisabled } : {}),
    },
  ];
  if (part.id !== DERMAL_PART) {
    const repair = check({ kind: 'repair', part: part.id });
    out.push({ kind: 'repair', label: 'Repair', note: `mends the ${what}`, odds: oddsOf(sim, id, surgeon, { kind: 'repair', part: part.id }), ...(repair ? { disabled: repair } : {}) });
    const amp = check({ kind: 'amputate', part: part.id });
    out.push({ kind: 'amputate', label: 'Amputate', note: 'takes off a ruined limb', odds: oddsOf(sim, id, surgeon, { kind: 'amputate', part: part.id }), ...(amp ? { disabled: amp } : {}) });
  }
  const removable = removes.filter((r) => r.note === 'fitted');
  out.push({ kind: 'remove', label: 'Remove implant', note: 'takes an implant out', implants: removable, ...(removable.length ? {} : { disabled: removes[0]?.note ?? why('noImplant', what) }) });
  return out;
}

/** Where operations can be done on the patient's ship, in words. */
function whereOf(sim: Sim, id: number): string[] {
  const ship = shipIdOf(sim, sim.world.get(id, PositionC));
  let rigs = 0, beds = 0;
  for (const m of sim.world.query(ModuleC)) {
    const mod = sim.world.get(m, ModuleC);
    if (!mod || shipIdOf(sim, mod) !== ship) continue;
    const t = theatreOf(sim, m);
    if (t === 'rig') rigs++;
    else if (t === 'bed') beds++;
  }
  return [
    rigs ? `Medical bed with a surgical rig: lower risk (${rigs} aboard)` : 'Medical bed with a surgical rig: none aboard (needed for brain and spine)',
    beds ? 'Medical bed: higher risk' : 'Medical bed: none aboard',
  ];
}

/** The surgery section of one crew member's Health tab, or null for a body that takes no injuries. */
export function buildOperations(sim: Sim, id: number): UiOperations | null {
  if (!sim.content.injuries || !sim.world.has(id, CrewC) || !canBeInjured(sim, id) || !sim.world.has(id, PositionC)) return null;
  const parts = partsOf(sim);
  const surgeon = bestSurgeon(sim, id);
  const ops: Record<string, UiOperationOption[]> = {};
  for (const p of parts) ops[p.id] = optionsFor(sim, id, p, surgeon);
  const icon = (part: string) => parts.find((p) => p.id === part) ?? SKIN;
  return {
    queue: operationsOf(sim, id).map((op, n) => ({ id: op.id, label: label(sim, op), icon: icon(op.part).icon, mirror: icon(op.part).mirror, status: statusOf(sim, id, op, n) })),
    picker: {
      parts,
      ops,
      where: whereOf(sim, id),
      surgeon: surgeon ? `Best free surgeon: ${sim.world.get(surgeon, CrewC)?.name ?? ''} (Medicine ${Math.round(skillOf(sim, surgeon, 'medicine'))})` : 'No surgeon free aboard.',
    },
    live: true,
  };
}
