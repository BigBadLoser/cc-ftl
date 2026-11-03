import { describe, expect, it } from 'vitest';
import { JobC, PositionC, type Job } from '../crew/components';
import { findPath } from '../crew/pathfind';
import { SuitC } from '../eva/components';
import { airlockOf, crew, run, world } from '../eva/airFixture';
import { viewOf, indexOf } from '../ai/navView';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { AirlockC, airlockTiles } from './airlock';
import { ModuleC } from './components';
import { isTileWalkable } from './walk';
import { shipGrid } from '../regions';

/**
 * #292: a door that cannot open now is not a way through. The fixture's ship has its only way out through an airlock on the east hull; the
 * tile (13, 2) is on the open hull outside it.
 */
const OUTSIDE = { x: 13, y: 2 };

function outer(sim: Sim): { x: number; y: number } {
  const id = airlockOf(sim);
  const m = sim.world.get(id, ModuleC)!;
  return airlockTiles(sim.content.modules[m.def]!, m).outer;
}

/** Switch the airlock off: it never cycles again, and stands open on its inner side. */
function kill(sim: Sim): void {
  sim.world.get(airlockOf(sim), ModuleC)!.enabled = false;
}

function hullJob(sim: Sim): number {
  const id = sim.world.createEntity();
  sim.world.add(id, JobC, { category: 'construction', kind: 'build', x: OUTSIDE.x, y: OUTSIDE.y, struct: 1, work: 30 * TICK_HZ, progress: 0, reservedBy: 0 } satisfies Job);
  return id;
}

describe('a door that cannot open is not a valid path (#292)', () => {
  it('findPath, the navigation view and the step rule all refuse the shut door of an airlock that does not work, and take it again once it works', () => {
    const sim = world();
    run(sim, 2);
    const door = outer(sim);
    expect(findPath(sim, 1, { x: 4, y: 6 }, OUTSIDE, { suited: true })).not.toBeNull();
    kill(sim);
    run(sim, 2);
    expect(sim.world.get(airlockOf(sim), AirlockC)!.state).toBe('inner');
    expect(findPath(sim, 1, { x: 4, y: 6 }, OUTSIDE, { suited: true })).toBeNull();
    expect(isTileWalkable(sim, shipGrid(sim, 1)!, door.x, door.y, true)).toBe(false);
    const v = viewOf(sim, 1, { suited: true })!;
    expect(v.label[indexOf(v, 4, 6)]).not.toBe(v.label[indexOf(v, OUTSIDE.x, OUTSIDE.y)]);
    // Back on: the cached search and view go stale with the airlock's state, not only with the grid's fields.
    sim.world.get(airlockOf(sim), ModuleC)!.enabled = true;
    run(sim, 2);
    expect(findPath(sim, 1, { x: 4, y: 6 }, OUTSIDE, { suited: true })).not.toBeNull();
    const w = viewOf(sim, 1, { suited: true })!;
    expect(w.label[indexOf(w, 4, 6)]).toBe(w.label[indexOf(w, OUTSIDE.x, OUTSIDE.y)]);
  });

  // A crew member who walks outside without air (a robot: suited crew are turned away by the air rules first, which would hide the door).
  it('a crew member whose only way to a job is through a dead airlock does not take it and never walks into the door', () => {
    const sim = world();
    kill(sim);
    const c = crew(sim, 4, 6, { species: 'species.robot' });
    const job = hullJob(sim);
    const door = outer(sim);
    for (let i = 0; i < 30 * TICK_HZ; i++) {
      run(sim, 1);
      const p = sim.world.get(c, PositionC)!;
      expect(sim.world.get(job, JobC)!.reservedBy).toBe(0);
      expect([p.x, p.y, p.toX, p.toY]).not.toEqual([door.x, door.y, door.x, door.y]);
      expect(p.toX === door.x && p.toY === door.y).toBe(false);
    }
  });

  it('control: with the airlock working the same crew member takes the job and goes out through it', () => {
    const sim = world();
    const c = crew(sim, 4, 6, { species: 'species.robot' });
    const job = hullJob(sim);
    run(sim, 20 * TICK_HZ);
    expect(sim.world.get(job, JobC)?.reservedBy ?? c).toBe(c);
    expect(sim.world.get(c, PositionC)!.x).toBeGreaterThanOrEqual(12);
  });

  it('a walker already on its way when the airlock dies stops short of the door instead of waiting in it', () => {
    const sim = world();
    const c = crew(sim, 4, 6, { drafted: true });
    sim.world.add(c, SuitC, { worn: true });
    sim.enqueue({ type: 'crew.moveTo', id: c, x: OUTSIDE.x, y: OUTSIDE.y, ship: 1 });
    run(sim, 2);
    kill(sim);
    const door = outer(sim);
    run(sim, 30 * TICK_HZ);
    const p = sim.world.get(c, PositionC)!;
    expect(p.toX === door.x && p.toY === door.y).toBe(false);
    expect(p.x === OUTSIDE.x && p.y === OUTSIDE.y).toBe(false);
  });
});
