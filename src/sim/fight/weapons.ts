import { isSuited, suitDef } from '../eva/suit';
import { stat } from '../stats';
import type { HandWeaponDef } from '../registry';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import {
  ACCURACY_PER_SKILL, COVER_FULL_MULT, COVER_PARTIAL_MULT, HIT_CHANCE_MAX, HIT_CHANCE_MIN, RANGE_FALLOFF, UNARMED,
} from '../tuning';
import { EquipC } from './components';
import { CrewC } from '../crew/components';
import type { Cover } from './los';

/** What a crew member hits with: the equipped item's stats, or bare hands. */
export interface Wielded {
  /** Item id, or 'unarmed'. */
  item: string;
  def: HandWeaponDef;
}

const FISTS: HandWeaponDef = { kind: 'melee', range: 1, ...UNARMED };

/** The hand weapon def of an item id, if it is one. */
export function handDefOf(sim: Sim, item: string): HandWeaponDef | undefined {
  return sim.content.items[item]?.hand;
}

/** The equipped weapon, else the body's own (SpeciesDef.natural: claws, spit), else bare hands. */
export function wielded(sim: Sim, crew: number): Wielded {
  const item = sim.world.get(crew, EquipC)?.weapon;
  const def = item ? handDefOf(sim, item) : undefined;
  if (item && def) return { item, def };
  const species = sim.world.get(crew, CrewC)?.species;
  const natural = species ? sim.content.species[species]?.natural : undefined;
  return natural ? { item: natural.id, def: natural } : { item: 'unarmed', def: FISTS };
}

/** True if the crew member holds a real weapon. */
export function isArmed(sim: Sim, crew: number): boolean {
  return wielded(sim, crew).item !== 'unarmed';
}

/** Attack cooldown in ticks. */
export function cooldownTicks(w: HandWeaponDef): number {
  return Math.max(1, Math.round(w.cooldownSec * TICK_HZ));
}

/**
 * Chance to hit. Ranged: accuracy plus gunnery, scaled down with distance (to 1 - RANGE_FALLOFF at maximum range)
 * and by the target's cover. Melee: accuracy plus melee skill (adjacent, so no range or cover). A suit scales either by
 * its accuracyMult. Clamped to 5-95%.
 */
export function hitChance(sim: Sim, attacker: number, w: HandWeaponDef, dist: number, cover: Cover): number {
  const skill = stat(sim, attacker, w.kind === 'ranged' ? 'gunnery' : 'melee');
  let p = w.accuracy + skill * ACCURACY_PER_SKILL;
  if (w.kind === 'ranged') {
    p *= 1 - RANGE_FALLOFF * Math.min(1, dist / w.range);
    p *= cover === 'full' ? COVER_FULL_MULT : cover === 'partial' ? COVER_PARTIAL_MULT : 1;
  }
  if (isSuited(sim, attacker)) p *= suitDef(sim).accuracyMult; // a spacesuit is bulky: shots and blows land less often
  return Math.min(HIT_CHANCE_MAX, Math.max(HIT_CHANCE_MIN, p));
}
