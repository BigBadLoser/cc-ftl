import type { Modifier, ModifierSource } from '../stats';
import type { Sim } from '../sim';
import { CrewC } from './components';
import { InjuriesC, type Capacity, type Injury, type InjuryContent } from './injuryTypes';
import { BLEED_OUT_MIN_MULT, HEAL_MIN_MULT, KNOCKOUT_BELOW, STRANDED_RETRY_SEC, SUIT_AIR_MIN_MULT } from './tuningInjury';
import { TICK_HZ } from '../time';
import { implantModifiers, implantMul, implantsOf, replacementOn } from './implants';

/**
 * The body map (DESIGN.md "Injuries and cyberware"): the one answer to "how well does this part work" (`partCondition`), "how well does this
 * crew member see, move, think..." (`capacitiesOf`) and the questions built on them. The stat resolver reads `injuryModifiers` (origin
 * `injury`); vitals, suits and the bleed-out timer read the capacity owners below. Pure reads.
 */

const NONE: readonly Modifier[] = [];

/** The injury content, or undefined when the game has none. */
export const injuryContent = (sim: Sim): InjuryContent | undefined => sim.content.injuries;

/** May this body take injuries at all? Not robots (`mechanical`, `wreck`) nor wild creatures, and only when the content has injuries. Flags, never species ids. */
export function canBeInjured(sim: Sim, id: number): boolean {
  const c = sim.world.get(id, CrewC);
  const s = c && sim.content.species[c.species];
  return !!s && !!sim.content.injuries && !s.mechanical && !s.wreck && !s.creature;
}

/** The crew member's injuries (empty for none). */
export const injuriesOf = (sim: Sim, id: number): readonly Injury[] => sim.world.get(id, InjuriesC)?.list ?? [];

/** How much of its part's condition one injury takes now: a fresh one its kind's damage, less what has healed; a scar its lasting loss; a destroyed part all. */
export function injuryLoss(sim: Sim, inj: Injury): number {
  const kind = sim.content.injuries?.kinds[inj.kind];
  if (inj.sev === 'destroyed') return 1;
  if (!kind) return 0;
  if (inj.sev === 'scar') return kind.scarLoss ?? 0;
  return kind.damage * Math.max(0, 1 - inj.heal / kind.healSec);
}

/** A part's condition: 1 unhurt, 0 destroyed; a replacement implant's own value instead (crew/implants.ts `replacementOn`: Mk I 0.8, Mk III above 1). */
export function partCondition(sim: Sim, id: number, part: string, list = injuriesOf(sim, id)): number {
  const cyber = replacementOn(sim, id, part);
  if (cyber !== undefined) return cyber;
  let loss = 0;
  for (const inj of list) if (inj.part === part) loss += injuryLoss(sim, inj);
  return Math.max(0, 1 - loss);
}

/** Is the part lost for good? */
export const partDestroyed = (sim: Sim, id: number, part: string): boolean => injuriesOf(sim, id).some((i) => i.part === part && i.sev === 'destroyed');

/** Can the part take a new injury: flesh and not lost (a replacement implant takes none: cyber damage comes in slice 2b). */
export const partInjurable = (sim: Sim, id: number, part: string): boolean => !partDestroyed(sim, id, part) && replacementOn(sim, id, part) === undefined;

const FULL: Readonly<Record<Capacity, number>> = { manipulation: 1, moving: 1, sight: 1, consciousness: 1, breathing: 1, bloodPumping: 1 };

/**
 * Every capacity (1 = healthy; above 1 with a replacement implant better than flesh): the shares of its parts' conditions summed, times its gate parts'
 * conditions, lifted to the capacity's floor. All 1 for a body that takes no injuries or has none and no implant.
 */
export function capacitiesOf(sim: Sim, id: number): Readonly<Record<Capacity, number>> {
  const list = injuriesOf(sim, id);
  const c = sim.content.injuries;
  if ((!list.length && !implantsOf(sim, id).length) || !c) return FULL;
  const share: Record<Capacity, number> = { manipulation: 0, moving: 0, sight: 0, consciousness: 0, breathing: 0, bloodPumping: 0 };
  const gate: Record<Capacity, number> = { ...FULL };
  for (const [part, def] of Object.entries(c.parts)) {
    const cond = partCondition(sim, id, part, list);
    if (def.gate) gate[def.capacity] *= cond;
    else share[def.capacity] += (def.share ?? 0) * cond;
  }
  const out = { ...FULL };
  for (const cap of Object.keys(out) as Capacity[]) {
    const floor = c.capacities[cap]?.floor ?? 0;
    out[cap] = floor + (1 - floor) * share[cap] * gate[cap];
  }
  return out;
}

/** Each capacity on one side of 1 scales its stats by `1 + weight * (capacity - 1)`: `below` the losses (origin `injury`), else the gains (origin `implant`). */
function capacityModifiers(sim: Sim, entity: number, below: boolean): Modifier[] {
  const caps = capacitiesOf(sim, entity);
  const out: Modifier[] = [];
  for (const [cap, def] of Object.entries(sim.content.injuries?.capacities ?? {})) {
    const v = caps[cap as Capacity];
    if (below ? v >= 1 : v <= 1) continue;
    for (const [stat, w] of Object.entries(def.stats)) out.push({ stat: stat as Modifier['stat'], op: 'mul', value: 1 + (w ?? 0) * (v - 1) });
  }
  return out;
}

/** Stat modifiers from the capacities under 1 (injuries, and a crude Mk I prosthetic). */
export const injuryModifiers: ModifierSource = (sim, entity) =>
  injuriesOf(sim, entity).length || implantsOf(sim, entity).length ? capacityModifiers(sim, entity, true) : NONE;

/** Stat modifiers from implants (origin `implant`): their own (`ImplantDef.mods`), and the capacities a replacement lifts above 1. */
export const implantStatModifiers: ModifierSource = (sim, entity) => {
  if (!implantsOf(sim, entity).length) return NONE;
  return [...implantModifiers(sim, entity), ...capacityModifiers(sim, entity, false)];
};

/** Is a vital organ (brain, heart, lungs) destroyed? The crew member is downed and dies without surgery (no getting up, no stabilising). */
export function vitalLost(sim: Sim, id: number): boolean {
  const parts = sim.content.injuries?.parts;
  return injuriesOf(sim, id).some((i) => i.sev === 'destroyed' && !!parts?.[i.part]?.vital);
}

/** Must the crew member be down whatever their hp: knocked out (consciousness under `KNOCKOUT_BELOW`) or a vital organ lost. */
export function mustBeDown(sim: Sim, id: number): boolean {
  return injuriesOf(sim, id).length > 0 && (vitalLost(sim, id) || capacitiesOf(sim, id).consciousness < KNOCKOUT_BELOW);
}

/** Is any injury bleeding? The first-aid job and the medic drone ask it. */
export const isBleeding = (sim: Sim, id: number): boolean => injuriesOf(sim, id).some((i) => i.bleeding);

/** Does a serious injury wait for a medic's treatment? */
export const needsTreatment = (sim: Sim, id: number): boolean => injuriesOf(sim, id).some((i) => i.sev === 'serious' && !i.treated);

/** Has a medic started (or finished) treating any of their serious injuries? */
export const treatmentStarted = (sim: Sim, id: number): boolean => injuriesOf(sim, id).some((i) => i.sev === 'serious' && (!!i.treated || (i.treat ?? 0) > 0));

/**
 * Do they go and get treated: a serious injury waits for a medic and they have not given up on it lately (`untended`, a stay in a medical bed that timed out,
 * crew/recovery.ts). The recover drive's health input, the bed choice and the medical bed stay ask it.
 */
export const seeksTreatment = (sim: Sim, id: number): boolean =>
  injuriesOf(sim, id).some((i) => i.sev === 'serious' && !i.treated && (i.untended === undefined || sim.tick - i.untended >= STRANDED_RETRY_SEC * TICK_HZ));

/** Give up waiting for treatment: their untreated serious injuries are marked `untended` now. */
export function giveUpTreatment(sim: Sim, id: number): void {
  for (const i of sim.world.get(id, InjuriesC)?.list ?? []) if (i.sev === 'serious' && !i.treated) i.untended = sim.tick;
}

/** Hp a second their bleeding wounds take while they stand (0 when none bleeds). */
export function bleedRate(sim: Sim, id: number): number {
  let r = 0;
  for (const i of injuriesOf(sim, id)) if (i.bleeding) r += sim.content.injuries?.kinds[i.kind]?.bleed ?? 0;
  return r;
}

const lerp = (min: number, v: number): number => min + (1 - min) * Math.min(1, v);

/** Healing speed from blood pumping, times implants' (`ImplantDef.healMul`): hp regeneration, bed healing and injuries heal at this multiple. */
export const healMult = (sim: Sim, id: number): number => lerp(HEAL_MIN_MULT, capacitiesOf(sim, id).bloodPumping) * implantMul(sim, id, 'healMul');

/** Bleed-out time from blood pumping, times implants' (a cyber heart), as a multiple of the normal. */
export const bleedOutMult = (sim: Sim, id: number): number => lerp(BLEED_OUT_MIN_MULT, capacitiesOf(sim, id).bloodPumping) * implantMul(sim, id, 'bleedOutMul');

/** Suit air from breathing, times implants' (cyber lungs): one second of the tank lasts this long. */
export const breathMult = (sim: Sim, id: number): number => lerp(SUIT_AIR_MIN_MULT, capacitiesOf(sim, id).breathing) * implantMul(sim, id, 'suitAirMul');
