import { ammoCount, consumeAmmo } from '../combat/ammo';
import { shipOf } from '../combat/ships';
import { CrewC, DeadC, HealthC, JobC, NeedsC, PathC, PositionC, type Crew, type Job, type Path, type Position } from '../crew/components';
import { clearPath, isSettled, origin } from '../crew/helpers';
import type { WorkResult } from '../crew/jobWork';
import { findPath } from '../crew/pathfind';
import { createCrew } from '../crew/spawn';
import { consumeDelivered } from '../items/materials';
import { ModuleC } from '../modules/components';
import { openTilesOf } from '../modules/footprint';
import type { Sim } from '../sim';
import { BAY_REPAIR_BELOW } from '../tuning';
import { speciesOf } from './core';
import { gridIdOf } from '../regions';

/** True if the module is a robot bay. */
export function isBay(sim: Sim, id: number): boolean {
  const m = sim.world.get(id, ModuleC);
  return !!m && !!sim.content.modules[m.def]?.robotBay;
}

/** The living robot that calls this bay home (Module.reservedBy), or 0. */
export function bayOccupant(sim: Sim, bay: number): number {
  const r = sim.world.get(bay, ModuleC)?.reservedBy ?? 0;
  return r && sim.world.has(r, CrewC) && !sim.world.has(r, DeadC) ? r : 0;
}

/** The tile of a bay's cradle (its walkable open tile, where the robot stands), or the module origin without one. */
export function cradleOf(sim: Sim, bay: number): { x: number; y: number } {
  const m = sim.world.get(bay, ModuleC);
  const def = m && sim.content.modules[m.def];
  return (m && def && openTilesOf(def, m.x, m.y, m.rot)[0]) || { x: m?.x ?? 0, y: m?.y ?? 0 };
}

/** The assemble job running in a bay, or 0. */
export function assemblyAt(sim: Sim, bay: number): number {
  return sim.world.query(JobC).find((j) => {
    const job = sim.world.get(j, JobC);
    return job?.kind === 'assemble' && job.target === bay;
  }) ?? 0;
}

/** A bay takes one robot: free when nobody calls it home and nothing is being assembled in it. */
export function bayFree(sim: Sim, bay: number): boolean {
  const m = sim.world.get(bay, ModuleC);
  return !!m && m.hp > 0 && isBay(sim, bay) && !bayOccupant(sim, bay) && !assemblyAt(sim, bay);
}

/** The robot's home bay, or 0. */
export function homeBay(sim: Sim, robot: number): number {
  return sim.world.query(ModuleC).find((id) => sim.world.get(id, ModuleC)?.reservedBy === robot && isBay(sim, id)) ?? 0;
}

/** The first of a robot's repair items its grid's storage holds, or null. */
export function repairItem(sim: Sim, robot: number, gridId: number): string | null {
  for (const item of speciesOf(sim, robot)?.mechanical?.items ?? []) if (ammoCount(sim, gridId, item) > 0) return item;
  return null;
}

/** A battery robot wants its bay: charge under `lowBelow`, or badly damaged while the ship has parts to fix it. */
export function wantsBay(sim: Sim, robot: number): boolean {
  const battery = speciesOf(sim, robot)?.charge;
  if (!battery) return false;
  if ((sim.world.get(robot, NeedsC)?.charge ?? 100) < battery.lowBelow) return true;
  const hp = sim.world.get(robot, HealthC);
  const pos = sim.world.get(robot, PositionC);
  return !!hp && !!pos && hp.hp < hp.max * BAY_REPAIR_BELOW && repairItem(sim, robot, pos.gridId) !== null;
}

/**
 * Walk to the home bay (claiming the nearest free one on this grid as home if it has none here) and settle into the
 * cradle: activity 'charging'. Returns false when no bay can be reached, so the robot carries on as usual.
 */
export function goToBay(sim: Sim, robot: number, crew: Crew, pos: Position): boolean {
  let bay = homeBay(sim, robot);
  const home = bay ? sim.world.get(bay, ModuleC) : undefined;
  if (home && gridIdOf(sim, home) !== pos.gridId) return false; // its home is on another grid: no squatting here
  if (home && home.hp <= 0) {
    home.reservedBy = 0; // wrecked home: find another
    bay = 0;
  }
  if (!bay) {
    let best = Infinity;
    for (const id of sim.world.query(ModuleC)) {
      const m = sim.world.get(id, ModuleC);
      if (!m || gridIdOf(sim, m) !== pos.gridId || !bayFree(sim, id)) continue;
      const steps = findPath(sim, pos.gridId, origin(pos), cradleOf(sim, id));
      if (steps && steps.length < best) [bay, best] = [id, steps.length];
    }
    if (!bay) return false;
    (sim.world.get(bay, ModuleC) as { reservedBy: number }).reservedBy = robot;
  }
  const m = cradleOf(sim, bay);
  const path = sim.world.get(robot, PathC) as Path;
  if (isSettled(pos) && pos.x === m.x && pos.y === m.y) {
    clearPath(sim, robot);
    crew.activity = 'charging';
    sim.events.emit({ type: 'robot.charging', crew: robot, bay });
    return true;
  }
  if (path.steps.length > 0 || !isSettled(pos)) return true;
  const steps = findPath(sim, pos.gridId, origin(pos), { x: m.x, y: m.y });
  if (!steps || steps.length === 0) return false;
  path.steps = steps;
  return true;
}

/** Assemble: once the materials are in, `work` ticks; then the robot steps out of the cradle and the bay is its home. */
export function performAssemble(sim: Sim, job: Job, speed: number): WorkResult {
  const bay = sim.world.get(job.target ?? 0, ModuleC);
  const role = job.assemble?.role;
  if (!bay || bay.hp <= 0 || !role) return 'done';
  job.progress = Math.min(job.work, job.progress + speed);
  if (job.progress < job.work) return 'working';
  const robot = createCrew(sim, gridIdOf(sim, bay), role, cradleOf(sim, job.target ?? 0), { faction: shipOf(sim, gridIdOf(sim, bay))?.faction ?? 'player' });
  if (!robot) return 'done';
  bay.reservedBy = robot;
  consumeDelivered(job);
  sim.events.emit({ type: 'robot.assembled', crew: robot, bay: job.target ?? 0, gridId: gridIdOf(sim, bay) });
  return 'done';
}

/** Take one repair item for a bay's credit; returns hp bought (0 when the ship has none). */
export function buyRepair(sim: Sim, robot: number, gridId: number): number {
  const item = repairItem(sim, robot, gridId);
  if (!item || !consumeAmmo(sim, gridId, item)) return 0;
  return speciesOf(sim, robot)?.mechanical?.hpPerItem ?? 0;
}
