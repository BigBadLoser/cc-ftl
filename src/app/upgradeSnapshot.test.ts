import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { ModuleC, ShipC, WeaponC, newGame, playerShip } from '../sim';
import { shipIdOf } from '../sim/regions';
import { buildCombat } from './combatSnapshot';
import { buildModuleList } from './moduleSnapshot';
import { upgradeEffects } from './upgradeText';

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
    expect(view.enemies.find((e) => e.ship === ship)?.charges?.find((w) => w.id === gun)?.upgrade).toEqual({ item: 'item.upg_coolant', name: 'Coolant jacket', effects: ['Adds 30% less heat to the ship per volley'], renames: false });
    expect(view.player?.weapons.find((w) => w.id === mine)?.upgrade?.item).toBe('item.upg_housing');
  });

  it('the module list carries the slot: the fitted upgrade and the cargo that fits', () => {
    const sim = newGame(3, content);
    const gun = weaponsOf(sim, playerShip(sim))[0] as number;
    (sim.world.get(gun, ModuleC) as { upgrade?: string }).upgrade = 'item.upg_capacitor';
    const slot = buildModuleList(sim).find((m) => m.id === gun)?.upgradeSlot;
    expect(slot?.fitted).toMatchObject({ item: 'item.upg_capacitor', effects: ['Charges 15% faster'] });
    expect(buildModuleList(sim).find((m) => sim.world.get(m.id, ModuleC)?.def === 'module.storage')?.upgradeSlot).toBeNull();
  });
});

describe('upgrade hover card text', () => {
  it('every upgrade has one line saying what it does', () => {
    for (const [id, d] of Object.entries(content.items)) {
      const up = (d as { upgrade?: Parameters<typeof upgradeEffects>[0] }).upgrade;
      if (!up) continue;
      const lines = upgradeEffects(up);
      expect(lines.length, id).toBe(1);
      expect(lines[0]!.length, id).toBeGreaterThan(10);
    }
  });
});

describe('renamed weapons in the UI snapshots', () => {
  it('the weapon bar and the enemy card read the variant name and flag the rename', () => {
    const sim = newGame(3, content);
    const mine = sim.world.query(WeaponC, ModuleC).find((id) => sim.world.get(id, ModuleC)?.def === 'module.burstLaser' && shipIdOf(sim, sim.world.get(id, ModuleC)) === playerShip(sim)) as number;
    (sim.world.get(mine, ModuleC) as { upgrade?: string }).upgrade = 'item.upg_prism';
    const w = buildCombat(sim)?.player?.weapons.find((x) => x.id === mine);
    expect(w).toMatchObject({ name: 'Prism laser', short: 'Prism laser', upgrade: { renames: true } });
    (sim.world.get(mine, ModuleC) as { upgrade?: string }).upgrade = 'item.upg_coolant';
    expect(buildCombat(sim)?.player?.weapons.find((x) => x.id === mine)).toMatchObject({ name: 'Burst laser', upgrade: { renames: false } });
  });
});
