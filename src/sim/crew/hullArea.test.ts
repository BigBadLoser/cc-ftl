import { describe, expect, it } from 'vitest';
import { stampShip } from '../combat/ships';
import type { SimEvent } from '../events';
import { shipGrid } from '../regions';
import type { ContentRegistry } from '../registry';
import { Sim } from '../sim';
import { Struct } from '../structure';
import { JobC, type Priorities } from './components';
import { findJobAt } from './helpers';
import { performJob } from './jobWork';

/** A 12x12 region holding a 6x6 floor body at x 3..8, y 3..8 (the rest open space). */
const rows = Array.from({ length: 12 }, (_, y) => Array.from({ length: 12 }, (_, x) => (x >= 3 && x <= 8 && y >= 3 && y <= 8 ? '_' : '.')).join(''));
const all = (v: number): Priorities => ({
  firefighting: v, medical: v, operating: v, repair: v, construction: v, hauling: v, refining: v, crafting: v, research: v, cooking: v, patrol: v,
});
const content: ContentRegistry = {
  ships: { 'ship.t': { name: 't', rows } },
  roles: { 'role.engineer': { name: 'E', priorities: { ...all(4), construction: 1 } } },
  modules: {},
  species: { 'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6 } },
  crewNames: ['A'],
  items: {},
  recipes: {},
  structCosts: {},
};

function make(): Sim {
  const sim = new Sim(7, content);
  stampShip(sim, content.ships['ship.t']!, { faction: 'player', state: 'prize', x: 0, y: 0 });
  return sim;
}
const SHIP = 1;
const strip = (x0: number, x1: number, y0: number, y1 = y0) => {
  const out: { x: number; y: number }[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push({ x, y });
  return out;
};
const jobCount = (sim: Sim) => sim.world.query(JobC).length;
const rejections = (sim: Sim, n = 1): string[] => {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain() as SimEvent[]) if (e.type === 'command.rejected') out.push(`${e.command}:${e.reason}`);
  }
  return out;
};
const at = (sim: Sim, x: number, y: number) => shipGrid(sim, SHIP)!.get('struct', x, y);

describe('job.buildArea', () => {
  it('queues one Floor job per open tile of a valid stroke, skipping tiles that already hold hull', () => {
    const sim = make();
    sim.enqueue({ type: 'job.buildArea', ship: SHIP, tiles: strip(3, 8, 1, 3) }); // 3 open rows above + row 3 already floor
    expect(rejections(sim)).toEqual([]);
    expect(jobCount(sim)).toBe(12);
  });

  it('a 3-wide strip on the body is fine; a 2-wide stub is rejected as a whole', () => {
    const sim = make();
    sim.enqueue({ type: 'job.buildArea', ship: SHIP, tiles: strip(4, 6, 2) });
    expect(rejections(sim)).toEqual([]);
    expect(jobCount(sim)).toBe(3);
    const sim2 = make();
    sim2.enqueue({ type: 'job.buildArea', ship: SHIP, tiles: [...strip(3, 8, 2), ...strip(4, 5, 0, 1)] }); // a good strip plus a 2-wide stub
    expect(rejections(sim2)).toEqual(['job.buildArea:narrowHull']);
    expect(jobCount(sim2)).toBe(0);
  });

  it('counts queued build jobs as done', () => {
    const lone = make();
    lone.enqueue({ type: 'job.buildArea', ship: SHIP, tiles: strip(7, 8, 2) }); // 2 wide on its own
    expect(rejections(lone)).toEqual(['job.buildArea:narrowHull']);
    const sim = make();
    sim.enqueue({ type: 'job.buildArea', ship: SHIP, tiles: strip(4, 6, 2) });
    sim.enqueue({ type: 'job.buildArea', ship: SHIP, tiles: strip(7, 8, 2) }); // joins the queued strip: 5 wide
    expect(rejections(sim)).toEqual([]);
    expect(jobCount(sim)).toBe(5);
  });

  it('rejects out-of-bounds tiles and empty strokes', () => {
    const sim = make();
    sim.enqueue({ type: 'job.buildArea', ship: SHIP, tiles: [{ x: 40, y: 0 }] });
    sim.enqueue({ type: 'job.buildArea', ship: SHIP, tiles: strip(3, 5, 3) });
    expect(rejections(sim)).toEqual(['job.buildArea:outOfBounds', 'job.buildArea:sameStruct']);
  });
});

describe('job.clearArea', () => {
  it('queues deconstruct-to-Space jobs for a clean cut', () => {
    const sim = make();
    sim.enqueue({ type: 'job.clearArea', ship: SHIP, tiles: strip(7, 8, 3, 8) }); // leaves a 4-wide body
    expect(rejections(sim)).toEqual([]);
    expect(jobCount(sim)).toBe(12);
  });

  it('rejects a cut that leaves a 2-wide stub, and counts queued clears', () => {
    const sim = make();
    sim.enqueue({ type: 'job.clearArea', ship: SHIP, tiles: strip(5, 5, 3, 8) }); // body splits into 2 and 3 wide
    expect(rejections(sim)).toEqual(['job.clearArea:narrowHull']);
    const sim2 = make();
    sim2.enqueue({ type: 'job.clearArea', ship: SHIP, tiles: strip(7, 8, 3, 8) }); // 4 wide left
    sim2.enqueue({ type: 'job.clearArea', ship: SHIP, tiles: strip(5, 5, 3, 8) }); // would leave 2 and 1 wide
    expect(rejections(sim2)).toEqual(['job.clearArea:narrowHull']);
    expect(jobCount(sim2)).toBe(12);
  });

  it('refuses to clear on the same tile twice and counts that as nothing to do', () => {
    const sim = make();
    sim.enqueue({ type: 'job.clearArea', ship: SHIP, tiles: strip(8, 8, 3, 8) });
    sim.enqueue({ type: 'job.clearArea', ship: SHIP, tiles: strip(8, 8, 3, 8) });
    expect(rejections(sim)).toEqual(['job.clearArea:nothingToDeconstruct']);
  });
});

/** Finish the job on a tile the way the crew would: all its work done, then the completion step runs. */
function finish(sim: Sim, x: number, y: number): string {
  const job = sim.world.get(findJobAt(sim, SHIP, x, y), JobC)!;
  job.progress = job.work - 1;
  return performJob(sim, 0, job, 1);
}

describe('completion re-check', () => {
  it('builds both strokes when both stay queued, in any order', () => {
    const sim = make();
    sim.enqueue({ type: 'job.buildArea', ship: SHIP, tiles: strip(4, 6, 2) });
    sim.enqueue({ type: 'job.buildArea', ship: SHIP, tiles: strip(7, 8, 2) });
    expect(rejections(sim)).toEqual([]);
    for (const x of [8, 4, 7, 5, 6]) expect(finish(sim, x, 2)).toBe('done');
    expect(rejections(sim)).toEqual([]);
    for (let x = 4; x <= 8; x++) expect(at(sim, x, 2)).toBe(Struct.Floor);
  });

  it('fails a job whose partner stroke was cancelled, leaving the tile open', () => {
    const sim = make();
    sim.enqueue({ type: 'job.buildArea', ship: SHIP, tiles: strip(4, 6, 2) });
    sim.enqueue({ type: 'job.buildArea', ship: SHIP, tiles: strip(7, 8, 2) }); // valid only because the first is queued
    for (let x = 4; x <= 6; x++) sim.enqueue({ type: 'job.cancel', ship: SHIP, x, y: 2 });
    rejections(sim);
    expect(finish(sim, 7, 2)).toBe('done');
    expect(finish(sim, 8, 2)).toBe('done');
    expect(rejections(sim)).toEqual(['job.buildArea:narrowHull', 'job.buildArea:narrowHull']);
    expect(at(sim, 7, 2)).toBe(Struct.Space);
    expect(at(sim, 8, 2)).toBe(Struct.Space);
  });

  it('fails a clear job whose partner clear was cancelled', () => {
    const sim = make();
    sim.enqueue({ type: 'job.clearArea', ship: SHIP, tiles: strip(3, 4, 3, 8) }); // leaves x 5..8
    sim.enqueue({ type: 'job.clearArea', ship: SHIP, tiles: strip(5, 5, 3, 8) }); // valid only with the first: leaves x 6..8
    expect(rejections(sim)).toEqual([]);
    for (let y = 3; y <= 8; y++) for (const x of [3, 4]) sim.enqueue({ type: 'job.cancel', ship: SHIP, x, y });
    rejections(sim);
    expect(finish(sim, 5, 3)).toBe('done'); // would split the body into a 2-wide and a 3-wide part
    expect(rejections(sim)).toEqual(['job.clearArea:narrowHull']);
    expect(at(sim, 5, 3)).toBe(Struct.Floor);
  });

  it('a single job.build is not subject to the area re-check', () => {
    const sim = make();
    sim.enqueue({ type: 'job.build', ship: SHIP, x: 5, y: 2, struct: Struct.Floor });
    rejections(sim);
    expect(finish(sim, 5, 2)).toBe('done');
    expect(at(sim, 5, 2)).toBe(Struct.Floor);
  });
});
