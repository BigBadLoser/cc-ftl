import { TICK_HZ } from './time';
import { CLOCK_START_HOUR, GAME_HOUR_SEC } from './tuning';

/**
 * The ship clock (#412, docs/DESIGN.md "Schedules"): a 24-hour day read from the sim tick, so it is in every save. One game hour is
 * GAME_HOUR_SEC real seconds at 1x; tick 0 is CLOCK_START_HOUR on day 1.
 */

export const DAY_HOURS = 24;
/** Ticks in one game hour. */
export const HOUR_TICKS = GAME_HOUR_SEC * TICK_HZ;
/** Ticks in one game day. */
export const DAY_TICKS = HOUR_TICKS * DAY_HOURS;

/** Game ticks since midnight of day 1 at this sim tick. */
const clockTicks = (tick: number): number => tick + CLOCK_START_HOUR * HOUR_TICKS;

/** The hour of the day (0..23) at a sim tick. */
export const hourAt = (tick: number): number => Math.floor(clockTicks(tick) / HOUR_TICKS) % DAY_HOURS;

/** The ship clock at a sim tick: day (from 1), hour (0..23) and minute (0..59). */
export function clockAt(tick: number): { day: number; hour: number; minute: number } {
  const t = clockTicks(tick);
  return { day: Math.floor(t / DAY_TICKS) + 1, hour: hourAt(tick), minute: Math.floor(((t % HOUR_TICKS) * 60) / HOUR_TICKS) };
}

/** Ticks from `tick` until the start of hour `hour + k` (k = 1: the next hour; k hours ahead in general). */
export const ticksToHour = (tick: number, k: number): number => k * HOUR_TICKS - (clockTicks(tick) % HOUR_TICKS);
