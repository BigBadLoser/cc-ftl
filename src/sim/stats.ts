import { CrewC } from './crew/components';
import { environmentModifiers } from './crew/conditions';
import { suitModifiers } from './eva/conditions';
import { moodModifiers } from './crew/mood';
import { xpSkillModifiers } from './story/components';
import { roleSkillModifiers } from './crew/skills';
import { chargeModifiers } from './robots/conditions';
import type { Sim } from './sim';
import { DEFAULT_CARRY_CAPACITY } from './tuning';

export type StatName = 'moveSpeed' | 'workSpeed' | 'restDecay' | 'carryCapacity' | 'gunnery' | 'piloting' | 'shielding' | 'melee' | 'repair' | 'hacking';

const SKILL_STATS: readonly StatName[] = ['gunnery', 'piloting', 'shielding', 'melee', 'repair', 'hacking'];

/** A tagged change to a stat. Applied as: (base + sum of adds) * product of muls. */
export interface Modifier {
  stat: StatName;
  op: 'add' | 'mul';
  value: number;
}

/** Returns the modifiers an entity currently has from one origin (traits, implants, items...). */
export type ModifierSource = (sim: Sim, entity: number) => readonly Modifier[];

/** Register sources here. Environment conditions today; traits and implants plug in later. */
export const modifierSources: ModifierSource[] = [environmentModifiers, roleSkillModifiers, chargeModifiers, suitModifiers, xpSkillModifiers, moodModifiers];

/** Resolve a stat: species base from content, then all modifiers. Systems never stack on their own. */
export function stat(sim: Sim, entity: number, name: StatName): number {
  const crew = sim.world.get(entity, CrewC);
  const species = crew ? sim.content.species[crew.species] : undefined;
  if (!species) throw new Error(`stat(${name}): entity ${entity} has no known species`);
  let add = 0;
  let mul = 1;
  for (const source of modifierSources) {
    for (const m of source(sim, entity)) {
      if (m.stat !== name) continue;
      if (m.op === 'add') add += m.value;
      else mul *= m.value;
    }
  }
  const base = (species as unknown as Record<string, number | undefined>)[name] ?? (SKILL_STATS.includes(name) ? 0 : DEFAULT_CARRY_CAPACITY);
  return (base + add) * mul;
}
