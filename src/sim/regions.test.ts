import { describe, expect, it } from 'vitest';
import { ShipC } from './combat/components';
import { damageStruct } from './combat/hull';
import { spawnShip } from './combat/ships';
import type { ContentRegistry, ShipTemplate } from './registry';
import { regions, shipAt, shipFrame, windowShipMismatches } from './regions';
import { deserialize, serialize } from './save';
import { gridFromTemplate } from './ship';
import { Sim } from './sim';
import { Struct, writeStruct } from './structure';
import { MIN_SHIP_GAP, REGION_PAD } from './tuning';

const BOX: ShipTemplate = { name: 'Box', rows: ['.....', '.###.', '.#_#.', '.###.'] };
const content: ContentRegistry = {
  ships: { 'ship.box': BOX }, roles: {}, species: {}, modules: {}, crewNames: [], items: {}, recipes: {}, structCosts: {},
};

const shipIdOf = (sim: Sim, gridId: number): number => sim.world.query(ShipC).find((id) => sim.world.get(id, ShipC)!.gridId === gridId)!;

describe('ship owner layer', () => {
  it('is written on stamp: structure is owned by its ShipC, vacuum by nobody', () => {
    const sim = new Sim(1, content);
    spawnShip(sim, BOX, { gridId: 1, faction: 'player', x: 10, y: 20 });
    spawnShip(sim, BOX, { gridId: 2, faction: 'hostile', x: 60, y: 20 });
    const [a, b] = [shipIdOf(sim, 1), shipIdOf(sim, 2)];
    expect(a).not.toBe(b);
    expect(shipAt(sim, 11, 21)).toBe(a); // wall
    expect(shipAt(sim, 12, 22)).toBe(a); // floor
    expect(shipAt(sim, 10, 20)).toBe(0); // Space inside the bbox
    expect(shipAt(sim, 0, 0)).toBe(0);
    expect(shipAt(sim, 62, 22)).toBe(b);
    const loaded = deserialize(serialize(sim), content);
    expect(shipAt(loaded, 62, 22)).toBe(b);
  });

  it('follows building, deconstruction and breaches', () => {
    const sim = new Sim(1, content);
    spawnShip(sim, BOX, { gridId: 1, faction: 'player', x: 10, y: 20 });
    const a = shipIdOf(sim, 1);
    const grid = sim.grids.get(1)!;
    writeStruct(grid, 4, 2, Struct.Wall); // built onto the east wall
    expect(shipAt(sim, 14, 22)).toBe(a);
    writeStruct(grid, 4, 2, Struct.Space);
    expect(shipAt(sim, 14, 22)).toBe(0);
    writeStruct(grid, 0, 0, Struct.Floor); // touches no owned tile
    expect(shipAt(sim, 10, 20)).toBe(0);
    expect(damageStruct(grid, 1, 1, 999)).toBe(true); // corner wall borders space: breaches to Space
    expect(grid.get('struct', 1, 1)).toBe(Struct.Space);
    expect(shipAt(sim, 11, 21)).toBe(0);
  });
});

describe('regions', () => {
  it('lists every grid in id order with its ship, bbox and padded frame', () => {
    const sim = new Sim(1, content);
    spawnShip(sim, BOX, { gridId: 2, faction: 'hostile', x: 60, y: 5 });
    spawnShip(sim, BOX, { gridId: 1, faction: 'player', x: 10, y: 20 });
    sim.grids.set(3, gridFromTemplate(3, { name: 'fixture', rows: ['#'] }));
    const rs = regions(sim);
    expect(rs.map((r) => r.gridId)).toEqual([1, 2, 3]);
    expect(rs.map((r) => r.ship)).toEqual([shipIdOf(sim, 1), shipIdOf(sim, 2), 0]);
    expect(rs[0]!.bbox).toEqual({ x: 10, y: 20, w: 5, h: 4 });
    expect(rs[0]!.frame).toEqual({ x: 10 - REGION_PAD, y: 20 - REGION_PAD, w: 5 + 2 * REGION_PAD, h: 4 + 2 * REGION_PAD });
    expect(shipFrame(sim.world.get(shipIdOf(sim, 1), ShipC)!)).toEqual(rs[0]!.frame);
  });
});

describe('MIN_SHIP_GAP', () => {
  const edge = 5 + REGION_PAD; // right edge (exclusive) of a box frame at x = 0
  const nearest = edge + MIN_SHIP_GAP + REGION_PAD; // the closest x another box may take

  it('debug.spawnEnemy rejects a ship whose frame comes too close', () => {
    const sim = new Sim(1, content);
    spawnShip(sim, BOX, { gridId: 1, faction: 'player', x: 0, y: 0 });
    for (const x of [3, nearest - 1, nearest]) sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.box', x, y: 0 });
    sim.step();
    const reasons = sim.events.drain().flatMap((e) => (e.type === 'command.rejected' ? [e.reason] : []));
    expect(reasons).toEqual(['overlap', 'tooClose']);
    expect(regions(sim).map((r) => r.bbox.x)).toEqual([0, nearest]);
  });

  it('spawnShip refuses to break the rule', () => {
    const sim = new Sim(1, content);
    spawnShip(sim, BOX, { gridId: 1, faction: 'player', x: 0, y: 0 });
    expect(() => spawnShip(sim, BOX, { faction: 'hostile', x: nearest - 1, y: 0 })).toThrow(/tooClose/);
    expect(() => spawnShip(sim, BOX, { faction: 'hostile', x: 0, y: 30 })).not.toThrow();
  });
});

describe('windowShipMismatches', () => {
  it('is empty when every window sits at its ShipC, and names a ship whose window disagrees', () => {
    const sim = new Sim(1, content);
    spawnShip(sim, BOX, { faction: 'player', x: 0, y: 0 });
    spawnShip(sim, BOX, { faction: 'hostile', x: 60, y: 30 });
    expect(windowShipMismatches(sim)).toEqual([]);
    // A fixture grid auto-placed on row 0 with a ShipC claiming another position is exactly the bug it catches.
    sim.grids.set(3, gridFromTemplate(3, BOX));
    const ship = sim.world.createEntity();
    sim.world.add(ship, ShipC, { gridId: 3, name: 'x', faction: 'player', state: 'active', x: 200, y: 5, width: 5, height: 4, hullMax: 0, integrity: 1 });
    expect(windowShipMismatches(sim)).toHaveLength(1);
    expect(windowShipMismatches(sim)[0]).toContain('grid 3');
  });
});
