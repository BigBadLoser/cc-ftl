import { describe, expect, it } from 'vitest';
import { CrewC, PrioritiesC, PositionC } from '../../sim/crew/components';
import { homeShip, newGame, placementError, shipGrid, spawnModule, type Sim } from '../../sim';
import { ensureMood, moodFactors } from '../../sim/crew/mood';
import { seatedOn } from '../../sim/ai/machines/sit';
import { TaskC } from '../../sim/ai/components';
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
    expect(def.category).toBe('life');
    expect(freeSpot(sim, id)).toBeDefined();
  });

  it('keeps the bench a seat only (no leisure spot) and the bunk a bed', () => {
    expect(content.modules['module.bench'].seats?.at).toHaveLength(3);
    expect(content.modules['module.bench']).not.toHaveProperty('leisure');
    expect(content.modules['module.bunk'].bed).toBe(true);
    for (const id of ['module.exercise', 'module.planter', 'module.vending', 'module.vending_red'] as const) expect(content.modules[id]).not.toHaveProperty('leisure');
  });

  it('sitting on a bench changes no mood factor', () => {
    const s = newGame(1, content, 'ship.starter', false);
    for (let i = 0; i < 40; i++) s.step();
    const c = s.world.query(CrewC).find((id) => s.world.has(id, PrioritiesC))!;
    const keys = () => moodFactors(s, c, ensureMood(s, c)).map((f) => `${f.key}:${f.value}`);
    const before = keys();
    const p = s.world.get(c, PositionC)!;
    const b = spawnModule(s, 'module.bench', Math.round(p.x), Math.round(p.y), 0);
    s.world.add(c, TaskC, { job: 0, drive: 'idle', machine: 'sit', state: 'Sit', since: 0, class: 'any', stack: [], holds: [], bb: { target: b, n: 0, deadline: s.tick + 1000 } } as never);
    expect(seatedOn(s.world, content.modules, c)).not.toBeNull();
    expect(keys()).toEqual(before);
  });
});
