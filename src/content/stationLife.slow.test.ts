import { describe, expect, it } from 'vitest';
import { CrewC, NeedsC, ShipC, newGame, type SimEvent } from '../sim';
import { StationAlarmC, StationCrewC } from '../sim/stations/components';
import { content } from './index';

describe('station life over a long stretch', () => {
  it('a hub runs its schedules for two and a half minutes of game time (guard; stationLife.soak.test.ts runs seven and a half): work, sleep, no alarms, no errors', () => {
    const sim = newGame(5, content);
    sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'hub', seed: 6 });
    sim.step();
    const st = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile)!;
    // Rest now lasts about half an hour of awake time (#278), so a hub's crew would not tire inside the run: start a tenth of them tired to see the sleep schedule.
    for (const [n, c] of sim.world.query(StationCrewC).entries()) if (n % 10 === 0) sim.world.get(c, NeedsC)!.rest = 15;
    const ev: SimEvent[] = [];
    const activities = new Set<string>();
    // The first meal comes at about tick 6800 and hunger levels off near 26 by tick 8000, so 9000 ticks show every property; more only repeats the plateau.
    for (let i = 0; i < 3000; i++) {
      sim.step();
      ev.push(...sim.events.drain().filter((e) => e.type === 'crew.ate' || e.type === 'station.alarm' || e.type === 'crew.died'));
      if (i % 200 === 0) for (const c of sim.world.query(StationCrewC, CrewC)) activities.add(sim.world.get(c, CrewC)!.activity);
    }
    const crew = sim.world.query(StationCrewC);
    expect(crew.length).toBeGreaterThanOrEqual(40);
    expect(ev.filter((e) => e.type === 'crew.died')).toHaveLength(0);
    expect(ev.filter((e) => e.type === 'station.alarm')).toHaveLength(0);
    expect(sim.world.get(st, StationAlarmC)?.state).toBe('calm');
    expect(activities.has('sleeping')).toBe(true);
    expect(activities.has('walking')).toBe(true);
    // The meals come at about tick 6800, past this guard's horizon: the soak test checks hunger and eating.
  }, 600000);
});
