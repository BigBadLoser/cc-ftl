import { ModuleC, WeaponC, homeShip, placementError, type Command, type Sim } from '../sim';
import { isTileWalkable } from '../sim/modules/walk';
import { shipGrid, shipIdOf } from '../sim/regions';

/**
 * `?scenario=upgrades` (weapon upgrades, #338): the fight setup (a generated navy ship in range, `?shipgen=` picks another faction) and, on your ship, a
 * flak cannon in a free 2x2 spot, hull scrap for it, one of each general upgrade in cargo, and a quick capacitor already in the burst laser. Fit the
 * others from the module inspector (click a weapon); the enemy's guns carry upgrades too (the card shows them).
 */
export function upgradeScenarioCommands(sim: Sim): Command[] {
  const ship = homeShip(sim);
  const grid = shipGrid(sim, ship);
  if (!grid) return [];
  const out: Command[] = [];
  const open = (x: number, y: number): boolean => isTileWalkable(sim, grid, x, y);
  find: for (let y = grid.y0; y < grid.y0 + grid.height - 2; y++) {
    for (let x = grid.x0; x < grid.x0 + grid.width - 2; x++) {
      if (placementError(sim, ship, 'module.flakCannon', x, y, 0) || !open(x, y + 2) || !open(x + 2, y) || !open(x + 2, y + 1)) continue;
      out.push({ type: 'debug.spawnModule', ship, x, y, def: 'module.flakCannon', rot: 0 });
      break find;
    }
  }
  out.push({ type: 'debug.giveItems', item: 'item.scrap_hull', count: 30 });
  for (const item of ['item.upg_coolant', 'item.upg_capacitor', 'item.upg_housing']) out.push({ type: 'debug.giveItems', item, count: 2 });
  const laser = sim.world.query(WeaponC, ModuleC).find((id) => sim.world.get(id, ModuleC)?.def === 'module.burstLaser' && shipIdOf(sim, sim.world.get(id, ModuleC)) === ship);
  if (laser !== undefined) out.push({ type: 'debug.setUpgrade', moduleId: laser, item: 'item.upg_capacitor' });
  return out;
}

/** Make sure the enemy's weapons carry something to scan: its first two guns get the navy's coolant and a capacitor if the roll gave them none. */
export function enemyUpgradeCommands(sim: Sim, enemy: number): Command[] {
  const guns = sim.world.query(WeaponC, ModuleC).filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === enemy);
  return guns.slice(0, 2).flatMap((id, k): Command[] => (sim.world.get(id, ModuleC)?.upgrade ? [] : [{ type: 'debug.setUpgrade', moduleId: id, item: k === 0 ? 'item.upg_capacitor' : 'item.upg_coolant' }]));
}
