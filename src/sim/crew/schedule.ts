import { CrewC, JobC, NeedsC, PositionC, PrioritiesC, type Job, type WorkCategory } from './components';
import { DAY_HOURS, hourAt, ticksToHour } from '../clock';
import { defineComponent } from '../ecs';
import { isEmergency } from '../ai/emergency';
import { admitLevel } from '../ai/jobRank';
import { workJobOf } from '../ai/task';
import { crewKind, policyOf } from '../ai/utility';
import type { ScheduleBlock, ScheduleDef } from '../ai/types';
import { personOf } from './bonds';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { FREE_WAKE_REST } from '../tuning';

/**
 * Crew schedules (#412, docs/DESIGN.md "Schedules"): the one owner of every schedule question. Which block a crew member is in, when they
 * are on call (the schedule suspended), how long until they are off duty (away planning), and when a sleeper stays in bed or gets up.
 * The utility engine reads `blockNow` and applies each drive's `blocks` rule (content/policies.ts).
 */

/** A crew member's own day plan: 24 blocks, hour 0 first. Absent: they follow a rotation preset (player colonists, `hoursOf`) or none. */
export const ScheduleC = defineComponent<{ hours: ScheduleBlock[] }>('schedule');

export const SCHEDULE_BLOCKS: readonly ScheduleBlock[] = ['any', 'work', 'sleep', 'free'];

/** An off-duty block: no jobs (Sleep, Free). */
export const offDuty = (b: ScheduleBlock): boolean => b === 'sleep' || b === 'free';

/** The rotation presets (`ScheduleDef.rotation`) in content order, per content registry. */
const rotations = new WeakMap<object, ScheduleDef[]>();
function rotation(sim: Sim): ScheduleDef[] {
  const all = sim.content.schedules;
  if (!all) return [];
  let r = rotations.get(all);
  if (!r) rotations.set(all, (r = Object.values(all).filter((p) => p.rotation)));
  return r;
}

/**
 * The crew member's 24 blocks: their own row, else for the player's colonists a rotation preset taken in turn by hire order (their person id,
 * allocated as they join: Default, Late, Default...), else none (no schedule: always Any).
 */
export function hoursOf(sim: Sim, id: number): readonly ScheduleBlock[] | undefined {
  const own = sim.world.get(id, ScheduleC)?.hours;
  if (own) return own;
  const presets = rotation(sim);
  if (!presets.length || !sim.world.has(id, CrewC) || crewKind(sim, id) !== 'colonist') return undefined;
  return presets[Math.max(0, personOf(sim, id) - 1) % presets.length]?.hours;
}

/** The block the crew member's plan sets at a tick (default now), before any override. */
export function blockAt(sim: Sim, id: number, tick = sim.tick): ScheduleBlock {
  return hoursOf(sim, id)?.[hourAt(tick)] ?? 'any';
}

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

/** The block in force for the crew member now: their plan's, except that an off-duty block reads as Work while they are on call. */
export function blockNow(sim: Sim, id: number): ScheduleBlock {
  const b = blockAt(sim, id);
  return offDuty(b) && onCall(sim, id) ? 'work' : b;
}

/**
 * Seconds until the crew member's Sleep block next starts (away planning, #412: only Sleep limits a trip, Free does not): 0 while it is in
 * force now, Infinity with no Sleep in their plan.
 */
export function secToSleep(sim: Sim, id: number): number {
  const hours = hoursOf(sim, id);
  if (!hours) return Infinity;
  if (blockNow(sim, id) === 'sleep') return 0;
  const now = hourAt(sim.tick);
  for (let k = 1; k < DAY_HOURS; k++) if (hours[(now + k) % DAY_HOURS] === 'sleep') return ticksToHour(sim.tick, k) / TICK_HZ;
  return Infinity;
}

/** True if a sleeper stays in bed even at full rest: their Sleep block is in force. */
export const holdsSleep = (sim: Sim, id: number): boolean => blockNow(sim, id) === 'sleep';

/**
 * True if a sleeper with a plan gets up now. On call (an emergency, a fight) they get up unless exhausted (rest under the sleep drive's need
 * line, `sleepLine`: they sleep on, as before schedules). Into Free (ONI rule) they get up once rest is at least FREE_WAKE_REST; into Work
 * or Any they sleep on until full, as the needs system has it.
 */
export function wakesFromSleep(sim: Sim, id: number): boolean {
  const rest = sim.world.get(id, NeedsC)?.rest ?? 0;
  const b = blockAt(sim, id);
  if (b === 'any') return false;
  if (b === 'free' && rest >= FREE_WAKE_REST) return true;
  return rest >= sleepLine(sim, id) && onCall(sim, id);
}

/** The rest under which the crew member's sleep drive wants them asleep whatever the hour (its entry line; 0 with no such drive). */
function sleepLine(sim: Sim, id: number): number {
  const enter = policyOf(sim, id).drives.find((d) => d.task === 'sleep')?.enter;
  return enter === undefined ? 0 : enter / 10; // drive inputs read in tenths
}
