import { describe, expect, it } from 'vitest';
import { DAY_TICKS, HOUR_TICKS, clockAt, hourAt, ticksToHour } from './clock';
import { TICK_HZ } from './time';
import { CLOCK_START_HOUR, GAME_HOUR_SEC } from './tuning';

describe('ship clock', () => {
  it('a game hour is GAME_HOUR_SEC at 1x and a day is 24 of them', () => {
    expect(HOUR_TICKS).toBe(GAME_HOUR_SEC * TICK_HZ);
    expect(DAY_TICKS).toBe(24 * HOUR_TICKS);
    expect(HOUR_TICKS).toBe(800); // 40 s at 20 ticks a second: a day is 16 real minutes
  });

  it('starts on day 1 at CLOCK_START_HOUR and wraps at midnight', () => {
    expect(clockAt(0)).toEqual({ day: 1, hour: CLOCK_START_HOUR, minute: 0 });
    expect(clockAt(HOUR_TICKS / 2)).toEqual({ day: 1, hour: CLOCK_START_HOUR, minute: 30 });
    const midnight = (24 - CLOCK_START_HOUR) * HOUR_TICKS;
    expect(clockAt(midnight - 1)).toMatchObject({ day: 1, hour: 23, minute: 59 });
    expect(clockAt(midnight)).toEqual({ day: 2, hour: 0, minute: 0 });
    expect(hourAt(midnight + DAY_TICKS + 5 * HOUR_TICKS)).toBe(5);
  });

  it('counts the ticks to a later hour from inside the current one', () => {
    expect(ticksToHour(0, 1)).toBe(HOUR_TICKS);
    expect(ticksToHour(100, 1)).toBe(HOUR_TICKS - 100);
    expect(ticksToHour(100, 3)).toBe(3 * HOUR_TICKS - 100);
    expect(hourAt(100 + ticksToHour(100, 3))).toBe(CLOCK_START_HOUR + 3);
  });
});
