import { CrewC } from '../crew/components';
import { wontDo } from '../crew/wontDo';
import { stat } from '../stats';
import type { Sim } from '../sim';
import { AllegianceC } from './components';

/** True for a person on the player's crew (a species with moods): always armed, hunts by skill (docs/TRAITS.md 10.9). Robots and NPC kinds keep their kind's rules. */
export function isPlayerPerson(sim: Sim, id: number): boolean {
  const crew = sim.world.get(id, CrewC);
  return !!crew && !!sim.content.species[crew.species]?.mood && sim.world.get(id, AllegianceC)?.faction === 'player';
}

/** Hand weapons of a kind (not ion: a stunner is a special tool), best first: tier, then damage. */
function weaponsOf(sim: Sim, kind: 'ranged' | 'melee'): string[] {
  return Object.entries(sim.content.items)
    .filter(([, d]) => d.hand?.kind === kind && !d.hand.ion)
    .sort(([a, x], [b, y]) => (y.tier ?? 0) - (x.tier ?? 0) || (y.hand?.damage ?? 0) - (x.hand?.damage ?? 0) || (a < b ? -1 : 1))
    .map(([id]) => id);
}

/**
 * The one owner of "what should this crew member carry" (docs/TRAITS.md 10.9): item ids, best first. A person on the player's crew wants
 * ranged weapons when their gunnery is at least their melee, else melee ones, then the other kind; a Pacifist nothing. Everyone else
 * (robots, NPC and hostile crew) their kind's `loadout`.
 */
export function armsFor(sim: Sim, id: number): readonly string[] {
  if (!isPlayerPerson(sim, id)) return sim.content.roles[sim.world.get(id, CrewC)?.role ?? '']?.loadout ?? [];
  if (wontDo(sim, id, 'violence')) return [];
  const ranged = stat(sim, id, 'gunnery') >= stat(sim, id, 'melee');
  return ranged ? [...weaponsOf(sim, 'ranged'), ...weaponsOf(sim, 'melee')] : [...weaponsOf(sim, 'melee'), ...weaponsOf(sim, 'ranged')];
}

/** Melee or gunnery at this level makes a person on the player's crew hunt boarders out of sight (Q4; Security's `fighter` before). */
export const HUNT_MIN_SKILL = 6;

/** True if the crew member hunts boarders they cannot see yet: a `fighter` kind, or a person of the player's crew with melee or gunnery >= HUNT_MIN_SKILL. */
export function huntsBoarders(sim: Sim, id: number): boolean {
  if (sim.content.roles[sim.world.get(id, CrewC)?.role ?? '']?.fighter) return true;
  return isPlayerPerson(sim, id) && !wontDo(sim, id, 'violence') && Math.max(stat(sim, id, 'melee'), stat(sim, id, 'gunnery')) >= HUNT_MIN_SKILL;
}
