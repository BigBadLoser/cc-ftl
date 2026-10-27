import { AssignmentC, DraftedC, JobC, PositionC } from '../crew/components';
import { releaseAssignment } from '../crew/helpers';
import { shipById } from '../combat/ships';
import { ModuleC } from '../modules/components';
import { accessTile } from '../modules/footprint';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { EmbarkOrderC } from '../vehicles/components';
import { FighterC } from './components';

/**
 * Send a drafted crew member to man a console of the player's ship (a battle station): they take its 'operate' job, walk to its
 * access tile and stand there as the operator. An operator already there is replaced. The job outlives the fight while the
 * drafted holder stands at it (see operateJobsSystem), so the order can be given before the shooting starts. Returns a reject
 * reason, or null.
 */
export function manStation(sim: Sim, crew: number, module: number): string | null {
  const pos = sim.world.get(crew, PositionC);
  if (!sim.world.has(crew, DraftedC) || !pos) return 'notDrafted';
  const m = sim.world.get(module, ModuleC);
  const def = m && sim.content.modules[m.def];
  const at = m && def && accessTile(def, m.x, m.y, m.rot);
  if (!m || !def?.console || !at || m.hp <= 0 || shipById(sim, shipIdOf(sim, m))?.faction !== 'player') return 'badTarget';
  if (shipIdOf(sim, pos) !== shipIdOf(sim, m)) return 'otherShip';
  let jobId = 0;
  for (const id of sim.world.query(JobC)) if (sim.world.get(id, JobC)?.kind === 'operate' && sim.world.get(id, JobC)?.target === module) jobId = id;
  const old = sim.world.get(jobId, JobC);
  if (old?.reservedBy === crew) return null; // already theirs
  if (old?.reservedBy) releaseAssignment(sim, old.reservedBy);
  releaseAssignment(sim, crew);
  if (!old) {
    jobId = sim.world.createEntity();
    sim.world.add(jobId, JobC, { category: 'operating', kind: 'operate', x: at.x, y: at.y, struct: 0, work: 1, progress: 0, reservedBy: 0, target: module });
  }
  (sim.world.get(jobId, JobC) as { reservedBy: number }).reservedBy = crew;
  sim.world.add(crew, AssignmentC, { jobId });
  const drafted = sim.world.get(crew, DraftedC);
  if (drafted) {
    drafted.target = null; // the station replaces a walk order
    delete drafted.planned;
  }
  const fighter = sim.world.get(crew, FighterC);
  if (fighter) fighter.ordered = 0;
  sim.world.remove(crew, EmbarkOrderC);
  return null;
}
