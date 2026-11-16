import { describe, expect, it } from 'vitest';
import { content } from '../index';
import { ShipC, Sim } from '../../sim';
import { storagesOn } from '../../sim/combat/ammo';
import { StorageC } from '../../sim/items/components';
import { storageAdd } from '../../sim/items/storage';
import { PlotC } from '../../sim/farm/components';
import { ModuleC } from '../../sim/modules/components';
import { shipGrid } from '../../sim/regions';

/** A farming outpost whose greenhouses stand apart on the ground (the farmRows base): its crew farm them by EVA (#508). */
describe('farmRows base in the running sim', () => {
  it('crew suit up, cross the ground to the greenhouses, plant and harvest, haul the crop in, and nobody suffocates', { timeout: 120000 }, () => {
    const sim = new Sim(5, content);
    sim.enqueue({ type: 'debug.spawnOutpost', style: 'surface', kind: 'farming', seed: 3 });
    sim.step();
    const ship = [...sim.world.query(ShipC)][0]!;
    const grid = shipGrid(sim, ship)!;
    const plots = [...sim.world.query(PlotC)];
    expect(plots.length).toBeGreaterThan(0);
    // An outpost's beds are not set to a crop and it keeps no water: give it both, as a player would.
    for (const p of plots) sim.world.get(p, PlotC)!.crop = 'crop.greens';
    for (const id of [...storagesOn(sim, ship)].slice(0, 3)) storageAdd(sim, id, 'item.water', 200);
    const count: Record<string, number> = {};
    for (let i = 0; i < 9000; i++) {
      sim.step();
      for (const e of sim.events.drain()) count[e.type] = (count[e.type] ?? 0) + 1;
    }
    // (a) crew suited up, went out through an airlock and farmed.
    expect(count['suit.donned']).toBeGreaterThan(0);
    expect(count['airlock.cycled']).toBeGreaterThan(0);
    expect(count['crop.planted']).toBeGreaterThan(0);
    // (b) the crop reaches a store outside the greenhouses (hauled in).
    const rooms = new Set(plots.map((p) => { const m = sim.world.get(p, ModuleC)!; return grid.get('room', m.x, m.y); }));
    const greens = [...storagesOn(sim, ship)].filter((id) => {
      const m = sim.world.get(id, ModuleC)!;
      return !rooms.has(grid.get('room', m.x, m.y)) && (sim.world.get(id, StorageC)?.stacks ?? []).some((s) => s.item === 'item.greens' && s.count > 0);
    });
    expect(count['item.hauled']).toBeGreaterThan(0);
    expect(count['crop.harvested'] ?? 0).toBeGreaterThan(0);
    expect(greens.length, JSON.stringify(count)).toBeGreaterThan(0);
    // (c) nobody went down or died out on the ground.
    expect(count['crew.downed'] ?? 0).toBe(0);
    expect(count['crew.died'] ?? 0).toBe(0);
  });
});
