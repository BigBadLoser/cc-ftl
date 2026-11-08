import { CrewC } from '../crew/components';
import type { ItemQty } from '../registry';
import type { Sim } from '../sim';
import type { ChoiceDef, EventDef, Requirement, SkillCheck } from './defs';
import { flagValue, reputationOf } from './state';
import { bestAt, hasImplant, playerCrew, playerModules, playerStock, stowedShuttles, withPlayerAboard } from './world';

const SKILL_LABEL: Record<string, string> = {
  gunnery: 'Gunnery', piloting: 'Piloting', shielding: 'Shielding', melee: 'Melee', repair: 'Repair', hacking: 'Hacking',
};

const itemName = (sim: Sim, id: string): string => sim.content.items[id]?.name ?? id;
const qty = (sim: Sim, q: ItemQty): string => `${q.count}x ${itemName(sim, q.item)}`;

/** True when the requirement holds right now. */
export const meets = (sim: Sim, req: Requirement): boolean => withPlayerAboard(sim, () => meetsNow(sim, req));
function meetsNow(sim: Sim, req: Requirement): boolean {
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
    case 'shuttle': return stowedShuttles(sim, !!req.eva) > 0;
    case 'remote': {
      const a = story.active;
      const def = a ? sim.content.events?.[a.event] : undefined;
      return !!a && (a.done ?? []).some((id) => def?.choices?.find((c) => c.id === id)?.remote === req.action);
    }
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
    case 'shuttle': return req.eva ? 'Needs an EVA shuttle in its bay' : 'Needs a shuttle in its bay';
    case 'remote': return req.action === 'hail' ? 'Hail them first' : req.action === 'scan' ? 'Scan first' : 'Probe first';
  }
}

/** Requirements of a choice plus its item cost as requirements, in display order. */
export function choiceRequirements(choice: ChoiceDef): Requirement[] {
  return [...(choice.requires ?? []), ...(choice.cost ?? []).map((c): Requirement => ({ kind: 'item', item: c.item, count: c.count }))];
}

/** A choice that acts on the event's scene: a remote action on its signal, or investigating it (a `scene` effect). */
const onScene = (choice: ChoiceDef): boolean =>
  !!choice.remote || [choice.outcome, choice.success, choice.failure].some((o) => o?.effects?.some((e) => e.type === 'scene'));

/**
 * Unmet requirement reasons for a choice (empty = available). A scene choice needs the open decision's signal: one only exists while a trip is
 * under way between hops, so a scene decision opened anywhere else (a node, a trip that has arrived) can still be answered, just not acted on.
 */
export const unmetReasons = (sim: Sim, choice: ChoiceDef): string[] => {
  const reasons = withPlayerAboard(sim, () => choiceRequirements(choice).filter((r) => !meets(sim, r)).map((r) => describeRequirement(sim, r)));
  const active = sim.story.active;
  if (onScene(choice) && (!active || sim.galaxy.signal?.event !== active.event)) reasons.push('Only from the lane');
  return reasons;
};

/** True when every eligibility condition of the event holds. */
export const eligible = (sim: Sim, def: EventDef): boolean => withPlayerAboard(sim, () => (def.eligible ?? []).every((r) => meets(sim, r)));

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
export const checkOdds = (sim: Sim, check: SkillCheck): Odds | null => withPlayerAboard(sim, () => checkOddsNow(sim, check));
function checkOddsNow(sim: Sim, check: SkillCheck): Odds | null {
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
