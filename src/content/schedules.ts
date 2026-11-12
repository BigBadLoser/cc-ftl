import type { ScheduleBlock, ScheduleDef } from '../sim';

/**
 * Crew schedule presets (#412, docs/DESIGN.md "Schedules"): 24 hour blocks, hour 0 first. The presets marked `rotation` (Default and Late, in
 * this order) are what crew of the player's side follow in turn by hire order until the player gives them a row of their own
 * (`crew.schedule.set`, `.preset`, `.copy`): half the crew is up while the other half sleeps.
 */

/** A day from runs of blocks: `[block, fromHour, toHour)` pairs over `fill`; a run may wrap past midnight. */
function day(fill: ScheduleBlock, ...runs: [ScheduleBlock, number, number][]): ScheduleBlock[] {
  const hours: ScheduleBlock[] = Array.from({ length: 24 }, () => fill);
  for (const [block, from, to] of runs) for (let h = from; h !== to; h = (h + 1) % 24) hours[h] = block;
  return hours;
}

export const schedules = {
  /** About 16 hours awake: work from 06:00, two free hours in the evening, bed at 22:00. */
  'schedule.default': { id: 'schedule.default', name: 'Default', rotation: true, hours: day('work', ['free', 20, 22], ['sleep', 22, 6]) },
  /** Bed 06:00-14:00 like the Default eight hours later, but the two free hours sit at 18:00-20:00 (a new game starts at 14:00 on Work), so Work covers 20:00-06:00 and the Default's sleep hours. With the Default, someone is always on Work. */
  'schedule.late': { id: 'schedule.late', name: 'Late', rotation: true, hours: day('work', ['free', 18, 20], ['sleep', 6, 14]) },
  'schedule.day': { id: 'schedule.day', name: 'Day shift', hours: day('work', ['free', 18, 22], ['sleep', 22, 6]) },
  'schedule.night': { id: 'schedule.night', name: 'Night shift', hours: day('work', ['free', 6, 10], ['sleep', 10, 18]) },
  /** No plan: needs decide every hour, as before schedules. */
  'schedule.any': { id: 'schedule.any', name: 'Any', hours: day('any') },
} satisfies Record<string, ScheduleDef>;
