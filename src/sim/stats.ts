import { CrewC } from './crew/components';
import { environmentModifiers } from './crew/conditions';
import { suitModifiers } from './eva/conditions';
import { moodModifiers } from './crew/mood';
import { xpSkillModifiers } from './story/components';
import { roleSkillModifiers } from './crew/skills';
import { traitModifiers } from './crew/traits';
import { chargeModifiers } from './robots/conditions';
import type { Sim } from './sim';
import { DEFAULT_CARRY_CAPACITY } from './tuning';

export type StatName = 'moveSpeed' | 'workSpeed' | 'restDecay' | 'carryCapacity' | 'gunnery' | 'piloting' | 'shielding' | 'melee' | 'repair' | 'hacking' | 'medicine' | 'science';

const SKILL_STATS: readonly StatName[] = ['gunnery', 'piloting', 'shielding', 'melee', 'repair', 'hacking', 'medicine', 'science'];

/** A tagged change to a stat. Applied as: (base + sum of adds) * product of muls. */
export interface Modifier {
  stat: StatName;
  op: 'add' | 'mul';
  value: number;
}

/** Returns the modifiers an entity currently has from one origin (traits, implants, items...). */
export type ModifierSource = (sim: Sim, entity: number) => readonly Modifier[];

/** Where a modifier comes from, for the crew inspector's breakdown. */
export type ModifierOrigin = 'environment' | 'skills' | 'charge' | 'suit' | 'xp' | 'traits' | 'mood';

/** Register sources here, each under its origin. Implants plug in later. */
export const modifierSources: readonly { origin: ModifierOrigin; get: ModifierSource }[] = [
  { origin: 'environment', get: environmentModifiers }, { origin: 'skills', get: roleSkillModifiers }, { origin: 'charge', get: chargeModifiers },
  { origin: 'suit', get: suitModifiers }, { origin: 'xp', get: xpSkillModifiers }, { origin: 'traits', get: traitModifiers }, { origin: 'mood', get: moodModifiers },
];

/** A stat taken apart: the species base, every modifier that applies with its origin, and the result `stat` returns. Pure read. */
export interface StatBreakdown {
  base: number;
  parts: { origin: ModifierOrigin; op: Modifier['op']; value: number }[];
  value: number;
}

/** Resolve a stat: species base from content, then all modifiers. Systems never stack on their own. */
export function stat(sim: Sim, entity: number, name: StatName): number {
  let add = 0;
  let mul = 1;
  for (const source of modifierSources) {
    for (const m of source.get(sim, entity)) {
      if (m.stat !== name) continue;
      if (m.op === 'add') add += m.value;
      else mul *= m.value;
    }
  }
  return (statBase(sim, entity, name) + add) * mul;
}

/** The species value of a stat before any modifier (skills 0, carry capacity the default when the species sets none). */
export function statBase(sim: Sim, entity: number, name: StatName): number {
  const crew = sim.world.get(entity, CrewC);
  const species = crew ? sim.content.species[crew.species] : undefined;
  if (!species) throw new Error(`stat(${name}): entity ${entity} has no known species`);
  return (species as unknown as Record<string, number | undefined>)[name] ?? (SKILL_STATS.includes(name) ? 0 : DEFAULT_CARRY_CAPACITY);
}

/** `stat` with its working shown (the crew inspector). Same order and arithmetic as `stat`. */
export function statBreakdown(sim: Sim, entity: number, name: StatName): StatBreakdown {
  const base = statBase(sim, entity, name);
  const parts: StatBreakdown['parts'] = [];
  for (const source of modifierSources)
    for (const m of source.get(sim, entity)) if (m.stat === name) parts.push({ origin: source.origin, op: m.op, value: m.value });
  return { base, parts, value: stat(sim, entity, name) };
}
