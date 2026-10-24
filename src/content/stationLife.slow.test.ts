import { describe, expect, it } from 'vitest';
import { CrewC, NeedsC, ShipC, newGame, type SimEvent } from '../sim';
import { StationAlarmC, StationCrewC } from '../sim/stations/components';
import { content } from './index';

describe('station life over a long stretch', () => {
  it('a hub runs its schedules through its first meal and a further minute: work, meals, sleep, no alarms, no errors', () => {
    const sim = newGame(5, content);
    sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'hub', seed: 6 });
    sim.step();
    const st = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile)!;
    const ev: SimEvent[] = [];
    const activities = new Set<string>();
    // The schedule is seen working, sleeping (about tick 2800) and eating (about tick 7300). Step until all three have
    // happened (bounded at ten minutes), then watch a further minute for alarms, deaths and hunger.
    const TAIL_TICKS = 1200;
    let tail = -1;
    for (let i = 0; i < 12000 && tail < TAIL_TICKS; i++) {
      if (tail >= 0) tail++;
      sim.step();
      ev.push(...sim.events.drain().filter((e) => e.type === 'crew.ate' || e.type === 'station.alarm' || e.type === 'crew.died'));
      if (i % 200 === 0) for (const c of sim.world.query(StationCrewC, CrewC)) activities.add(sim.world.get(c, CrewC)!.activity);
      if (tail < 0 && activities.has('sleeping') && activities.has('walking') && ev.some((e) => e.type === 'crew.ate')) tail = 0;
    }
    const crew = sim.world.query(StationCrewC);
    expect(crew.length).toBeGreaterThanOrEqual(40);
    expect(ev.filter((e) => e.type === 'crew.died')).toHaveLength(0);
    expect(ev.filter((e) => e.type === 'station.alarm')).toHaveLength(0);
    expect(sim.world.get(st, StationAlarmC)?.state).toBe('calm');
    expect(activities.has('sleeping')).toBe(true);
    expect(activities.has('walking')).toBe(true);
    // Station crew get hungry (never starving) and eat where food is to be had.
    expect(crew.every((c) => (sim.world.get(c, NeedsC)?.hunger ?? 100) >= 25)).toBe(true);
    expect(ev.filter((e) => e.type === 'crew.ate').length).toBeGreaterThan(0);
  }, 600000);
});
