import type { Sim } from '../sim';
import { ModuleC, ShipC } from '../sim';
import { shipIdOf } from '../sim/regions';
import { playerShips } from '../sim/story/world';
import type { UiFoeModule } from '../ui/api';
import { upgradeEffects } from './upgradeText';

/**
 * The read-only view of another ship's weapon module (combat: a left click on it while not aiming). It is the one place that decides what a player may see
 * of a foe's module, so a later scanner gate goes here: return less (or null) when the player's ship cannot scan.
 */
export function buildFoeModule(sim: Sim, id: number | null): UiFoeModule | null {
  const m = id === null ? undefined : sim.world.get(id, ModuleC);
  const def = m && sim.content.modules[m.def];
  if (id === null || !m || !def?.weapon) return null;
  const shipId = shipIdOf(sim, m);
  const ship = sim.world.get(shipId, ShipC);
  if (!ship || playerShips(sim).has(shipId)) return null;
  const up = m.upgrade ? sim.content.items[m.upgrade] : undefined;
  return {
    id, name: def.name, ship: ship.name, hp: Math.round(m.hp), maxHp: def.maxHp, powered: m.powered && m.enabled && m.hp > 0,
    slot: def.upgradeSlot ?? null,
    upgrade: m.upgrade ? { item: m.upgrade, name: up?.name ?? m.upgrade, effects: up?.upgrade ? upgradeEffects(up.upgrade) : [] } : null,
  };
}
