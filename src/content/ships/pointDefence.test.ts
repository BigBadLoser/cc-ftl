import { describe, expect, it } from 'vitest';
import { ModuleC, PointDefenseC, newGame, type ContentRegistry, type ShipTemplate, type Sim, type SimEvent } from '../../sim';
import { content } from '../index';

type Mod = NonNullable<ShipTemplate['modules']>[number];

const hull = [
  '##############', '#____________#', '#____________#', '#____________#', '#____________#', '#____________#',
  '#____________#', '#____________#', '##############',
];
const shooter: ShipTemplate = {
  name: 'Shooter', faction: 'hostile', crew: ['role.gunner'], rows: hull,
  modules: [
    { def: 'module.reactor', x: 1, y: 1, rot: 0 },
    { def: 'module.weaponsConsole', x: 6, y: 1, rot: 0 },
    { def: 'module.missileLauncher', x: 9, y: 1, rot: 0 },
    { def: 'module.storage', x: 5, y: 6, rot: 2, stock: [{ item: 'item.missile', count: 40 }] },
  ],
};

/** Starter-like defender: reactor, AI core, `pds` point-defence modules, plus extras. */
function defender(pds: number, core = true, extra: Mod[] = []): ShipTemplate {
  const rows = ['#'.repeat(20), ...Array.from({ length: 8 }, () => '#' + '_'.repeat(18) + '#'), '#'.repeat(20)];
  const pd: Mod[] = [0, 1, 2].slice(0, pds).map((i) => ({ def: 'module.pointDefense', x: 1 + i * 3, y: 6, rot: 0 }));
  return {
    name: 'Defender', crew: [], rows,
    modules: [
      { def: 'module.reactor', x: 1, y: 1, rot: 0 }, { def: 'module.reactor', x: 4, y: 1, rot: 0 },
      ...(core ? [{ def: 'module.aiCore', x: 8, y: 1, rot: 0 }] : []), ...pd, ...extra,
    ],
  };
}

function intercepts(template: ShipTemplate, seed = 1): { fired: number; hit: number; sim: Sim } {
  const reg: ContentRegistry = { ...content, ships: { ...content.ships, 'ship.def': template, 'ship.shoot': shooter } };
  const sim = newGame(seed, reg, 'ship.def');
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.shoot', x: 100, y: 50 });
  sim.step();
  const target = [...sim.world.query(ModuleC)].find((i) => sim.world.get(i, ModuleC)!.gridId === 1)!;
  sim.enqueue({ type: 'combat.setTarget', shipGridId: 2, weaponId: null, targetGridId: 1, targetModuleId: target });
  const events: SimEvent[] = [];
  for (let i = 0; i < 20 * 120; i++) { sim.step(); events.push(...sim.events.drain()); }
  return {
    fired: events.filter((e) => e.type === 'weapon.fired').length,
    hit: events.filter((e) => e.type === 'projectile.intercepted').length,
    sim,
  };
}

describe('point defence module', () => {
  it('intercepts some missiles when an AI core and a point-defence module work', () => {
    const r = intercepts(defender(1));
    expect(r.fired).toBeGreaterThan(5);
    expect(r.hit).toBeGreaterThan(0);
    expect(r.hit).toBeLessThan(r.fired);
  });

  it('does nothing without an AI core, and the AI core alone intercepts nothing', () => {
    expect(intercepts(defender(1, false)).hit).toBe(0);
    expect(intercepts(defender(0)).hit).toBe(0);
  });

  it('stacks: three modules intercept more than one', () => {
    expect(intercepts(defender(3)).hit).toBeGreaterThan(intercepts(defender(1)).hit);
  });

  it('turns its turret toward the incoming shot', () => {
    const r = intercepts(defender(1));
    const pd = r.sim.world.query(PointDefenseC)[0]!;
    // The shooter sits east of the defender (x = 100 vs 20): aim points broadly east.
    expect([7, 0, 1]).toContain(r.sim.world.get(pd, PointDefenseC)!.aim);
  });
});
