import { CrewC, DraftedC, HealthC, PositionC, type Crew } from '../crew/components';
import { abortTask } from '../ai/task';
import type { Sim } from '../sim';
import { SURRENDER_HP_FRAC, SURRENDER_RADIUS } from '../tuning';
import { AllegianceC, FighterC, SurrenderedC } from './components';
import { dropWeapon } from './equip';

const near = (a: { x: number; y: number }, b: { x: number; y: number }): boolean =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= SURRENDER_RADIUS;

/**
 * Should this crew member give up? Yes when hurt below their morale threshold (role `surrenderBelow`, default
 * SURRENDER_HP_FRAC; player crew default to never; fearless species never) while more hostiles than friends (themselves included) stand
 * within SURRENDER_RADIUS. Pure thresholds, no dice. `friends` and `foes` are the combat-ready units on the grid.
 */
export function wantsToSurrender(sim: Sim, id: number, friends: readonly number[], foes: readonly number[]): boolean {
  const crew = sim.world.get(id, CrewC);
  const hp = sim.world.get(id, HealthC);
  const pos = sim.world.get(id, PositionC);
  if (!crew || !hp || !pos || sim.content.species[crew.species]?.fearless) return false;
  const faction = sim.world.get(id, AllegianceC)?.faction;
  const limit = sim.content.roles[crew.role]?.surrenderBelow ?? (faction === 'player' ? 0 : SURRENDER_HP_FRAC);
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
