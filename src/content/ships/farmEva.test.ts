import { describe, expect, it } from 'vitest';
import { content } from '../index';
import { ShipC, Sim } from '../../sim';
import { storagesOn } from '../../sim/combat/ammo';
import { StorageC } from '../../sim/items/components';
import { PlotC } from '../../sim/farm/components';
import { ModuleC } from '../../sim/modules/components';
import { shipGrid } from '../../sim/regions';
import { CrewC, PositionC } from '../../sim/crew/components';
import { AirlockC } from '../../sim/modules/airlock';
import { StationCrewC } from '../../sim/stations/components';
import { findSuitStow } from '../../sim/eva/errands';
import { donSuit, doffSuit, suitTile } from '../../sim/eva/suit';
import { canStartMeal } from '../../sim/ai/machines/eat';

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
    // Out of the box: the beds are set to a crop and the base carries water.
    expect(plots.every((p) => !!sim.world.get(p, PlotC)!.crop)).toBe(true);
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

/**
 * Codex r4594587761: a worker done in a greenhouse that stands on its own took the suit off at that greenhouse's airlock, and unsuited (keeping
 * out of thin air) could no longer reach the mess or a bed. A suit is stowed only in the base's main air space, so they walk home first.
 */
describe('suit stow on a farm of separate greenhouses', () => {
  it('a suited worker at a greenhouse airlock stows the suit where, unsuited, a meal is still in reach (seed 3)', () => {
    const sim = new Sim(3, content);
    sim.enqueue({ type: 'debug.spawnOutpost', style: 'surface', kind: 'farming', seed: 3 });
    for (let i = 0; i < 100; i++) sim.step();
    const c = [...sim.world.query(CrewC)].find((id) => sim.world.has(id, StationCrewC))!;
    const pos = sim.world.get(c, PositionC)!;
    const stand = (at: { x: number; y: number }): void => void Object.assign(pos, { x: at.x, y: at.y, toX: at.x, toY: at.y, progress: 0 });
    // Unsuited at each airlock: some cut the worker off from every meal (the greenhouse's own), some do not (the main base's).
    const strands = (lock: number): boolean => {
      stand(suitTile(sim, lock)!);
      return !canStartMeal(sim, c, pos);
    };
    const locks = [...sim.world.query(AirlockC)];
    const pocket = locks.filter(strands);
    expect(pocket.length).toBeGreaterThan(0);
    expect(pocket.length).toBeLessThan(locks.length);
    for (const lock of pocket) {
      stand(suitTile(sim, lock)!);
      donSuit(sim, c, lock);
      const stow = findSuitStow(sim, c, pos)!;
      expect(stow, `from airlock ${lock}`).not.toBeNull();
      expect(pocket, `from airlock ${lock}`).not.toContain(stow.airlock);
      expect(stow.steps.length).toBeGreaterThan(0);
      // Walked there and stowed: a meal can start.
      stand(suitTile(sim, stow.airlock)!);
      doffSuit(sim, c, stow.airlock);
      expect(canStartMeal(sim, c, pos)).toBe(true);
    }
  });
});
