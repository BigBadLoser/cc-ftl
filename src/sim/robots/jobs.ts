import { ammoCount, consumeAmmo } from '../combat/ammo';
import { shipOf } from '../combat/ships';
import { skillOf } from '../combat/operators';
import { AssignmentC, CarriedC, DeadC, DraftedC, HealthC, JobC, PositionC, type Job, type Position } from '../crew/components';
import { origin } from '../crew/helpers';
import type { WorkResult } from '../crew/jobWork';
import { AllegianceC } from '../fight/components';
import { spillItems } from '../items/stacks';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { MEND_PER_SEC, SALVAGE_SEC, SKILL_STEP } from '../tuning';
import { HackedC, WreckC } from './components';
import { speciesOf } from './core';

type NewJob = Partial<Job> & Pick<Job, 'category' | 'kind' | 'gridId' | 'x' | 'y'>;

/** The first of a mechanical body's repair items the grid's storage holds, or null. */
function mendItem(sim: Sim, gridId: number, crew: number): string | null {
  for (const item of speciesOf(sim, crew)?.mechanical?.items ?? []) if (ammoCount(sim, gridId, item) > 0) return item;
  return null;
}

/** True while a robot still needs mending on the job's grid and its ship has the parts. */
function mendWanted(sim: Sim, robot: number, gridId: number): boolean {
  const hp = sim.world.get(robot, HealthC);
  const pos = sim.world.get(robot, PositionC);
  return !!hp && !!pos && pos.gridId === gridId && hp.hp < hp.max && !sim.world.has(robot, DeadC)
    && !!speciesOf(sim, robot)?.mechanical && mendItem(sim, gridId, robot) !== null;
}

/**
 * Keep or drop a robot job (autojobs). null = not a robot job. mend follows its robot; salvage lasts while the wreck
 * does; hack lasts while its (drafted, standing-by) hacker still holds it and the core is not hacked yet.
 */
export function keepRobotJob(sim: Sim, jobId: number, job: Job): boolean | null {
  const target = job.target ?? 0;
  if (job.kind === 'mend') {
    if (!mendWanted(sim, target, job.gridId)) return false;
    const o = origin(sim.world.get(target, PositionC) as Position);
    job.x = o.x;
    job.y = o.y;
    return true;
  }
  if (job.kind === 'assemble') return (sim.world.get(target, ModuleC)?.hp ?? 0) > 0;
  if (job.kind === 'salvage') return sim.world.has(target, WreckC) && !sim.world.has(target, CarriedC);
  if (job.kind === 'hack') {
    const by = job.reservedBy;
    const ok = sim.world.has(target, ModuleC) && !sim.world.get(target, HackedC)?.hacker && by !== 0
      && sim.world.get(by, AssignmentC)?.jobId === jobId && sim.world.get(by, DraftedC)?.target === null;
    return ok;
  }
  return null;
}

/** New robot jobs (autojobs): mend damaged robots whose ship has parts, salvage wrecks on player ships. */
export function robotJobs(sim: Sim, seen: Set<string>, add: (job: NewJob) => void): void {
  for (const id of sim.world.query(HealthC, PositionC)) {
    const pos = sim.world.get(id, PositionC);
    if (!pos || seen.has(`mend:${id}`) || !mendWanted(sim, id, pos.gridId)) continue;
    const o = origin(pos);
    add({ category: 'repair', kind: 'mend', gridId: pos.gridId, x: o.x, y: o.y, target: id });
  }
  for (const id of sim.world.query(WreckC, PositionC)) {
    const pos = sim.world.get(id, PositionC);
    if (!pos || seen.has(`salvage:${id}`) || shipOf(sim, pos.gridId)?.faction !== 'player') continue;
    add({ category: 'hauling', kind: 'salvage', gridId: pos.gridId, x: pos.x, y: pos.y, target: id, work: SALVAGE_SEC * TICK_HZ });
  }
}

/** True while a crew mender has taken the mend job for this robot: it holds still so they can reach it. */
export function heldForMend(sim: Sim, robot: number): boolean {
  return sim.world.query(JobC).some((j) => {
    const job = sim.world.get(j, JobC);
    return job?.kind === 'mend' && job.target === robot && job.reservedBy !== 0;
  });
}

/** May this crew member take this robot job? Mending needs the repair skill and a robot of their own side; hacks are only ever ordered. */
export function canTakeRobotJob(sim: Sim, crew: number, job: Job): boolean {
  if (job.kind === 'hack') return false;
  if (job.kind !== 'mend') return true;
  const mine = sim.world.get(crew, AllegianceC)?.faction;
  return skillOf(sim, crew, 'repair') > 0 && mine === sim.world.get(job.target ?? 0, AllegianceC)?.faction;
}

/**
 * Mend: `progress` holds hp already paid for; when it runs out one repair item is taken from the ship's storage
 * (worth `hpPerItem`). Restores MEND_PER_SEC x workSpeed x (1 + SKILL_STEP x repair) hp per second.
 */
export function performMend(sim: Sim, crew: number, job: Job, speed: number): WorkResult {
  const robot = job.target ?? 0;
  const hp = sim.world.get(robot, HealthC);
  const mech = speciesOf(sim, robot)?.mechanical;
  if (!hp || !mech || sim.world.has(robot, DeadC) || hp.hp >= hp.max) return 'done';
  if (job.progress <= 0) {
    const item = mendItem(sim, job.gridId, robot);
    if (!item || !consumeAmmo(sim, job.gridId, item)) return 'wait';
    job.progress += mech.hpPerItem;
  }
  const rate = (MEND_PER_SEC * speed * (1 + SKILL_STEP * skillOf(sim, crew, 'repair'))) / TICK_HZ;
  const amount = Math.min(job.progress, hp.max - hp.hp, rate);
  hp.hp += amount;
  job.progress -= amount;
  return hp.hp >= hp.max ? 'done' : 'working';
}

/** Salvage: after `work` ticks the wreck comes apart into its species' wreck items, dropped where it lay. */
export function performSalvage(sim: Sim, job: Job, speed: number): WorkResult {
  const wreck = job.target ?? 0;
  const pos = sim.world.get(wreck, PositionC);
  if (!pos || !sim.world.has(wreck, WreckC)) return 'done';
  job.progress = Math.min(job.work, job.progress + speed);
  if (job.progress < job.work) return 'working';
  for (const q of speciesOf(sim, wreck)?.wreck ?? []) spillItems(sim, pos.gridId, pos.x, pos.y, q.item, q.count);
  sim.events.emit({ type: 'robot.salvaged', crew: wreck, gridId: pos.gridId, x: pos.x, y: pos.y });
  sim.world.destroyEntity(wreck);
  return 'done';
}

/** Hack: progress at workSpeed x (1 + SKILL_STEP x (hacking - 1)); when complete the core is hacked for the hacker's side. */
export function performHack(sim: Sim, crew: number, job: Job, speed: number): WorkResult {
  const core = job.target ?? 0;
  const m = sim.world.get(core, ModuleC);
  if (!m || sim.world.get(core, HackedC)?.hacker) return 'done';
  job.progress = Math.min(job.work, job.progress + speed * (1 + SKILL_STEP * Math.max(0, skillOf(sim, crew, 'hacking') - 1)));
  if (job.progress < job.work) return 'working';
  const by = sim.world.get(crew, AllegianceC)?.faction ?? 'player';
  sim.world.add(core, HackedC, { by, tick: sim.tick, hacker: crew });
  sim.events.emit({ type: 'core.hacked', moduleId: core, gridId: m.gridId, by });
  return 'done';
}
