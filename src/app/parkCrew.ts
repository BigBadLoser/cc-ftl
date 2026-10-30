import { AllegianceC, CrewC, PathC, PositionC, abortTask, type Sim } from '../sim';

/** Debug: teleport every player crew member to a row of tiles at (x, y), dropping their task and releasing the job they held. */
export function parkCrew(sim: Sim, x: number, y: number): void {
  let i = 0;
  for (const id of sim.world.query(CrewC, PositionC)) {
    const p = sim.world.get(id, PositionC);
    if (!p || sim.world.get(id, AllegianceC)?.faction !== 'player') continue;
    p.x = p.toX = x + (i++ % 3);
    p.y = p.toY = y;
    p.progress = 0;
    const path = sim.world.get(id, PathC);
    if (path) path.steps = [];
    abortTask(sim, id, 'debug');
  }
}
