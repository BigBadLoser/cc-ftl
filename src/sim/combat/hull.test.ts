import { describe, expect, it } from 'vitest';
import type { ContentRegistry, ShipTemplate } from '../registry';
import { shipGrid, shipIds } from '../regions';
import { Sim } from '../sim';
import { Breach, Struct, writeStruct } from '../structure';
import { spawnShip } from './ships';
import { damageStruct } from './hull';

const BOX: ShipTemplate = { name: 'Box', rows: ['.....', '.###.', '.#_#.', '.###.'] };
const ROOMS: ShipTemplate = { name: 'Rooms', rows: ['#####', '#_#_#', '##D##', '#_#_#', '#####'] };
const content: ContentRegistry = {
  ships: {}, roles: {}, species: {}, modules: {}, crewNames: [], items: {}, recipes: {}, structCosts: {},
};

const ship = (template: ShipTemplate): ReturnType<typeof shipGrid> & object => {
  const sim = new Sim(1, content);
  spawnShip(sim, template, { faction: 'player', x: 10, y: 20 });
  return shipGrid(sim, shipIds(sim)[0] as number)!;
};

describe('breaches', () => {
  it('a hull wall shot through opens to space but remembers it was a wall', () => {
    const grid = ship(BOX);
    expect(damageStruct(grid, 12, 21, 999)).toBe(true);
    expect(grid.get('struct', 12, 21)).toBe(Struct.Space);
    expect(grid.get('breach', 12, 21)).toBe(Breach.Wall);
  });

  it('an inner wall becomes open floor, a door too, each marked with what it was', () => {
    const grid = ship(ROOMS);
    expect(damageStruct(grid, 12, 21, 999)).toBe(true);
    expect(grid.get('struct', 12, 21)).toBe(Struct.Floor);
    expect(grid.get('breach', 12, 21)).toBe(Breach.Wall);
    expect(damageStruct(grid, 12, 22, 999)).toBe(true);
    expect(grid.get('struct', 12, 22)).toBe(Struct.Floor);
    expect(grid.get('breach', 12, 22)).toBe(Breach.Door);
  });

  it('a wall that only takes damage is not a breach', () => {
    const grid = ship(BOX);
    expect(damageStruct(grid, 12, 21, 100)).toBe(false);
    expect(grid.get('struct', 12, 21)).toBe(Struct.Wall);
    expect(grid.get('breach', 12, 21)).toBe(Breach.None);
  });

  it('rebuilding the tile clears its breach mark and its wear', () => {
    const grid = ship(BOX);
    damageStruct(grid, 12, 21, 999);
    grid.set('wear', 12, 21, 80);
    writeStruct(grid, 12, 21, Struct.Wall);
    expect(grid.get('breach', 12, 21)).toBe(Breach.None);
    expect(grid.get('wear', 12, 21)).toBe(0);
  });
});
