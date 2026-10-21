import { describe, expect, it } from 'vitest';
import { ShipC } from './combat/components';
import { damageStruct } from './combat/hull';
import { spawnShip } from './combat/ships';
import type { ContentRegistry, ShipTemplate } from './registry';
import { inShip, regions, shipAt, shipFrame, shipGrid, shipIdAt, shipIds } from './regions';
import { networkOf } from './modules/network';
import { bordersSpace, isEvaWalkable } from './structure';
import { deserialize, serialize } from './save';
import { Sim } from './sim';
import { Struct, writeStruct } from './structure';
import { MIN_SHIP_GAP, REGION_PAD } from './tuning';

const BOX: ShipTemplate = { name: 'Box', rows: ['.....', '.###.', '.#_#.', '.###.'] };
const content: ContentRegistry = {
  ships: { 'ship.box': BOX }, roles: {}, species: {}, modules: {}, crewNames: [], items: {}, recipes: {}, structCosts: {},
};

describe('ship owner layer', () => {
  it('is written on stamp: structure is owned by its ShipC, vacuum by nobody', () => {
    const sim = new Sim(1, content);
    spawnShip(sim, BOX, { faction: 'player', x: 10, y: 20 });
    spawnShip(sim, BOX, { faction: 'hostile', x: 60, y: 20 });
    const [a, b] = shipIds(sim) as [number, number];
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
    spawnShip(sim, BOX, { faction: 'player', x: 10, y: 20 });
    const a = shipIds(sim)[0] as number;
    const grid = shipGrid(sim, a)!;
    writeStruct(grid, 14, 22, Struct.Wall); // built onto the east wall (grids read sector tiles)
    expect(shipAt(sim, 14, 22)).toBe(a);
    writeStruct(grid, 14, 22, Struct.Space);
    expect(shipAt(sim, 14, 22)).toBe(0);
    writeStruct(grid, 10, 20, Struct.Floor); // touches no owned tile
    expect(shipAt(sim, 10, 20)).toBe(0);
    expect(damageStruct(grid, 11, 21, 999)).toBe(true); // corner wall borders space: breaches to Space
    expect(grid.get('struct', 11, 21)).toBe(Struct.Space);
    expect(shipAt(sim, 11, 21)).toBe(0);
  });
});

describe('regions', () => {
  it('lists every ship in id order with its bounded view, bbox and padded frame', () => {
    const sim = new Sim(1, content);
    spawnShip(sim, BOX, { faction: 'player', x: 10, y: 20 });
    spawnShip(sim, BOX, { faction: 'hostile', x: 60, y: 5 });
    const [a, b] = shipIds(sim) as [number, number];
    const rs = regions(sim);
    expect(rs.map((r) => r.ship)).toEqual([a, b]);
    expect(rs[0]!.bbox).toEqual({ x: 10, y: 20, w: 5, h: 4 });
    expect(rs[0]!.frame).toEqual({ x: 10 - REGION_PAD, y: 20 - REGION_PAD, w: 5 + 2 * REGION_PAD, h: 4 + 2 * REGION_PAD });
    expect(shipFrame(sim.world.get(a, ShipC)!)).toEqual(rs[0]!.frame);
    expect(rs[0]!.grid.id).toBe(a);
    expect([rs[0]!.grid.x0, rs[0]!.grid.y0, rs[0]!.grid.width, rs[0]!.grid.height]).toEqual([10, 20, 5, 4]);
    expect(shipGrid(sim, a)).toBe(rs[0]!.grid); // the same view while the rectangle is unchanged
  });
});

describe('ship bounds at the rectangle edge', () => {
  /** A 5x4 box at (10, 20): Space ring, walls, one floor tile at (12, 22). */
  const make = (): { sim: Sim; ship: number } => {
    const sim = new Sim(1, content);
    spawnShip(sim, BOX, { faction: 'player', x: 10, y: 20 });
    return { sim, ship: shipIds(sim)[0] as number };
  };

  it('inShip is exactly the ShipC rectangle (integers only)', () => {
    const { sim, ship } = make();
    expect(inShip(sim, ship, 10, 20)).toBe(true);
    expect(inShip(sim, ship, 14, 23)).toBe(true);
    for (const [x, y] of [[9, 20], [15, 20], [10, 19], [10, 24]] as const) expect(inShip(sim, ship, x, y)).toBe(false);
    expect(inShip(sim, ship, 10.5, 20)).toBe(false);
    expect(inShip(sim, 0, 10, 20)).toBe(false);
  });

  it('shipIdAt: owner inside the hull, the rectangle for Space in the bbox, the padded frame for the EVA ring, else nobody', () => {
    const { sim, ship } = make();
    expect(shipIdAt(sim, 12, 22)).toBe(ship); // floor
    expect(shipIdAt(sim, 10, 20)).toBe(ship); // Space inside the bbox
    expect(shipIdAt(sim, 10 - REGION_PAD, 20)).toBe(ship); // ring
    expect(shipIdAt(sim, 14 + REGION_PAD, 23 + REGION_PAD)).toBe(ship);
    expect(shipIdAt(sim, 10 - REGION_PAD - 1, 20)).toBe(0);
    expect(shipIdAt(sim, 15 + REGION_PAD, 20)).toBe(0);
  });

  it('the ship view bounds EVA walking, space adjacency and the power network at the rectangle', () => {
    const { sim, ship } = make();
    const g = shipGrid(sim, ship)!;
    // Hull wall (11, 21): a Space tile 8-adjacent to it inside the rectangle is walkable for a suited crew member...
    expect(isEvaWalkable(g, 10, 20)).toBe(true);
    // ...a Space tile just outside the rectangle never is, even next to the hull on the far side of the edge.
    expect(isEvaWalkable(g, 9, 20)).toBe(false);
    expect(isEvaWalkable(g, 15, 23)).toBe(false);
    // A rectangle-edge tile borders space: the neighbour past the edge counts as space.
    expect(bordersSpace(g, 10, 20)).toBe(true);
    expect(bordersSpace(g, 12, 22)).toBe(false);
    // Power: the network id is 0 inside the rectangle, 1 outside.
    expect(networkOf(g, 12, 22)).toBe(0);
    expect(networkOf(g, 9, 22)).toBe(1);
    expect(() => g.get('struct', 9, 20)).toThrow(RangeError);
  });
});

describe('MIN_SHIP_GAP', () => {
  const edge = 5 + REGION_PAD; // right edge (exclusive) of a box frame at x = 0
  const nearest = edge + MIN_SHIP_GAP + REGION_PAD; // the closest x another box may take

  it('debug.spawnEnemy rejects a ship whose frame comes too close', () => {
    const sim = new Sim(1, content);
    spawnShip(sim, BOX, { faction: 'player', x: 0, y: 0 });
    for (const x of [3, nearest - 1, nearest]) sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.box', x, y: 0 });
    sim.step();
    const reasons = sim.events.drain().flatMap((e) => (e.type === 'command.rejected' ? [e.reason] : []));
    expect(reasons).toEqual(['overlap', 'tooClose']);
    expect(regions(sim).map((r) => r.bbox.x)).toEqual([0, nearest]);
  });

  it('spawnShip refuses to break the rule', () => {
    const sim = new Sim(1, content);
    spawnShip(sim, BOX, { faction: 'player', x: 0, y: 0 });
    expect(() => spawnShip(sim, BOX, { faction: 'hostile', x: nearest - 1, y: 0 })).toThrow(/tooClose/);
    expect(() => spawnShip(sim, BOX, { faction: 'hostile', x: 0, y: 30 })).not.toThrow();
  });
});
