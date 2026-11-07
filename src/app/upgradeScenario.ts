import { ModuleC, WeaponC, homeShip, placementError, type Command, type Sim } from '../sim';
import { isTileWalkable } from '../sim/modules/walk';
import { shipGrid, shipIdOf } from '../sim/regions';

/**
 * `?scenario=upgrades` (weapon upgrades, #338): the fight setup (a generated navy ship in range, `?shipgen=` picks another faction) and, on your ship, a
 * flak cannon in a free 2x2 spot, hull scrap for it, two of each upgrade in cargo (the black-market nuke aside), and a prism splitter already in the burst laser. Fit the
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
  for (const item of ['item.upg_coolant', 'item.upg_capacitor', 'item.upg_housing', 'item.upg_prism', 'item.upg_focus', 'item.upg_frag', 'item.upg_rail', 'item.upg_chain', 'item.upg_thermite']) out.push({ type: 'debug.giveItems', item, count: 2 });
  const laser = sim.world.query(WeaponC, ModuleC).find((id) => sim.world.get(id, ModuleC)?.def === 'module.burstLaser' && shipIdOf(sim, sim.world.get(id, ModuleC)) === ship);
  if (laser !== undefined) out.push({ type: 'debug.setUpgrade', moduleId: laser, item: 'item.upg_prism' });
  return out;
}

/** The enemy's guns each get the behaviour upgrade made for their weapon type (prism on lasers, rail on drivers, chain on ion...), so a fight shows the upgraded shots and the card lists them. */
export function enemyUpgradeCommands(sim: Sim, enemy: number): Command[] {
  const out: Command[] = [];
  for (const id of sim.world.query(WeaponC, ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const weapon = m && sim.content.modules[m.def]?.weapon;
    if (!m || !weapon || shipIdOf(sim, m) !== enemy) continue;
    const item = Object.entries(sim.content.items).find(([, d]) => d.upgrade?.fits?.includes(weapon) && d.tags.every((t) => t !== 'contraband'))?.[0];
    if (item) out.push({ type: 'debug.setUpgrade', moduleId: id, item });
  }
  return out;
}
