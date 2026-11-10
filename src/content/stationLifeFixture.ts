import { ShipC, newGame, type Sim, type SimEvent } from '../sim';
import { CrewC } from '../sim/crew/components';
import { AllegianceC, EquipC, FighterC } from '../sim/fight/components';
import { StationAlarmC, StationC, StationCrewC, WantedC } from '../sim/stations/components';
import { content } from './index';

export const run = (sim: Sim, n: number): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
export const types = (ev: SimEvent[]): string[] => ev.map((e) => e.type);

export function station(kind = 'station.trading', size: 'outpost' | 'station' | 'hub' = 'outpost', seed = 6): { sim: Sim; st: number } {
  const sim = newGame(3, content);
  sim.enqueue({ type: 'debug.spawnStation', kind, size, seed });
  run(sim, 1);
  return { sim, st: sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile)! };
}

/** Put a player crew member (an intruder) on a station's first patrol stop. */
export function intrude(sim: Sim, st: number): void {
  const post = sim.world.get(st, StationC)!.posts[0]!;
  sim.enqueue({ type: 'debug.spawnCrew', ship: st, x: post.x, y: post.y, role: 'role.security', faction: 'player' });
}

export const isGuard = (sim: Sim, c: number): boolean => sim.world.get(c, CrewC)?.role === 'role.security';

export type IntruderRun = { seed: number; alarmed: boolean; wanted: boolean; engaged: boolean; fled: boolean; downed: boolean; forgotten: boolean; again: boolean };

/** Plant an intruder at an outpost for each seed and watch the alarm play out: the triggers, the outcomes, the calm, and the alarm again. */
export function intruderRuns(seeds: number[]): IntruderRun[] {
  return seeds.map((seed) => {
    const { sim, st } = station('station.trading', 'outpost', seed);
    run(sim, 200);
    intrude(sim, st);
    let fled = false;
    let engaged = false;
    const ev: SimEvent[] = [];
    for (let i = 0; i < 400; i++) {
      ev.push(...run(sim, 1));
      // A bare-handed intruder, as before crew carried sidearms (docs/TRAITS.md 10.9): an armed one is downed by the guards at range
      // before any civilian sees them, and the scenario is about who runs.
      if (i === 0) for (const c of sim.world.query(CrewC)) if (sim.world.get(c, AllegianceC)?.faction === 'player') sim.world.remove(c, EquipC);
      for (const c of sim.world.query(StationCrewC, FighterC)) {
        const f = sim.world.get(c, FighterC)!;
        if (f.mode === 'flee') fled = true;
        if (f.mode === 'engage' && isGuard(sim, c)) engaged = true;
      }
    }
    const alarmed = types(ev).includes('station.alarm');
    const wanted = sim.world.query(WantedC).length === 1;
    const downed = types(ev).includes('crew.downed');
    // Quiet for 30 s: the alarm calms and the grudge is forgotten.
    let calmed = false;
    for (let i = 0; i < 900 && !calmed; i++) calmed = types(run(sim, 1)).includes('station.calm');
    const forgotten = calmed && sim.world.get(st, StationAlarmC)?.state === 'calm' && sim.world.query(WantedC).length === 0;
    // The intruder was only downed: when they get up, still aboard and uninvited, the alarm goes off again.
    let again = false;
    for (let i = 0; i < 1500 && !again; i++) again = types(run(sim, 1)).includes('station.alarm'); // stop at the alarm; 1500 ticks is the failure bound
    return { seed, alarmed, wanted, engaged, fled, downed, forgotten, again };
  });
}
