import { describe, expect, it } from 'vitest';
import { ShipC, deserialize, newGame, serialize, type Sim, type SimEvent } from '../sim';
import { FighterC } from '../sim/fight/components';
import { CrewC } from '../sim/crew/components';
import { StationAlarmC, StationC, StationCrewC, WantedC } from '../sim/stations/components';
import { content } from './index';

const run = (sim: Sim, n: number): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
const types = (ev: SimEvent[]): string[] => ev.map((e) => e.type);

function station(kind = 'station.trading', size: 'outpost' | 'station' | 'hub' = 'outpost', seed = 4): { sim: Sim; st: number } {
  const sim = newGame(3, content);
  sim.enqueue({ type: 'debug.spawnStation', kind, size, seed });
  run(sim, 1);
  return { sim, st: sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile)! };
}

/** Put a player crew member (an intruder) on a station's first patrol stop. */
function intrude(sim: Sim, st: number): void {
  const post = sim.world.get(st, StationC)!.posts[0]!;
  sim.enqueue({ type: 'debug.spawnCrew', ship: st, x: post.x, y: post.y, role: 'role.security', faction: 'player' });
}

describe('station life and security', () => {
  it('a quiet station stays calm; its guards arm themselves and walk their patrol', () => {
    const { sim, st } = station();
    expect(guardsOf(sim, st).length).toBeGreaterThan(0);
    const ev = run(sim, 3000);
    expect(types(ev)).not.toContain('station.alarm');
    expect(sim.world.get(st, StationAlarmC)?.state).toBe('calm');
    // Patrols are ordinary jobs: the station's director posts them, guards take them by priority.
    const watches = ev.filter((e) => e.type === 'crew.jobDone' && e.kind === 'patrol' && e.ship === st);
    expect(watches.length).toBeGreaterThanOrEqual(3);
    expect(new Set(watches.map((e) => (e.type === 'crew.jobDone' ? `${e.x},${e.y}` : ''))).size).toBeGreaterThanOrEqual(2);
  });

  it('an intruder raises the alarm; guards converge and fight, civilians run; then it calms down', () => {
    const { sim, st } = station();
    run(sim, 200);
    intrude(sim, st);
    let fled = false;
    let engaged = false;
    const ev: SimEvent[] = [];
    for (let i = 0; i < 400; i++) {
      ev.push(...run(sim, 1));
      for (const c of sim.world.query(StationCrewC, FighterC)) {
        const f = sim.world.get(c, FighterC)!;
        if (f.mode === 'flee') fled = true;
        if (f.mode === 'engage' && isGuard(sim, c)) engaged = true;
      }
    }
    expect(types(ev)).toContain('station.alarm');
    expect(sim.world.query(WantedC).length).toBe(1);
    expect(engaged).toBe(true);
    expect(fled).toBe(true);
    expect(types(ev)).toContain('crew.downed');
    // Quiet for 30 s: the alarm calms and the grudge is forgotten.
    let calmed = false;
    for (let i = 0; i < 900 && !calmed; i++) calmed = types(run(sim, 1)).includes('station.calm');
    expect(calmed).toBe(true);
    expect(sim.world.get(st, StationAlarmC)?.state).toBe('calm');
    expect(sim.world.query(WantedC).length).toBe(0);
    // The intruder was only downed: when they get up, still aboard and uninvited, the alarm goes off again.
    expect(types(run(sim, 1500))).toContain('station.alarm');
  });

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
const isGuard = (sim: Sim, c: number): boolean => sim.world.get(c, CrewC)?.role === 'role.security';
const guardsOf = (sim: Sim, st: number): number[] =>
  sim.world.query(StationCrewC).filter((c) => sim.world.get(c, StationCrewC)!.station === st && isGuard(sim, c));
