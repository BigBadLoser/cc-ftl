import { describe, expect, it } from 'vitest';
import { stampShip } from '../combat/ships';
import type { Faction } from '../combat/components';
import { chargeOf, fuelOf } from '../modules/energy';
import { ModuleC } from '../modules/components';
import { spawnModule } from '../modules/spawn';
import type { SimEvent } from '../events';
import type { ContentRegistry, ModuleDef } from '../registry';
import { Sim } from '../sim';
import { TICK_HZ } from '../time';

const mod = (o: Partial<ModuleDef>): ModuleDef => ({ name: 'm', asset: 'm', footprint: [1, 1], solid: false, power: 0, flammability: 0.1, maxHp: 100, buildWork: 20, ...o });
const content: ContentRegistry = {
  ships: {}, roles: {}, species: {}, crewNames: [], items: {}, recipes: {}, structCosts: {},
  modules: {
    // Two units per 100 power-seconds keeps the sums round: 1 unit = 100 power x seconds.
    reactor: mod({ power: 50, powerPriority: 1, fuel: { item: 'crystal', store: 6, refillBelow: 3, powerPerUnit: 100 } }),
    bank: mod({ battery: { capacity: 400 } }),
    lamp: mod({ power: -10, powerPriority: 2 }),
    heater: mod({ power: -30, powerPriority: 3 }),
  },
};

function setup(faction: Faction = 'player', ...defs: string[]): { sim: Sim; ids: number[] } {
  const sim = new Sim(1, content);
  stampShip(sim, { name: 't', rows: ['##########', '#________#', '##########'] }, { faction, state: 'prize', x: 0, y: 0 });
  const ids = defs.map((d, i) => spawnModule(sim, d, 1 + i, 1, 0));
  return { sim, ids };
}
const mc = (sim: Sim, id: number) => sim.world.get(id, ModuleC)!;
const run = (sim: Sim, seconds: number) => { for (let i = 0; i < seconds * TICK_HZ; i++) sim.step(); };

describe('reactor fuel', () => {
  it('burns in proportion to the power drawn, not the rated output', () => {
    const light = setup('player', 'reactor', 'lamp');
    const heavy = setup('player', 'reactor', 'lamp', 'heater');
    run(light.sim, 10);
    run(heavy.sim, 10);
    const burned = (s: { sim: Sim; ids: number[] }) => 6 - fuelOf(mc(s.sim, s.ids[0] as number), content.modules.reactor as ModuleDef);
    expect(burned(light)).toBeCloseTo((10 * 10) / 100, 3);
    expect(burned(heavy)).toBeCloseTo((40 * 10) / 100, 3);
  });

  it('an empty reactor supplies nothing: the consumers go dark and the shortage is announced', () => {
    const { sim, ids } = setup('player', 'reactor', 'lamp');
    run(sim, 1);
    sim.events.drain();
    mc(sim, ids[0] as number).fuel = 0;
    run(sim, 1);
    const events: SimEvent[] = sim.events.drain();
    expect(mc(sim, ids[0] as number).powered).toBe(false);
    expect(mc(sim, ids[1] as number).powered).toBe(false);
    expect(events.some((e) => e.type === 'power.shortage')).toBe(true);
  });

  it('runs dry on its own: a store of 6 at a 10 draw lasts 6 x 100 / 10 seconds', () => {
    const { sim, ids } = setup('player', 'reactor', 'lamp');
    run(sim, 55);
    expect(mc(sim, ids[1] as number).powered).toBe(true);
    run(sim, 6);
    expect(mc(sim, ids[1] as number).powered).toBe(false);
  });

  it('another faction\'s reactor is exempt: it never burns and never stalls', () => {
    const { sim, ids } = setup('rogue', 'reactor', 'lamp');
    run(sim, 100);
    expect(mc(sim, ids[1] as number).powered).toBe(true);
    expect(fuelOf(mc(sim, ids[0] as number), content.modules.reactor as ModuleDef)).toBe(6);
  });
});

describe('battery banks', () => {
  const bankDef = content.modules.bank as ModuleDef;

  it('covers a gap before the priority cut-off, then runs out', () => {
    const { sim, ids } = setup('player', 'reactor', 'bank', 'lamp', 'heater');
    mc(sim, ids[0] as number).fuel = 0; // no reactor power: the 40 draw runs on the 400 stored, ten seconds
    run(sim, 8);
    expect(mc(sim, ids[2] as number).powered && mc(sim, ids[3] as number).powered).toBe(true);
    expect(chargeOf(mc(sim, ids[1] as number), bankDef)).toBeCloseTo(400 - 40 * 8, 0);
    run(sim, 3);
    expect(mc(sim, ids[2] as number).powered).toBe(false);
    expect(chargeOf(mc(sim, ids[1] as number), bankDef)).toBeLessThan(40);
  });

  it('a bank too low for even the first consumer covers nothing', () => {
    const { sim, ids } = setup('player', 'reactor', 'bank', 'lamp', 'heater');
    mc(sim, ids[0] as number).fuel = 0;
    mc(sim, ids[1] as number).charge = 0.2; // the lamp needs 0.5 power-seconds a tick
    run(sim, 1);
    expect(mc(sim, ids[2] as number).powered).toBe(false);
  });

  it('charges from spare supply, and the reactor burns for the charging too', () => {
    const { sim, ids } = setup('player', 'reactor', 'bank', 'lamp');
    mc(sim, ids[1] as number).charge = 0;
    run(sim, 5);
    expect(chargeOf(mc(sim, ids[1] as number), bankDef)).toBeCloseTo(40 * 5, 0); // 50 supply - 10 draw
    expect(6 - fuelOf(mc(sim, ids[0] as number), content.modules.reactor as ModuleDef)).toBeCloseTo((50 * 5) / 100, 3); // full load while it fills
    run(sim, 5); // full at 400 after 10 s: the load drops back to the lamp's
    expect(chargeOf(mc(sim, ids[1] as number), bankDef)).toBeCloseTo(400, 3);
  });

  it('a switched-off or destroyed bank is inert, and a destroyed one loses its charge', () => {
    const { sim, ids } = setup('player', 'reactor', 'bank', 'lamp');
    mc(sim, ids[0] as number).fuel = 0;
    mc(sim, ids[1] as number).enabled = false;
    run(sim, 1);
    expect(mc(sim, ids[2] as number).powered).toBe(false);
    expect(chargeOf(mc(sim, ids[1] as number), bankDef)).toBe(400);
    mc(sim, ids[1] as number).enabled = true;
    mc(sim, ids[1] as number).hp = 0;
    run(sim, 1);
    expect(mc(sim, ids[2] as number).powered).toBe(false);
    expect(chargeOf(mc(sim, ids[1] as number), bankDef)).toBe(0);
  });
});
