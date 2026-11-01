import { CrewC, DraftedC, HealthC, PositionC, type Crew } from '../crew/components';
import { abortTask } from '../ai/task';
import type { Sim } from '../sim';
import { COWARD_SURRENDER_BELOW, RALLY_AFTER_TICKS, SURRENDER_HP_FRAC, SURRENDER_RADIUS } from '../tuning';
import { traitFlag } from '../crew/traits';
import { DeadC, DownedC } from '../crew/components';
import { shipIdOf } from '../regions';
import { AllegianceC, FighterC, PrisonerC, SurrenderedC } from './components';
import { isHostile } from './relations';
import { dropWeapon } from './equip';

const near = (a: { x: number; y: number }, b: { x: number; y: number }): boolean =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= SURRENDER_RADIUS;

/**
 * Should this crew member give up? Yes when hurt below their morale threshold (role `surrenderBelow`, default
 * SURRENDER_HP_FRAC; player crew default to never, a Coward below COWARD_SURRENDER_BELOW; fearless species and Brave crew never) while more hostiles than friends (themselves included) stand
 * within SURRENDER_RADIUS. Pure thresholds, no dice. `friends` and `foes` are the combat-ready units on the grid.
 */
export function wantsToSurrender(sim: Sim, id: number, friends: readonly number[], foes: readonly number[]): boolean {
  const crew = sim.world.get(id, CrewC);
  const hp = sim.world.get(id, HealthC);
  const pos = sim.world.get(id, PositionC);
  if (!crew || !hp || !pos || sim.content.species[crew.species]?.fearless || traitFlag(sim, id, 'brave')) return false;
  const faction = sim.world.get(id, AllegianceC)?.faction;
  const role = sim.content.roles[crew.role]?.surrenderBelow ?? (faction === 'player' ? 0 : SURRENDER_HP_FRAC);
  const limit = traitFlag(sim, id, 'coward') ? Math.max(role, COWARD_SURRENDER_BELOW) : role;
  if (limit <= 0 || hp.hp / hp.max >= limit) return false;
  const count = (ids: readonly number[]): number => ids.filter((o) => {
    const p = sim.world.get(o, PositionC);
    return !!p && near(p, pos);
  }).length;
  return count(foes) > count(friends);
}

/** Lay down arms: drop the weapon, stop fighting and working. The crew member stays put as a prisoner. */
export function surrender(sim: Sim, id: number): void {
  abortTask(sim, id, 'surrendered');
  sim.world.remove(id, DraftedC);
  const f = sim.world.get(id, FighterC);
  if (f) {
    f.mode = 'idle';
    f.target = 0;
    f.ordered = 0;
  }
  const item = dropWeapon(sim, id);
  if (item) sim.events.emit({ type: 'crew.unequipped', crew: id, item });
  sim.world.add(id, SurrenderedC, { tick: sim.tick });
  (sim.world.get(id, CrewC) as Crew).activity = 'idle';
  sim.events.emit({ type: 'crew.surrendered', crew: id });
}

/**
 * Player crew who gave up (a Coward below their threshold) are not prisoners of war for good: once no combat-ready hostile
 * is left on their ship, and RALLY_AFTER_TICKS have passed since they surrendered, they pick themselves up
 * and are back on duty (drafting and jobs work again). A captured crew member (PrisonerC) stays held. `units` are the
 * combat-ready crew per ship grid (combatReadyUnits).
 */
export function rallySurrendered(sim: Sim, units: ReadonlyMap<number, readonly number[]>): void {
  for (const id of [...sim.world.query(SurrenderedC)]) {
    if (sim.world.get(id, AllegianceC)?.faction !== 'player' || sim.world.has(id, PrisonerC)) continue;
    if (sim.world.has(id, DeadC) || sim.world.has(id, DownedC)) continue;
    const since = sim.world.get(id, SurrenderedC)?.tick ?? 0;
    if (sim.tick - since < RALLY_AFTER_TICKS) continue;
    const pos = sim.world.get(id, PositionC);
    if (!pos) continue;
    // Any combat-ready hostile left on the same ship keeps them down (boarders holding the helm included).
    const threat = (units.get(shipIdOf(sim, pos)) ?? []).some((o) => isHostile(sim, id, o));
    if (threat) continue;
    sim.world.remove(id, SurrenderedC);
    (sim.world.get(id, CrewC) as Crew).activity = 'idle';
    sim.events.emit({ type: 'crew.rallied', crew: id });
  }
}
