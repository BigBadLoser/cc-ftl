import { describe, expect, it } from 'vitest';
import { ShipC } from './combat/components';
import { spawnShip } from './combat/ships';
import { GridWindow } from './gridWindow';
import { deserialize, serialize } from './save';
import { gridFromTemplate } from './ship';
import { Sim } from './sim';
import { Struct } from './structure';

const ROWS = ['#####', '#___#', '#_D_#', '#####'];

describe('GridMap', () => {
  it('stamps a dense grid into the sector at a position and hands out the window', () => {
    const sim = new Sim(1);
    const win = sim.grids.stamp(4, gridFromTemplate(4, { name: 't', rows: ROWS }), 30, -7);
    expect(win).toBeInstanceOf(GridWindow);
    expect(sim.grids.get(4)).toBe(win);
    expect([win.width, win.height]).toEqual([5, 4]);
    expect(win.get('struct', 32, -5)).toBe(Struct.Door); // windows read sector tiles
    expect(sim.sector.grid.get('struct', 32, -5)).toBe(Struct.Door);
    expect(sim.sector.grid.get('o2', 31, -6)).toBeGreaterThan(20);
    win.set('fire', 31, -6, 9);
    expect(sim.sector.grid.get('fire', 31, -6)).toBe(9);
  });

  it('refuses a taken id or an overlapping rectangle', () => {
    const sim = new Sim(1);
    sim.grids.stamp(1, gridFromTemplate(1, { name: 't', rows: ROWS }), 0, 0);
    expect(() => sim.grids.stamp(1, gridFromTemplate(1, { name: 't', rows: ROWS }), 50, 0)).toThrow(/exists/);
    expect(() => sim.grids.stamp(2, gridFromTemplate(2, { name: 't', rows: ROWS }), 4, 3)).toThrow(/overlaps/);
    expect(() => sim.grids.stamp(2, gridFromTemplate(2, { name: 't', rows: ROWS }), 5, 0)).not.toThrow();
  });

  it('set() with a dense grid stamps it at the next free spot on row 0', () => {
    const sim = new Sim(1);
    sim.grids.set(1, gridFromTemplate(1, { name: 'a', rows: ROWS }));
    sim.grids.set(2, gridFromTemplate(2, { name: 'b', rows: ROWS }));
    expect(sim.grids.rects()).toEqual([{ id: 1, x: 0, y: 0, w: 5, h: 4 }, { id: 2, x: 37, y: 0, w: 5, h: 4 }]);
    expect(sim.grids.get(2)?.get('struct', 38, 1)).toBe(Struct.Floor);
  });

  it('spawnShip stamps at the ship position and a save round trip keeps every tile', () => {
    const sim = new Sim(1);
    const gridId = spawnShip(sim, { name: 'S', rows: ROWS }, { faction: 'player', x: 40, y: 12 });
    const ship = sim.world.get(sim.world.query(ShipC)[0]!, ShipC)!;
    expect(sim.grids.rects()).toEqual([{ id: gridId, x: ship.x, y: ship.y, w: ship.width, h: ship.height }]);
    const grid = sim.grids.get(gridId)!;
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) expect(sim.sector.grid.get('struct', 40 + x, 12 + y)).toBe(grid.get('struct', 40 + x, 12 + y));
    }
    grid.set('smoke', 42, 13, 77);
    const loaded = deserialize(serialize(sim), sim.content);
    expect(loaded.grids.get(gridId)?.get('smoke', 42, 13)).toBe(77);
    expect(serialize(loaded)).toBe(serialize(sim));
  });
});
