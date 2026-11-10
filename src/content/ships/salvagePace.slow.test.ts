import { describe, expect, it } from 'vitest';
import { AboardC, CrewC, DeadC, EvaFloatC, JobC, TaskC, type Sim } from '../../sim';
import { shipIdOf } from '../../sim/regions';
import { AwayC, SiteRunC } from '../../sim/away/components';
import { shuttleDueBack } from '../../sim/away/trips';
import { scrapHome, setupBench } from './salvageBench';

/**
 * Salvage pace (#408) on the bench (4 crew, all at construction and hauling 1, one shuttle), 10 game minutes, seed 1. The claim is that crew
 * do not stand idle while salvage work is open; the parts and scrap floors are a backstop. Before #408 the party stood idle on the wreck
 * whenever the shuttle was away (no air source: admission turned every job away), the hold stayed full with nobody home to unload it, crew
 * too worn for a passage idled at home until they fell to the sleep or eat line, and parts came up in id order across the wreck: 17% of crew
 * time idle with work open, 61 parts, 80 scrap units home. Now about 5% (mostly waiting at home for a free suit), 135 parts, 336 units.
 * The crew keep the Any schedule (#412): needs alone decide when they rest, as the claim was made; off-duty blocks are not idle time.
 */
const IDLE_MAX = 0.08;
const STRIPPED_MIN = 110;
const SCRAP_MIN = 250;

/** Crew time idle: free to work (not asleep, eating, held, aboard or drifting) and doing nothing (no task, or a jobless walk). */
function idle(sim: Sim, id: number): boolean {
  const w = sim.world;
  if (w.has(id, AboardC) || w.has(id, EvaFloatC) || w.has(id, DeadC)) return false;
  const act = w.get(id, CrewC)?.activity;
  if (act !== 'idle' && act !== 'walking' && act !== 'working') return false;
  const t = w.get(id, TaskC);
  return !t || (t.machine === 'generic' && !t.job);
}

describe('salvage pace (#408)', () => {
  it('strips and brings scrap home at a floor rate, with idle crew time bounded', () => {
    const b = setupBench(1, { crew: 4, airlock: false });
    const { sim } = b;
    const crew = sim.world.query(CrewC).filter((c) => !sim.world.has(c, DeadC));
    for (const id of crew) sim.enqueue({ type: 'crew.schedule.preset', id, preset: 'schedule.any' });
    const ticks = 20 * 60 * 10;
    let stripped = 0, idleTicks = 0, crewTicks = 0;
    for (let i = 0; i < ticks; i++) {
      sim.step();
      for (const e of sim.events.drain()) if (e.type === 'crew.jobDone' && e.ship === b.wreck && (e.kind === 'deconstruct' || e.kind === 'moduleDecon')) stripped++;
      if (i % 20 !== 0) continue;
      // Only while salvage work is open on the wreck (a stripping job or a haul nobody holds): idle then is idle with work waiting.
      const open = sim.world.query(JobC).some((j) => {
        const job = sim.world.get(j, JobC)!;
        return job.reservedBy === 0 && (!!job.scrap || !!job.haul) && shipIdOf(sim, job) === b.wreck;
      });
      if (!open) continue;
      for (const c of crew) {
        crewTicks++;
        if (idle(sim, c)) idleTicks++;
      }
    }
    const scrap = scrapHome(sim, b.home) - b.start;
    expect(idleTicks / crewTicks).toBeLessThan(IDLE_MAX);
    expect(stripped).toBeGreaterThanOrEqual(STRIPPED_MIN);
    expect(scrap).toBeGreaterThanOrEqual(SCRAP_MIN);
  }, 240000);

  it('counts the shuttle away on a round trip as back by its estimated arrival, before the deadline the watch holds it to', () => {
    const b = setupBench(1, { crew: 4, airlock: false });
    const { sim } = b;
    let seen = 0;
    for (let i = 0; i < 20 * 60 * 8 && seen < 20; i++) {
      sim.step();
      sim.events.drain();
      for (const c of sim.world.query(AwayC)) {
        const away = sim.world.get(c, AwayC)!;
        const r = sim.world.get(away.vehicle, SiteRunC);
        const due = shuttleDueBack(sim, c, b.wreck);
        if (!r || !due || r.returnBy === undefined || r.phase !== 'board' || sim.world.has(c, AboardC)) continue;
        expect(due.ticks).toBeLessThan(r.returnBy - sim.tick); // the stop at home and the flight back, not the air deadline
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
  }, 240000);
});
