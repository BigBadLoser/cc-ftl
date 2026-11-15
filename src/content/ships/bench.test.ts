import { describe, expect, it } from 'vitest';
import { ModuleC, CrewC, NeedsC, PositionC, PrioritiesC, homeShip, newGame, placementError, removeModule, shipGrid, spawnModule, type Sim } from '../../sim';
import { berthHolders, berthOf } from '../../sim/crew/berths';
import { auditReservations } from '../../sim/ai/audit';
import { accessTiles, footprintTiles } from '../../sim/modules/footprint';
import { content } from '../index';

/** The leisure furniture of #441 that is buildable without an effect yet: bench (a seat), bunk (a bed), sparring droid, planter, vending machines. */

const IDS = ['module.bench', 'module.bunk', 'module.exercise', 'module.planter', 'module.vending', 'module.vending_red'] as const;

function freeSpot(sim: Sim, def: (typeof IDS)[number]): { x: number; y: number } {
  const ship = homeShip(sim), grid = shipGrid(sim, ship)!;
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
    if (placementError(sim, ship, def, x, y, 0) === null) return { x, y };
  }
  throw new Error(`no room for ${def}`);
}

describe('leisure furniture defs', () => {
  const sim = newGame(1, content, 'ship.starter', false);
  it.each(IDS)('%s is buildable: it has a cost and work, an asset and a place on the starter ship', (id) => {
    const def = content.modules[id];
    expect(def.cost?.length).toBeGreaterThan(0);
    expect(def.buildWork).toBeGreaterThan(0);
    expect(def.asset).toBe(id);
    expect(def.category).toBe('furniture');
    expect(freeSpot(sim, id)).toBeDefined();
  });

  it('keeps the bench decor (no leisure spot) and the bunk a bed', () => {
    expect(content.modules['module.bench'].seats?.at).toHaveLength(3);
    expect(content.modules['module.bench']).not.toHaveProperty('leisure');
    expect(content.modules['module.bunk'].bed).toBe(true);
    for (const id of ['module.exercise', 'module.planter', 'module.vending', 'module.vending_red'] as const) expect(content.modules[id]).not.toHaveProperty('leisure');
  });

  it.each([0, 1, 2, 3])('keeps the two tiles in front of the bench clear at rotation %i', (rot) => {
    const def = content.modules['module.bench'];
    const ship = homeShip(sim), grid = shipGrid(sim, ship)!;
    // The front (+v) turned with the module: r0 +y, r1 -x, r2 -y, r3 +x.
    const [fx, fy] = ([[0, 1], [-1, 0], [0, -1], [1, 0]] as const)[rot] as readonly [number, number];
    const front = accessTiles(def, 0, 0, rot);
    expect(front).toHaveLength(2);
    for (const t of front) expect(footprintTiles(def, 0, 0, rot).some((f) => f.x === t.x - fx && f.y === t.y - fy)).toBe(true);
    let walled = 0;
    for (let y = grid.y0; y < grid.y0 + grid.height; y++) for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      if (placementError(sim, ship, 'module.bench', x, y, rot) === 'noAccess') walled++;
    }
    expect(walled).toBeGreaterThan(0); // somewhere on the starter ship it would face a wall, and is refused
  });
});

describe('double bunk', () => {
  it('sleeps two crew at once, one on each berth, with the ship\'s other beds gone', () => {
    const s = newGame(1, content, 'ship.starter', false);
    for (const id of s.world.query(ModuleC)) if (content.modules[s.world.get(id, ModuleC)!.def as 'module.bed'].bed) removeModule(s, id);
    for (let i = 0; i < 40; i++) s.step();
    const ship = homeShip(s);
    const at = freeSpot(s, 'module.bunk');
    const bunk = spawnModule(s, 'module.bunk', at.x, at.y, 0);
    expect(placementError(s, ship, 'module.bunk', at.x, at.y, 0)).not.toBeNull(); // it is there now
    const crew = s.world.query(CrewC).filter((id) => s.world.has(id, PrioritiesC)).slice(0, 2);
    for (const id of crew) { const n = s.world.get(id, NeedsC)!; n.rest = 2; const p = s.world.get(id, PositionC)!; p.x = p.toX = at.x; p.y = p.toY = at.y; }
    const def = content.modules['module.bunk'];
    for (let i = 0; i < 2400 && berthHolders(def, s.world.get(bunk, ModuleC)!).length < 2; i++) s.step();
    const m = s.world.get(bunk, ModuleC)!;
    expect(berthHolders(def, m).sort()).toEqual([...crew].sort());
    expect(crew.map((id) => berthOf(def, m, id)).sort()).toEqual([0, 1]);
    expect(auditReservations(s).problems).toEqual([]);
  });
});
