import { NeedsC, PrioritiesC } from '../crew/components';
import { createCrew } from '../crew/spawn';
import type { RuinHook } from '../shipgen/ruinTypes';
import type { Sim } from '../sim';
import { SAC_HP, SAC_LEAK_CHANCE } from '../tuning';
import { AlienC, EggSacC, NestC } from './components';

/** Lay a dormant egg sac of footprint `size` with its top-left on sector tile (x, y) of ship `ship`. Returns its id. */
export function laySac(sim: Sim, ship: number, x: number, y: number, size: number, leaking = sim.rng.chance(SAC_LEAK_CHANCE)): number {
  const hp = SAC_HP[size] ?? SAC_HP[1] ?? 30;
  const id = sim.world.createEntity();
  sim.world.add(id, EggSacC, { ship, x, y, size, state: 'dormant', leaking, hp, max: hp, stage: 0, timer: 0, chain: false, destroyed: false });
  return id;
}

/** The ruin pass's alien hooks as entities: an egg sac per `eggsac` hook and a nest per `nest` hook. (ox, oy): the grid's sector origin. */
export function spawnInfestation(sim: Sim, ship: number, hooks: readonly RuinHook[], ox: number, oy: number): void {
  for (const h of hooks) {
    if (h.kind === 'eggsac') laySac(sim, ship, ox + h.x, oy + h.y, h.size);
    else if (h.kind === 'nest') sim.world.add(sim.world.createEntity(), NestC, { ship, x: ox + h.x, y: oy + h.y, timer: 0, laid: 0 });
  }
}

/** A role from the content's hatch table, by weight (none: no creatures content). */
export function broodRole(sim: Sim): string | undefined {
  const table = sim.content.creatures?.hatch ?? [];
  const total = table.reduce((n, e) => n + Math.max(0, e.weight), 0);
  if (total <= 0) return undefined;
  let r = sim.rng.next() * total;
  for (const e of table) {
    r -= Math.max(0, e.weight);
    if (r < 0) return e.role;
  }
  return table[table.length - 1]?.role;
}

/**
 * An alien of `role` on tile (x, y) of ship `ship`: a crew entity of faction 'alien' with no work priorities or needs (so
 * the colony AI never runs it), leashed to the ship (AlienC). Returns the id, or 0 for an unknown role.
 */
export function spawnAlien(sim: Sim, ship: number, role: string, x: number, y: number): number {
  const id = createCrew(sim, ship, role, { x, y }, { faction: 'alien' });
  if (!id) return 0;
  sim.world.remove(id, PrioritiesC);
  sim.world.remove(id, NeedsC);
  sim.world.add(id, AlienC, { ship, homeX: x, homeY: y });
  return id;
}
