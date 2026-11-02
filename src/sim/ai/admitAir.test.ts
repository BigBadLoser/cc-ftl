import { describe, expect, it } from 'vitest';
import { JobC, type Job } from '../crew/components';
import { AirlockC } from '../modules/airlock';
import { SalvageCrewC } from '../salvage/components';
import { SuitC } from '../eva/components';
import { airlockOf, crew, world } from '../eva/airFixture';
import { shipGrid } from '../regions';
import { Struct } from '../structure';
import { TICK_HZ } from '../time';
import { AirAdmission } from './admitAir';
import { assignJobs } from './scheduler';
import type { Sim } from '../sim';

/** A repair-like job on the open hull just outside the airlock, in thin air, with `workSec` seconds of work. */
function hullJob(sim: Sim, workSec: number, at = { x: 13, y: 2 }): number {
  const id = sim.world.createEntity();
  sim.world.add(id, JobC, { category: 'construction', kind: 'build', x: at.x, y: at.y, struct: 1, work: workSec * TICK_HZ, progress: 0, reservedBy: 0 } satisfies Job);
  return id;
}
/** A walk of `n` tiles that ends on the default job's tile. */
const row = (n: number): { x: number; y: number }[] => Array.from({ length: n }, (_, i) => ({ x: 13 - (n - 1 - i), y: 2 }));
const walker = (_sim: Sim, c: number): { id: number; ship: number } => ({ id: c, ship: 1 });

describe('partial-work admission', () => {
  const setup = (air?: number): { sim: Sim; c: number; w: ReturnType<typeof walker> } => {
    const sim = world();
    const c = crew(sim, 4, 6);
    sim.world.add(c, SuitC, { worn: true, ...(air === undefined ? {} : { air }) });
    return { sim, c, w: walker(sim, c) };
  };
  const adm = (sim: Sim, job: number): AirAdmission => new AirAdmission(sim, [{ id: job, ship: 1, goal: { x: sim.world.get(job, JobC)!.x, y: sim.world.get(job, JobC)!.y } }]);

  it('admits a job that fits the tank: the walk, a stint, the walk back and the reserve', () => {
    const { sim, w } = setup();
    const job = hullJob(sim, 30);
    expect(adm(sim, job).rejection(w, job, row(10), false)).toBeNull();
  });

  it('admits a job far longer than a tank, because only one stint of it has to fit', () => {
    const { sim, w } = setup(300); // 5 minutes of air, a job of 10 hours
    const job = hullJob(sim, 36000);
    expect(adm(sim, job).rejection(w, job, row(10), false)).toBeNull();
  });

  it('turns a pair away when the walk, a stint and the way back do not fit the air left', () => {
    const { sim, w } = setup(60); // a stint is 60 s, so 60 s of air cannot cover the walk as well
    const job = hullJob(sim, 600);
    expect(adm(sim, job).rejection(w, job, row(10), false)).toBe('noAir');
    // A job that is almost done needs less than a stint: what is left of it counts.
    const nearly = hullJob(sim, 5);
    expect(adm(sim, nearly).rejection(w, nearly, row(10), false)).toBeNull();
  });

  it('counts a fresh suit as a full tank for a suit-up walk, and the reserve is kept back', () => {
    const sim = world();
    const c = crew(sim, 4, 6); // not suited yet
    const job = hullJob(sim, 600);
    const a = adm(sim, job);
    const w = walker(sim, c);
    expect(a.rejection(w, job, row(10), true)).toBeNull();
    expect(a.rejection(w, job, row(1500), true)).toBe('noAir'); // a walk of minutes eats the tank
    expect(a.rejection(w, job, row(10), false)).toBeNull(); // unsuited, not thin: a bare crew member is not asked
  });

  it('never admits a job no source can be reached from', () => {
    const { sim, w } = setup();
    sim.world.get(airlockOf(sim), AirlockC)!.air = 0;
    const job = hullJob(sim, 30);
    expect(adm(sim, job).rejection(w, job, row(10), false)).toBe('noSource');
  });

  it('an emergency is still admitted when no source can be reached, if the walk and a stint fit', () => {
    const { sim, w } = setup();
    sim.world.get(airlockOf(sim), AirlockC)!.air = 0;
    const job = hullJob(sim, 30);
    sim.world.get(job, JobC)!.kind = 'rescue';
    expect(adm(sim, job).rejection(w, job, row(10), false)).toBeNull();
    const far = hullJob(sim, 30);
    sim.world.get(far, JobC)!.kind = 'rescue';
    expect(adm(sim, far).rejection(w, far, row(1500), false)).toBe('noAir');
  });

  it('asks nothing of work in breathable air, robots, and salvage teams (their own air logic)', () => {
    const { sim, w, c } = setup(10);
    const inside = hullJob(sim, 30, { x: 6, y: 6 });
    sim.world.get(inside, JobC)!; // inside the ship: breathable
    sim.sector.grid.set('o2', 6, 6, 21);
    expect(adm(sim, inside).rejection(w, inside, [{ x: 5, y: 6 }, { x: 6, y: 6 }], false)).toBeNull();
    const job = hullJob(sim, 600);
    expect(adm(sim, job).rejection(w, job, row(10), false)).toBe('noAir');
    sim.world.add(c, SalvageCrewC, { trip: 0 } as never);
    expect(adm(sim, job).rejection(w, job, row(10), false)).toBeNull();
    const bot = crew(sim, 4, 7, { species: 'species.robot' });
    expect(adm(sim, job).rejection(walker(sim, bot), job, row(10), true)).toBeNull();
  });

  it('the scheduler leaves a job to a crew member whose tank cannot cover it, and gives it to one who can', () => {
    for (const [air, taken] of [[60, 0], [600, 1]] as const) {
      const sim = world();
      const c = crew(sim, 4, 6);
      sim.world.add(c, SuitC, { worn: true, air });
      const job = hullJob(sim, 600);
      expect(assignJobs(sim, [c]).size).toBe(taken);
      expect(sim.world.get(job, JobC)!.reservedBy).toBe(taken ? c : 0);
    }
  });
  it('judges a wall job from the tile the work is done from, not from the wall (suited, breathable work tile)', () => {
    const { sim, w } = setup(10); // 10 s of air: far too little for any thin-air job
    const grid = shipGrid(sim, 1)!;
    for (let x = 2; x <= 11; x++) for (let y = 2; y <= 11; y++) grid.set('o2', x, y, 21); // the interior is breathable, the hull wall at (6,1) is not
    grid.set('o2', 6, 1, 0);
    const id = sim.world.createEntity();
    sim.world.add(id, JobC, { category: 'construction', kind: 'deconstruct', x: 6, y: 1, struct: 1, work: 30 * TICK_HZ, progress: 0, reservedBy: 0 } satisfies Job);
    const a = new AirAdmission(sim, [{ id, ship: 1, goal: { x: 6, y: 1, adjacent: true } }]);
    const steps = [{ x: 4, y: 5 }, { x: 5, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }];
    expect(a.rejection(w, id, steps, false)).toBeNull();
    // The same suited crew member working from the thin side is held to the tank.
    expect(a.rejection(w, id, [{ x: 6, y: 0 }], false)).not.toBeNull();
  });

  it('prices the way back from the work tile chosen, not from the other side of a wall that does not connect', () => {
    const { sim, w } = setup(600);
    const grid = shipGrid(sim, 1)!;
    for (let y = 2; y <= 11; y++) for (let x = 2; x < 6; x++) grid.set('o2', x, y, 0); // the west half is vacuum
    for (let y = 2; y <= 11; y++) grid.set('struct', 6, y, Struct.Wall); // splits the interior: the airlock is on the east half
    const id = sim.world.createEntity();
    sim.world.add(id, JobC, { category: 'construction', kind: 'deconstruct', x: 6, y: 6, struct: 1, work: 30 * TICK_HZ, progress: 0, reservedBy: 0 } satisfies Job);
    const a = new AirAdmission(sim, [{ id, ship: 1, goal: { x: 6, y: 6, adjacent: true } }]);
    expect(a.rejection(w, id, [{ x: 7, y: 6 }], false)).toBeNull(); // east side: the airlock is a short walk
    expect(a.rejection(w, id, [{ x: 5, y: 6 }], false)).toBe('noSource'); // west side: no source can be reached from there
  });
  it('budgets a full stint for a repair, whose work is a placeholder: 45 s of air is not enough', () => {
    const { sim, w } = setup(45);
    const job = hullJob(sim, 1 / TICK_HZ); // work: 1 tick, as autojobs makes a repair
    sim.world.get(job, JobC)!.kind = 'repair';
    expect(adm(sim, job).rejection(w, job, row(10), false)).toBe('noAir');
    sim.world.get(job, JobC)!.kind = 'build'; // a build that is nearly done really does fit
    expect(adm(sim, job).rejection(w, job, row(10), false)).toBeNull();
  });
});
