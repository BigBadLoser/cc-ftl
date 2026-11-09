import { AssignmentC, CrewC, JobC, NeedsC, PositionC, PrioritiesC, type Job, type WorkCategory } from './components';
import { DAY_HOURS, hourAt, ticksToHour } from '../clock';
import { defineComponent } from '../ecs';
import { isEmergency } from '../ai/emergency';
import { crewKind } from '../ai/utility';
import type { ScheduleBlock } from '../ai/types';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { FREE_WAKE_REST } from '../tuning';

/**
 * Crew schedules (#412, docs/DESIGN.md "Schedules"): the one owner of every schedule question. Which block a crew member is in, when they
 * are on call (the schedule suspended), how long until they are off duty (away planning), and when a sleeper stays in bed or gets up.
 * The utility engine reads `blockNow` and applies each drive's `blocks` rule (content/policies.ts).
 */

/** A crew member's own day plan: 24 blocks, hour 0 first. Absent: they follow `DEFAULT_SCHEDULE` (player colonists) or none. */
export const ScheduleC = defineComponent<{ hours: ScheduleBlock[] }>('schedule');

/** The preset crew of the player's side follow until given a row of their own. */
export const DEFAULT_SCHEDULE = 'schedule.default';
export const SCHEDULE_BLOCKS: readonly ScheduleBlock[] = ['any', 'work', 'sleep', 'free'];

/** An off-duty block: no jobs (Sleep, Free). */
export const offDuty = (b: ScheduleBlock): boolean => b === 'sleep' || b === 'free';

/** The crew member's 24 blocks: their own row, else the Default preset for the player's colonists, else none (no schedule: always Any). */
export function hoursOf(sim: Sim, id: number): readonly ScheduleBlock[] | undefined {
  const own = sim.world.get(id, ScheduleC)?.hours;
  if (own) return own;
  const preset = sim.content.schedules?.[DEFAULT_SCHEDULE];
  return preset && sim.world.has(id, CrewC) && crewKind(sim, id) === 'colonist' ? preset.hours : undefined;
}

/** The block the crew member's plan sets at a tick (default now), before any override. */
export function blockAt(sim: Sim, id: number, tick = sim.tick): ScheduleBlock {
  return hoursOf(sim, id)?.[hourAt(tick)] ?? 'any';
}

/**
 * Per tick: the work categories of open emergency jobs (taken or not: the fire still burns) and untaken console jobs on each ship (what calls
 * crew off a schedule).
 */
const calls = new WeakMap<Sim, { tick: number; byShip: Map<number, Set<WorkCategory>> }>();

function callsOn(sim: Sim, ship: number): Set<WorkCategory> | undefined {
  let c = calls.get(sim);
  if (!c || c.tick !== sim.tick) {
    c = { tick: sim.tick, byShip: new Map() };
    for (const jid of sim.world.query(JobC)) {
      const j = sim.world.get(jid, JobC) as Job;
      if (!isEmergency(j) && !(j.kind === 'operate' && j.reservedBy === 0)) continue;
      const s = shipIdOf(sim, j);
      let set = c.byShip.get(s);
      if (!set) c.byShip.set(s, (set = new Set()));
      set.add(j.category);
    }
    calls.set(sim, c);
  }
  return c.byShip.get(ship);
}

/**
 * True while the schedule is suspended for the crew member (DESIGN "Overrides"): a fight or Battle Stations, a console or emergency job they hold,
 * an open emergency (a fire, a breach, a downed crew member, taken or not) or an untaken console job on their ship in a category they work at all. Reachability is not asked:
 * the scheduler decides who goes; the others are up and at work meanwhile.
 */
export function onCall(sim: Sim, id: number): boolean {
  if (sim.sector.inCombat || sim.sector.stations) return true;
  const held = sim.world.get(sim.world.get(id, AssignmentC)?.jobId ?? 0, JobC);
  if (held && (held.kind === 'operate' || isEmergency(held))) return true; // a console or an emergency they hold keeps them on it
  const pos = sim.world.get(id, PositionC);
  const cats = pos && callsOn(sim, shipIdOf(sim, pos));
  if (!cats) return false;
  const prio = sim.world.get(id, PrioritiesC);
  for (const cat of cats) if ((prio?.[cat] ?? 0) >= 1) return true;
  return false;
}

/** The block in force for the crew member now: their plan's, except that an off-duty block reads as Work while they are on call. */
export function blockNow(sim: Sim, id: number): ScheduleBlock {
  const b = blockAt(sim, id);
  return offDuty(b) && onCall(sim, id) ? 'work' : b;
}

/** Seconds until the crew member's plan next puts them off duty (Sleep or Free): 0 while it does now, Infinity with no such block. */
export function secToOffDuty(sim: Sim, id: number): number {
  const hours = hoursOf(sim, id);
  if (!hours) return Infinity;
  if (offDuty(blockNow(sim, id))) return 0;
  const now = hourAt(sim.tick);
  for (let k = 1; k < DAY_HOURS; k++) if (offDuty(hours[(now + k) % DAY_HOURS] ?? 'any')) return ticksToHour(sim.tick, k) / TICK_HZ;
  return Infinity;
}

/** True if a sleeper stays in bed even at full rest: their Sleep block is in force. */
export const holdsSleep = (sim: Sim, id: number): boolean => blockNow(sim, id) === 'sleep';

/**
 * True if a sleeper with a plan gets up now (ONI rule): once rest is at least FREE_WAKE_REST, when their block is Free or they are on call.
 * Into Work or Any they sleep on until full, as the needs system has it; below the line they would only drop back to the need line.
 */
export function wakesFromSleep(sim: Sim, id: number): boolean {
  if ((sim.world.get(id, NeedsC)?.rest ?? 0) < FREE_WAKE_REST) return false;
  const b = blockAt(sim, id);
  return b === 'free' || (b !== 'any' && onCall(sim, id));
}
