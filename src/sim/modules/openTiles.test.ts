import { describe, expect, it } from 'vitest';
import { findPath } from '../crew/pathfind';
import type { ContentRegistry, ModuleDef } from '../registry';
import { stampShip } from '../combat/ships';
import { Sim } from '../sim';
import { Struct } from '../structure';
import { applyEffects } from '../combat/effects';
import { ModuleC } from './components';
import { openTilesOf } from './footprint';
import { placementError, spawnModule, removeModule } from './spawn';
import { isTileWalkable } from './walk';
import { shipGrid } from '../regions';

const mod = (o: Partial<ModuleDef>): ModuleDef => ({
  name: 'm', asset: 'm', footprint: [1, 1], solid: false, power: 0, flammability: 0.1, maxHp: 100, buildWork: 40, ...o,
});
const content: ContentRegistry = {
  ships: {}, roles: {}, species: {}, crewNames: [], items: {}, recipes: {}, structCosts: {},
  modules: {
    // 3x2: solid except the chair (1,1) and the floor beside it (2,1). The chair is the access tile.
    desk: mod({ footprint: [3, 2], solid: true, access: [1, 1], openTiles: [[1, 1], [2, 1]] }),
    badDesk: mod({ footprint: [3, 2], solid: true, access: [1, 1], openTiles: [[2, 1]] }),
    // 4x5 engine, wall row on the north side at rotation 0.
    engine: mod({ footprint: [4, 5], solid: true, hullEdge: 'n', maxHp: 50 }),
  },
};
const rows = [
  '..........', '.########.', '.#______#.', '.#______#.', '.#______#.', '.#______#.', '.#______#.', '.########.', '..........',
];
const make = (r = rows): Sim => {
  const sim = new Sim(1, content);
  stampShip(sim, { name: 't', rows: r }, { faction: 'player', state: 'prize', x: 0, y: 0 });
  return sim;
};

describe('open tiles inside a solid footprint', () => {
  it('stay walkable and rotate with the module; the rest block', () => {
    const sim = make();
    const grid = shipGrid(sim, 1)!;
    spawnModule(sim, 'desk', 2, 2, 0);
    expect(isTileWalkable(sim, grid, 2, 2)).toBe(false);
    expect(isTileWalkable(sim, grid, 4, 2)).toBe(false);
    expect(isTileWalkable(sim, grid, 2, 3)).toBe(false);
    expect(isTileWalkable(sim, grid, 3, 3)).toBe(true);
    expect(isTileWalkable(sim, grid, 4, 3)).toBe(true);
    // Rotated a quarter turn clockwise it is 2 wide and 3 deep: (1,1) -> (0,1), (2,1) -> (0,2).
    const def = content.modules['desk'] as ModuleDef;
    expect(openTilesOf(def, 5, 2, 1)).toEqual([{ x: 5, y: 3 }, { x: 5, y: 4 }]);
  });

  it('pathing enters the chair tile through the open tile beside it, not across solid tiles', () => {
    const sim = make();
    spawnModule(sim, 'desk', 2, 2, 0);
    expect(findPath(sim, 1, { x: 6, y: 6 }, { x: 3, y: 3 })).not.toBeNull();
    expect(findPath(sim, 1, { x: 6, y: 6 }, { x: 3, y: 2 })).toBeNull(); // solid tile
    // Wall off the open pocket: south side of the desk at row 3 is still reachable only via row 4.
    const path = findPath(sim, 1, { x: 6, y: 6 }, { x: 3, y: 3 })!;
    for (const t of path) expect(isTileWalkable(sim, shipGrid(sim, 1)!, t.x, t.y)).toBe(true);
  });

  it('placement accepts an access tile inside the footprint only if it is open', () => {
    const sim = make();
    expect(placementError(sim, 1, 'desk', 2, 2, 0)).toBeNull();
    expect(placementError(sim, 1, 'badDesk', 2, 2, 0)).toBe('noAccess');
  });
});

describe('hull-edge modules (engines)', () => {
  it('need their wall row on an exterior hull line with space beyond it', () => {
    const sim = make();
    expect(placementError(sim, 1, 'engine', 2, 2, 0)).toBe('notOnHull'); // wall row would be floor
    // North hull: wall row y = 1, space above it at y = 0. 4x5 at (3,1) needs depth rows 2..5 (floor) - 5 deep: y 1..5.
    const sim2 = make(['..........', '.########.', '.#______#.', '.#______#.', '.#______#.', '.#______#.', '.#______#.', '.########.', '..........']);
    expect(placementError(sim2, 1, 'engine', 2, 1, 0)).toBeNull();
    // Rotated so the wall row faces south (rot 2) it needs the south hull line: y 3..7, wall row at y = 7.
    expect(placementError(sim2, 1, 'engine', 2, 3, 2)).toBeNull();
    // Facing east (rot 1) it is 5 wide: x 4..8, wall row x = 8 (east hull, space at x = 9).
    expect(placementError(sim2, 1, 'engine', 4, 2, 1)).toBeNull();
    // No space beyond: wall row against another room.
    const sim3 = make(['.########', '.#______#', '.#######.']);
    expect(placementError(sim3, 1, 'engine', 2, 0, 0)).not.toBeNull();
  });

  it('keep the hull airtight: the wall row stays Wall and never breaches, even when the engine dies', () => {
    const sim = make();
    const id = spawnModule(sim, 'engine', 2, 1, 0);
    const grid = shipGrid(sim, 1)!;
    applyEffects(sim, { shipId: 1, x: 3, y: 1, projectile: 0, weapon: 'w' }, [{ type: 'hullDamage', amount: 9999, radius: 1 }]);
    expect(grid.get('struct', 3, 1)).toBe(Struct.Wall);
    expect(grid.get('hp', 3, 1)).toBe(255);
    applyEffects(sim, { shipId: 1, x: 3, y: 1, projectile: 0, weapon: 'w' }, [{ type: 'moduleDamage', amount: 9999 }]);
    expect(sim.world.get(id, (ModuleC))?.hp).toBe(0);
    expect(grid.get('struct', 3, 1)).toBe(Struct.Wall);
    removeModule(sim, id);
    expect(grid.get('struct', 3, 1)).toBe(Struct.Wall);
  });
});

