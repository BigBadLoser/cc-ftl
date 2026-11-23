import type { Modifier, ModifierSource } from '../stats';
import type { Sim } from '../sim';
import { DERMAL_PART, ImplantsC, type FittedImplant, type ImplantDef } from './implantTypes';

/**
 * What fitted implants give (DESIGN.md "Injuries and cyberware", #311): the one answer to "which implant is on this part" (`implantOn`), "what does a
 * replacement make of its part" (`replacementOn`, read by the capacity owner in crew/body.ts), the stat modifiers under origin `implant`, the body
 * multipliers and the implant load. Pure reads.
 */

const NONE: readonly Modifier[] = [];

/** The crew member's fitted implants (empty for none). */
export const implantsOf = (sim: Sim, id: number): readonly FittedImplant[] => sim.world.get(id, ImplantsC)?.list ?? [];

/** An item's implant def, if it is one. */
export const implantDef = (sim: Sim, item: string): ImplantDef | undefined => sim.content.items[item]?.implant;

/** Named cyberware: found only, no Mk tier. The one answer to "is this named cyberware". */
export const isNamedImplant = (def: ImplantDef | undefined): boolean => !!def?.named;

/** The Mk tier the surgery rules use: a named piece operates like Mk III (rare, powerful hardware), a missing item like Mk I. */
export const implantTier = (def: ImplantDef | undefined): 1 | 2 | 3 => (def ? (def.tier ?? 3) : 1);

/** The line an implant item belongs to: its id without the Mk digit (`item.cyber_heart`); a named piece is a line of its own. The one owner of "which line". */
export const implantLine = (item: string, def: ImplantDef | undefined): string => (isNamedImplant(def) ? item : item.replace(/_\d$/, ''));

/** A line's name from any item's name: no Mk tier, a skill in brackets capitalised ("Neural chip Mk II (gunnery)" is "Neural chip (Gunnery)"). */
export const implantLineName = (name: string): string => name.replace(/ Mk I{1,3}\b/, '').replace(/\((\w)/, (_, c: string) => `(${c.toUpperCase()}`);

/** Is this item named cyberware (an item id)? */
export const isNamedItem = (sim: Sim, item: string): boolean => isNamedImplant(implantDef(sim, item));

/** The implant of `kind` fitted on a part, if any: its item id and def. */
export function implantOn(sim: Sim, id: number, part: string, kind: ImplantDef['kind']): { item: string; def: ImplantDef } | undefined {
  for (const f of implantsOf(sim, id)) {
    const def = implantDef(sim, f.item);
    if (f.part === part && def?.kind === kind) return { item: f.item, def };
  }
  return undefined;
}

/** The replacement on a part: its condition (the def's `capacity`), or undefined while the flesh part is there. */
export function replacementOn(sim: Sim, id: number, part: string): number | undefined {
  const r = implantOn(sim, id, part, 'replacement');
  return r ? (r.def.capacity ?? 1) : undefined;
}

/** Does `part` (a body-map part, or the skin) take implants of `slot`? */
export function partTakes(sim: Sim, part: string, slot: ImplantDef['slot']): boolean {
  if (part === DERMAL_PART) return slot === 'dermal';
  return sim.content.injuries?.parts[part]?.slot === slot;
}

/** Summed cyber points of the fitted implants: `HEAVY_LOAD` or more is heavily augmented (trade/augmentation.ts). */
export function implantLoad(sim: Sim, id: number): number {
  let n = 0;
  for (const f of implantsOf(sim, id)) n += implantDef(sim, f.item)?.load ?? 0;
  return n;
}

/** The fitted implants' own stat modifiers (origin `implant`); a replacement above flesh adds its excess through the capacity (crew/body.ts `implantCapacityModifiers`). */
export const implantModifiers: ModifierSource = (sim, entity) => {
  const list = implantsOf(sim, entity);
  if (!list.length) return NONE;
  const out: Modifier[] = [];
  for (const f of list) for (const m of implantDef(sim, f.item)?.mods ?? []) out.push(m);
  return out;
};

/** The product of a body multiplier over the fitted implants (1 with none). */
export function implantMul(sim: Sim, id: number, key: 'bleedOutMul' | 'healMul' | 'suitAirMul'): number {
  let m = 1;
  for (const f of implantsOf(sim, id)) m *= implantDef(sim, f.item)?.[key] ?? 1;
  return m;
}

/** Armour from implants (dermal armour), added to the species'. */
export function implantArmor(sim: Sim, id: number): number {
  let a = 0;
  for (const f of implantsOf(sim, id)) a += implantDef(sim, f.item)?.armor ?? 0;
  return a;
}
