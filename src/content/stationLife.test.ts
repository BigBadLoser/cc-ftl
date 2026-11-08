import { describe, expect, it } from 'vitest';
import { ShipC, deserialize, serialize, type Sim, type SimEvent } from '../sim';
import { StationAlarmC, StationCrewC, WantedC } from '../sim/stations/components';
import { content } from './index';

import { intruderRuns, intrude, isGuard, run, station, types } from './stationLifeFixture';

describe('station life and security', () => {
  it('a quiet station stays calm; its guards arm themselves and walk their patrol', () => {
    const { sim, st } = station();
    expect(guardsOf(sim, st).length).toBeGreaterThan(0);
    const ev: SimEvent[] = [];
    const patrols = (): SimEvent[] => ev.filter((e) => e.type === 'crew.jobDone' && e.kind === 'patrol' && e.ship === st);
    for (let i = 0; i < 3000 && patrols().length < 3; i++) ev.push(...run(sim, 1)); // until the third watch is done, not a fixed stretch
    expect(types(ev)).not.toContain('station.alarm');
    expect(sim.world.get(st, StationAlarmC)?.state).toBe('calm');
    // Patrols are ordinary jobs: the station's director posts them, guards take them by priority.
    const watches = ev.filter((e) => e.type === 'crew.jobDone' && e.kind === 'patrol' && e.ship === st);
    expect(watches.length).toBeGreaterThanOrEqual(3);
    expect(new Set(watches.map((e) => (e.type === 'crew.jobDone' ? `${e.x},${e.y}` : ''))).size).toBeGreaterThanOrEqual(2);
  });

  it('an intruder raises the alarm; guards converge and fight, civilians run; then it calms down (seeds 1 to 3; seeds 1 to 8 in stationLife.slow.test.ts)', () => {
    // Whether civilians see the intruder before the guards down it (and how long that takes) depends on the station layout and the sim's
    // rng state, so the outcome is judged over a fixed range of seeds, not one: the triggers (alarm, wanted, guards engage) in every
    // one, the outcomes (civilians flee, intruder downed within 400 ticks, calm, alarm again) in at least half.
    const runs = intruderRuns([1, 2, 3]);
    const count = (k: 'alarmed' | 'wanted' | 'engaged' | 'fled' | 'downed' | 'forgotten' | 'again'): number => runs.filter((r) => r[k]).length;
    const table = JSON.stringify(runs);
    // Every seed reacts at once (#107: seed 7's first patrol stop was under a mess table, so its intruder was never spawned).
    for (const k of ['alarmed', 'wanted', 'engaged'] as const) expect(count(k), `${k}: ${table}`).toBe(runs.length);
    for (const k of ['fled', 'downed', 'forgotten', 'again'] as const) expect(count(k), `${k}: ${table}`).toBeGreaterThanOrEqual(1);
  }, 120000);

  it('crew from a trade run docked at the station are invited and raise no alarm', () => {
    const { sim, st } = station();
    sim.enqueue({ type: 'trade.hail', ship: st });
    run(sim, 2);
    sim.enqueue({ type: 'trade.offer', ship: st, give: [], get: [{ item: 'item.metal', count: 10 }] });
    run(sim, 2);
    sim.enqueue({ type: 'trade.accept', offer: sim.trade.offers[0]!.id });
    for (let i = 0; i < 3000 && sim.trade.deals[0]?.phase !== 'stationWork'; i++) run(sim, 1);
    expect(sim.trade.deals[0]?.phase).toBe('stationWork');
    intrude(sim, st);
    const ev = run(sim, 60);
    expect(types(ev)).not.toContain('station.alarm');
    expect(sim.world.query(WantedC).length).toBe(0);
  });

  it('a dormant pirate den wakes when someone boards it, and its guards fight', () => {
    const { sim, st } = station('station.pirate', 'outpost');
    expect(sim.world.get(st, ShipC)!.dormant).toBeDefined();
    intrude(sim, st);
    const ev = run(sim, 120);
    expect(types(ev)).toContain('ship.provoked');
    expect(sim.world.get(st, ShipC)!.dormant).toBeUndefined();
    expect(types(ev)).toContain('station.alarm');
  });

  it('pirate dens keep fewer guards than a trade station of the same size', () => {
    const guards = (kind: string): number => {
      const { sim, st } = station(kind, 'station');
      return guardsOf(sim, st).length;
    };
    expect(guards('station.pirate')).toBeLessThan(guards('station.trading'));
  });

  it('is deterministic and survives a save round trip in the middle of an alarm', () => {
    const play = (): Sim => {
      const { sim, st } = station();
      run(sim, 100);
      intrude(sim, st);
      run(sim, 40);
      return sim;
    };
    const a = play();
    const b = play();
    expect(sim0(a)).toBe('alarm');
    expect(serialize(a)).toBe(serialize(b));
    const c = deserialize(serialize(a), content);
    run(a, 300);
    run(c, 300);
    expect(serialize(c)).toBe(serialize(a));
  });
});

const sim0 = (sim: Sim): string => sim.world.get(sim.world.query(StationAlarmC)[0]!, StationAlarmC)!.state;
const guardsOf = (sim: Sim, st: number): number[] =>
  sim.world.query(StationCrewC).filter((c) => sim.world.get(c, StationCrewC)!.station === st && isGuard(sim, c));
