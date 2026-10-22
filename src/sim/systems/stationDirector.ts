import { CrewC, JobC, PositionC } from '../crew/components';
import { isCombatReady } from '../fight/relations';
import { isTileWalkable } from '../modules/walk';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { StationAlarmC, StationC, StationCrewC } from '../stations/components';
import { ShipC } from '../combat/components';
import { TICK_HZ } from '../time';

/** Seconds a guard stands watch at each patrol stop. */
const WATCH_SEC = 3;
/** Ticks between director passes. */
const EVERY = 10;

/**
 * A station's director: the policy layer over the shared crew AI (no NPC behaviour stack of its own). Crew pick, walk to
 * and do jobs exactly like the player's; the director only posts them. While calm it keeps one patrol job per able guard
 * at the next patrol stop (role priorities send guards to them: the 'patrol' work category); on alarm it withdraws the
 * patrols, so guards are free for the fight code, which already hunts intruders for fighter roles. The player sets their
 * own crew's jobs and priorities; an NPC ship's director does it from data.
 */
export function stationDirectorSystem(sim: Sim): void {
  if (sim.tick % EVERY !== 0) return;
  // (Ships first: querying the station stores would create them in station-less games.)
  const stations = sim.world.query(ShipC).filter((id) => sim.world.has(id, StationC));
  if (stations.length === 0) return;
  const patrols = new Map<number, number[]>();
  for (const j of sim.world.query(JobC)) {
    const job = sim.world.get(j, JobC);
    if (job?.kind !== 'patrol') continue;
    const st = shipIdOf(sim, job);
    patrols.set(st, [...(patrols.get(st) ?? []), j]);
  }
  for (const st of stations) {
    const station = sim.world.get(st, StationC);
    const alarm = sim.world.get(st, StationAlarmC);
    const mine = patrols.get(st) ?? [];
    if (!station || alarm?.state === 'alarm') {
      // Battle stations: patrols are called off (the guards' jobs vanish and they are free to fight).
      for (const j of mine) sim.world.destroyEntity(j);
      continue;
    }
    const guards = sim.world.query(StationCrewC, CrewC, PositionC).filter((c) =>
      sim.world.get(c, StationCrewC)?.station === st && (sim.content.roles[sim.world.get(c, CrewC)?.role ?? '']?.priorities.patrol ?? 0) > 0
      && isCombatReady(sim, c) && shipIdOf(sim, sim.world.get(c, PositionC)) === st);
    const grid = shipGrid(sim, st);
    for (let n = mine.length, tries = 0; n < guards.length && grid && tries < station.posts.length; tries++) {
      const post = station.posts[station.nextPost % station.posts.length] as { x: number; y: number };
      station.nextPost = (station.nextPost + 1) % station.posts.length;
      if (!grid.inBounds(post.x, post.y) || !isTileWalkable(sim, grid, post.x, post.y)) continue;
      if (mine.some((j) => sim.world.get(j, JobC)?.x === post.x && sim.world.get(j, JobC)?.y === post.y)) continue;
      const id = sim.world.createEntity();
      sim.world.add(id, JobC, { category: 'patrol', kind: 'patrol', x: post.x, y: post.y, struct: 0, work: WATCH_SEC * TICK_HZ, progress: 0, reservedBy: 0 });
      mine.push(id);
      n++;
    }
  }
}
