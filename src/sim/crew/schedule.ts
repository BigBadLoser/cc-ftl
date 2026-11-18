import { CrewC } from './components';
import { DAY_HOURS, hourAt, ticksToHour } from '../clock';
import { defineComponent } from '../ecs';
import { crewKind } from '../ai/crewKind';
import type { ScheduleBlock, ScheduleDef } from '../ai/types';
import { personOf } from './bonds';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';

/**
 * Crew schedules (#412, docs/DESIGN.md "Schedules"): the plan. Which block a crew member's plan sets, and how long until they are off duty
 * (away planning). Being on call and the block in force (`onCall`, `blockNow`, `holdsSleep`) are crew/onCall.ts; when a sleeper gets up is
 * crew/wake.ts. They are apart so the plan doesn't import the job scheduler that `onCall` asks (#553).
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
 * Seconds until the crew member's Sleep block next starts (away planning, #412: only Sleep limits a trip, Free does not): 0 while their plan
 * has them in Sleep now (being on call does not change that, #553), Infinity with no Sleep in their plan.
 */
export function secToSleep(sim: Sim, id: number): number {
  const hours = hoursOf(sim, id);
  if (!hours) return Infinity;
  if (blockAt(sim, id) === 'sleep') return 0; // the plan, not `blockNow`: on call during a planned Sleep hour still counts as Sleep for trip planning (#553)
  const now = hourAt(sim.tick);
  for (let k = 1; k < DAY_HOURS; k++) if (hours[(now + k) % DAY_HOURS] === 'sleep') return ticksToHour(sim.tick, k) / TICK_HZ;
  return Infinity;
}

