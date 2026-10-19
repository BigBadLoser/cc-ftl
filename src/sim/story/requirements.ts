import { CrewC } from '../crew/components';
import type { ItemQty } from '../registry';
import type { Sim } from '../sim';
import type { ChoiceDef, EventDef, Requirement, SkillCheck } from './defs';
import { flagValue, reputationOf } from './state';
import { bestAt, hasImplant, playerCrew, playerModules, playerStock } from './world';

const SKILL_LABEL: Record<string, string> = {
  gunnery: 'Gunnery', piloting: 'Piloting', shielding: 'Shielding', melee: 'Melee', repair: 'Repair', hacking: 'Hacking',
};

const itemName = (sim: Sim, id: string): string => sim.content.items[id]?.name ?? id;
const qty = (sim: Sim, q: ItemQty): string => `${q.count}x ${itemName(sim, q.item)}`;

/** True when the requirement holds right now. */
export function meets(sim: Sim, req: Requirement): boolean {
  const story = sim.story;
  switch (req.kind) {
    case 'species':
      return playerCrew(sim).filter((id) => sim.world.get(id, CrewC)?.species === req.species).length >= (req.count ?? 1);
    case 'implant': return playerCrew(sim).some((id) => hasImplant(sim, id, req.implant));
    case 'skill': return (bestAt(sim, req.skill)?.level ?? 0) >= req.level;
    case 'module': return playerModules(sim, req.def).length >= (req.count ?? 1);
    case 'item': return playerStock(sim, req.item) >= req.count;
    case 'reputation': {
      const v = reputationOf(story, req.faction);
      return v >= (req.min ?? -Infinity) && v <= (req.max ?? Infinity);
    }
    case 'flag': {
      const v = flagValue(story, req.flag);
      return v >= (req.min ?? (req.max === undefined ? 1 : -Infinity)) && v <= (req.max ?? Infinity);
    }
    case 'crew': return playerCrew(sim).length >= req.count;
  }
}

/** Player-facing reason a requirement is unmet ("Needs a Robot aboard"). */
export function describeRequirement(sim: Sim, req: Requirement): string {
  switch (req.kind) {
    case 'species': {
      const name = sim.content.species[req.species]?.name ?? req.species;
      return (req.count ?? 1) > 1 ? `Needs ${req.count} ${name} aboard` : `Needs a ${name} aboard`;
    }
    case 'implant': return `Needs a crew member with the ${req.implant} implant`;
    case 'skill': return `Needs ${SKILL_LABEL[req.skill] ?? req.skill} skill ${req.level}`;
    case 'module': return `Needs ${(req.count ?? 1) > 1 ? `${req.count}x ` : 'a '}${sim.content.modules[req.def]?.name ?? req.def}`;
    case 'item': return `Needs ${qty(sim, req)}`;
    case 'reputation': {
      const lo = req.min !== undefined ? `at least ${req.min}` : '';
      const hi = req.max !== undefined ? `at most ${req.max}` : '';
      return `Needs standing with ${req.faction} ${[lo, hi].filter(Boolean).join(' and ')}`;
    }
    case 'flag': return (req.max ?? Infinity) < 1 ? `Not after ${req.flag}` : `Needs ${req.flag}`;
    case 'crew': return `Needs ${req.count} crew`;
  }
}

/** Requirements of a choice plus its item cost as requirements, in display order. */
export function choiceRequirements(choice: ChoiceDef): Requirement[] {
  return [...(choice.requires ?? []), ...(choice.cost ?? []).map((c): Requirement => ({ kind: 'item', item: c.item, count: c.count }))];
}

/** Unmet requirement reasons for a choice (empty = available). */
export function unmetReasons(sim: Sim, choice: ChoiceDef): string[] {
  return choiceRequirements(choice).filter((r) => !meets(sim, r)).map((r) => describeRequirement(sim, r));
}

/** True when every eligibility condition of the event holds. */
export function eligible(sim: Sim, def: EventDef): boolean {
  return (def.eligible ?? []).every((r) => meets(sim, r));
}

export interface Odds {
  /** 0..1 chance of success. */
  chance: number;
  /** The crew member who rolls, and their level. */
  crew: number;
  level: number;
  /** "Repair skill 6 (Mara): 70%". */
  label: string;
}

export const CHECK_DEFAULT_BASE = 0.5;
export const CHECK_DEFAULT_PER_LEVEL = 0.1;
export const CHECK_MIN = 0.05;
export const CHECK_MAX = 0.95;

/** Odds of a skill check with the best crew member rolling. Null with no crew to roll. */
export function checkOdds(sim: Sim, check: SkillCheck): Odds | null {
  const best = bestAt(sim, check.skill);
  if (!best) return null;
  const raw = (check.base ?? CHECK_DEFAULT_BASE) + (check.perLevel ?? CHECK_DEFAULT_PER_LEVEL) * (best.level - check.difficulty);
  const chance = Math.min(CHECK_MAX, Math.max(CHECK_MIN, raw));
  const name = sim.world.get(best.crew, CrewC)?.name ?? 'Crew';
  return {
    chance, crew: best.crew, level: best.level,
    label: `${SKILL_LABEL[check.skill] ?? check.skill} skill ${Math.round(best.level)} (${name}): ${Math.round(chance * 100)}%`,
  };
}

export { qty as describeQty };
