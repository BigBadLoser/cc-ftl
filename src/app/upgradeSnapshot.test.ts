import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { ModuleC, ShipC, WeaponC, newGame, playerShip } from '../sim';
import { shipIdOf } from '../sim/regions';
import { buildCombat } from './combatSnapshot';
import { buildModuleList } from './moduleSnapshot';

describe('weapon upgrades in the UI snapshots', () => {
  const weaponsOf = (sim: ReturnType<typeof newGame>, ship: number): number[] => sim.world.query(WeaponC, ModuleC).filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === ship);
  it('the enemy card shows the upgrade on the weapon, and the weapon card the player\'s own', () => {
    const sim = newGame(3, content);
    sim.enqueue({ type: 'debug.spawnGenerated', faction: 'faction.navy', seed: 1, depth: 2, cx: 120, cy: 60 });
    sim.step();
    const ship = sim.world.query(ShipC).find((s) => s !== playerShip(sim)) as number;
    const gun = weaponsOf(sim, ship)[0] as number;
    (sim.world.get(gun, ModuleC) as { upgrade?: string }).upgrade = 'item.upg_coolant';
    const mine = sim.world.query(WeaponC, ModuleC).find((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === playerShip(sim)) as number;
    (sim.world.get(mine, ModuleC) as { upgrade?: string }).upgrade = 'item.upg_housing';
    const view = buildCombat(sim);
    expect(view.enemies.find((e) => e.ship === ship)?.charges?.find((w) => w.id === gun)?.upgrade).toEqual({ item: 'item.upg_coolant', name: 'Coolant jacket', effects: ['-30% heat per volley'] });
    expect(view.player?.weapons.find((w) => w.id === mine)?.upgrade?.item).toBe('item.upg_housing');
  });

  it('the module list carries the slot: the fitted upgrade and the cargo that fits', () => {
    const sim = newGame(3, content);
    const gun = weaponsOf(sim, playerShip(sim))[0] as number;
    (sim.world.get(gun, ModuleC) as { upgrade?: string }).upgrade = 'item.upg_capacitor';
    const slot = buildModuleList(sim).find((m) => m.id === gun)?.upgradeSlot;
    expect(slot?.fitted).toMatchObject({ item: 'item.upg_capacitor', effects: ['-15% charge time'] });
    expect(buildModuleList(sim).find((m) => sim.world.get(m.id, ModuleC)?.def === 'module.storage')?.upgradeSlot).toBeNull();
  });
});
