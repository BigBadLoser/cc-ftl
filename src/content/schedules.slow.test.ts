import { describe, expect, it } from 'vitest';
import { AssignmentC, CrewC, JobC, ModuleC, NeedsC, PositionC, homeShip, newGame, storageAdd, type Job, type Sim } from '../sim';
import { DAY_TICKS } from '../sim/clock';
import { jobTakeable } from '../sim/crew/jobFit';
import { blockNow, hoursOf } from '../sim/crew/schedule';
import { pipeline } from '../sim/pipeline';
import { shipIdOf } from '../sim/regions';
import { galaxySystem } from '../sim/systems/galaxy';
import { recruitsSystem } from '../sim/systems/recruits';
import { storySystem } from '../sim/systems/story';
import { tradeSystem } from '../sim/systems/trade';
import { TICK_HZ } from '../sim/time';
import { content } from './index';

/**
 * Crew schedules over whole days (#412): the starter ship's crew on the Default preset stay fed and rested, sleep at night, and nobody
 * stands idle in working hours while a job they could take waits. Quiet ship: no starmap, story or trade (as crewBonds.slow).
 */

const SKIP = new Set([galaxySystem, storySystem, recruitsSystem, tradeSystem]);
function calmStep(sim: Sim): void {
  for (const sys of pipeline) if (!SKIP.has(sys)) sys(sim);
  sim.tick++;
}

/** True if an open job the crew member could take waits on their ship. */
function workWaiting(sim: Sim, id: number): boolean {
  const pos = sim.world.get(id, PositionC)!;
  for (const j of sim.world.query(JobC)) {
    const job = sim.world.get(j, JobC) as Job;
    if (job.reservedBy === 0 && (sim.world.get(id, NeedsC) && jobTakeable(sim, id, pos, job))) return true;
  }
  return false;
}

describe('crew schedules over two game days', () => {
  it('keeps the starter crew fed and rested, asleep at night, and never idle beside waiting work', () => {
    const sim = newGame(7, content, 'ship.starter', false);
    const ship = homeShip(sim);
    const ids = sim.world.query(CrewC).filter((id) => hoursOf(sim, id));
    const store = sim.world.query(ModuleC).find((m) => shipIdOf(sim, sim.world.get(m, ModuleC)!) === ship && sim.content.modules[sim.world.get(m, ModuleC)!.def]?.storage);
    const bed = sim.world.query(ModuleC).find((m) => shipIdOf(sim, sim.world.get(m, ModuleC)!) === ship && sim.content.modules[sim.world.get(m, ModuleC)!.def]?.bed);
    let minRest = 100, minHunger = 100, sleptInBlock = 0, sleepTicks = 0, starving = 0;
    const idleFor = new Map<number, number>();
    let longestIdle = 0;
    for (let t = 0; t < 2 * DAY_TICKS; t++) {
      if (t % (5 * 60 * TICK_HZ) === 0 && store !== undefined) storageAdd(sim, store, 'item.ration', 10);
      if (t % (3 * 60 * TICK_HZ) === 0 && bed !== undefined) sim.world.get(bed, ModuleC)!.hp = 1; // a repair job every few hours
      calmStep(sim);
      starving += sim.events.drain().filter((e) => e.type === 'crew.starving').length;
      if (t % TICK_HZ !== 0) continue;
      for (const id of ids) {
        const n = sim.world.get(id, NeedsC)!;
        minRest = Math.min(minRest, n.rest);
        minHunger = Math.min(minHunger, n.hunger ?? 100);
        const block = blockNow(sim, id), asleep = sim.world.get(id, CrewC)?.activity === 'sleeping';
        if (block === 'sleep') {
          sleepTicks++;
          if (asleep) sleptInBlock++;
        }
        const idle = block === 'work' && !asleep && sim.world.get(id, CrewC)?.activity === 'idle' && !sim.world.has(id, AssignmentC) && workWaiting(sim, id);
        const sec = idle ? (idleFor.get(id) ?? 0) + 1 : 0;
        idleFor.set(id, sec);
        longestIdle = Math.max(longestIdle, sec);
      }
    }
    expect(starving).toBe(0);
    expect(minHunger).toBeGreaterThan(10);
    expect(minRest).toBeGreaterThan(20); // nobody falls to the need line: the night's sleep covers the day
    expect(sleptInBlock / sleepTicks).toBeGreaterThan(0.85); // in bed for most of every Sleep block
    expect(longestIdle).toBeLessThan(30); // seconds standing idle in working hours while a job they could take waits
  }, 900000);
});
