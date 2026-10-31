import { defineComponent } from '../ecs';
import type { SkillName } from '../registry';
import type { Sim } from '../sim';
import type { Modifier, ModifierSource } from '../stats';
import { BLEED_OUT_SECONDS } from '../tuning';
import type { TraitDef, TraitEffects } from './traitDef';

/** A crew member's traits (content ids, `trait.<name>`), rolled at creation (crew/roll.ts). docs/TRAITS.md section 4. */
export interface Traits {
  ids: string[];
}
export const TraitsC = defineComponent<Traits>('traits');

/**
 * The crew member's starting skills, rolled at creation (crew/roll.ts): a complete snapshot that replaces the role's skills
 * in the stat resolver (a missing skill is 0). Crew without it (robots, aliens, NPC crew, old saves) use the role's.
 */
export interface RolledSkills {
  skills: Partial<Record<SkillName, number>>;
}
export const RolledSkillsC = defineComponent<RolledSkills>('rolledSkills');

const NONE: readonly TraitDef[] = [];
const NO_MODS: readonly Modifier[] = [];

/** The defs of a crew member's traits (unknown ids skipped). */
export function traitDefs(sim: Sim, id: number): readonly TraitDef[] {
  const t = sim.world.get(id, TraitsC);
  if (!t || t.ids.length === 0) return NONE;
  const out: TraitDef[] = [];
  for (const tid of t.ids) {
    const def = sim.content.traits?.[tid];
    if (def) out.push(def);
  }
  return out;
}

/** True if the crew member has the trait id. */
export function hasTrait(sim: Sim, id: number, traitId: string): boolean {
  return !!sim.world.get(id, TraitsC)?.ids.includes(traitId);
}

type MultKey = { [K in keyof TraitEffects]-?: TraitEffects[K] extends number | undefined ? K : never }[keyof TraitEffects];
type FlagKey = { [K in keyof TraitEffects]-?: TraitEffects[K] extends true | undefined ? K : never }[keyof TraitEffects];

/** Product of one multiplier effect over the crew member's traits (1 with none). */
export function traitMult(sim: Sim, id: number, key: MultKey): number {
  let m = 1;
  for (const d of traitDefs(sim, id)) {
    const v = d.effects?.[key];
    if (typeof v === 'number') m *= v;
  }
  return m;
}

/** True if any of the crew member's traits sets the flag. */
export function traitFlag(sim: Sim, id: number, key: FlagKey): boolean {
  return traitDefs(sim, id).some((d) => d.effects?.[key] === true);
}

/** The first trait value of an effect (for the non-numeric, non-flag effects), or undefined. */
export function traitEffect<K extends keyof TraitEffects>(sim: Sim, id: number, key: K): TraitEffects[K] | undefined {
  for (const d of traitDefs(sim, id)) if (d.effects?.[key] !== undefined) return d.effects[key];
  return undefined;
}

/** Seconds a newly downed crew member lasts before bleeding out (Tough lasts longer). */
export function bleedOutSec(sim: Sim, id: number): number {
  return BLEED_OUT_SECONDS * traitMult(sim, id, 'bleedMult');
}

/** The XP multiplier for a gain in `skill` (Gifted, Bookish). */
export function xpGainMult(sim: Sim, id: number, skill: string): number {
  let m = 1;
  for (const d of traitDefs(sim, id)) {
    const e = d.effects;
    if (e?.xpMult && (!e.xpSkills || e.xpSkills.includes(skill as SkillName))) m *= e.xpMult;
  }
  return m;
}

/** Stat modifiers from traits (docs/TRAITS.md section 4). */
export const traitModifiers: ModifierSource = (sim, entity) => {
  const defs = traitDefs(sim, entity);
  if (defs.length === 0) return NO_MODS;
  if (defs.length === 1) return defs[0]!.modifiers ?? NO_MODS;
  return defs.flatMap((d) => d.modifiers ?? NO_MODS);
};
