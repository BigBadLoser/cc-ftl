import { AwayC } from '../away/components';
import { isEmergency } from '../ai/emergency';
import { admitLevel } from '../ai/jobRank';
import { workJobOf } from '../ai/task';
import type { ScheduleBlock } from '../ai/types';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { JobC, PositionC, PrioritiesC, type Job, type WorkCategory } from './components';
import { blockAt, offDuty } from './schedule';

/** When a crew member's schedule is suspended (on call), and the block in force (crew/schedule.ts holds the plan; #412, #553). */

/**
 * Per tick, per ship, what calls crew off a schedule: the work categories of open emergency jobs (taken or not: the fire still burns) and
 * the untaken console jobs.
 */
interface Calls {
  emergencies: Set<WorkCategory>;
  consoles: Job[];
}
const calls = new WeakMap<Sim, { tick: number; byShip: Map<number, Calls> }>();

function callsOn(sim: Sim, ship: number): Calls | undefined {
  let c = calls.get(sim);
  if (!c || c.tick !== sim.tick) {
    c = { tick: sim.tick, byShip: new Map() };
    for (const jid of sim.world.query(JobC)) {
      const j = sim.world.get(jid, JobC) as Job;
      const emergency = isEmergency(j);
      if (!emergency && !(j.kind === 'operate' && j.reservedBy === 0)) continue;
      const s = shipIdOf(sim, j);
      let on = c.byShip.get(s);
      if (!on) c.byShip.set(s, (on = { emergencies: new Set(), consoles: [] }));
      if (emergency) on.emergencies.add(j.category);
      else on.consoles.push(j);
    }
    calls.set(sim, c);
  }
  return c.byShip.get(ship);
}

/**
 * True while the schedule is suspended for the crew member (DESIGN "Overrides"): a fight or Battle Stations, a console or emergency job they
 * hold, an open emergency (a fire, a breach, a downed crew member, taken or not) on their ship in a category they work at all, or an untaken
 * console there that they would take (the scheduler's own admission, `admitLevel`: a console at their operating level, not as a relief).
 * Reachability is not asked: the scheduler decides who goes; the others are up and at work meanwhile.
 */
export function onCall(sim: Sim, id: number): boolean {
  if (sim.sector.inCombat || sim.sector.stations) return true;
  const held = workJobOf(sim, id); // through a suit errand nested under it (Codex 4519693576)
  if (held && (held.kind === 'operate' || isEmergency(held))) return true; // a console or an emergency they hold keeps them on it
  const pos = sim.world.get(id, PositionC);
  const on = pos && callsOn(sim, shipIdOf(sim, pos));
  if (!on) return false;
  const prio = sim.world.get(id, PrioritiesC);
  if (!prio) return false;
  for (const cat of on.emergencies) if ((prio[cat] ?? 0) >= 1) return true;
  for (const job of on.consoles) {
    const level = prio[job.category] ?? 0;
    if (level >= 1 && admitLevel(sim, id, pos, prio, job, level)) return true;
  }
  return false;
}

/**
 * The block in force for the crew member now: their plan's, except that an off-duty block reads as Work while they are on call, and Free
 * reads as Work for a member of an away party (`onSite`: they work on there until a trip home leaves, user decision 2026-11-10; away/crew.ts
 * `awayReturn` asks with `onSite` false for their Free time).
 */
export function blockNow(sim: Sim, id: number, onSite = sim.world.has(id, AwayC)): ScheduleBlock {
  const b = blockAt(sim, id);
  if (offDuty(b) && onCall(sim, id)) return 'work';
  return b === 'free' && onSite ? 'work' : b;
}

/** True if a sleeper stays in bed even at full rest: their Sleep block is in force. */
export const holdsSleep = (sim: Sim, id: number): boolean => blockNow(sim, id) === 'sleep';
