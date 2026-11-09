import { describe, expect, it } from 'vitest';
import { AssignmentC, CrewC, JobC, ModuleC, NeedsC, PositionC, homeShip, newGame, type Sim } from '../sim';
import { HOUR_TICKS, hourAt } from '../sim/clock';
import { ScheduleC, blockAt, blockNow, hoursOf, onCall, secToOffDuty } from '../sim/crew/schedule';
import { staySec } from '../sim/away/crew';
import { shipGrid, shipIdOf } from '../sim/regions';
import { Struct } from '../sim/structure';
import { TICK_HZ } from '../sim/time';
import { CLOCK_START_HOUR } from '../sim/tuning';
import { inBed } from '../sim/ai/machines/sleep';
import { SuitC } from '../sim/eva/components';
import { content } from './index';
import { schedules } from './schedules';

/** Crew schedules (#412, docs/DESIGN.md "Schedules"): presets, block lookup, the commands and the drives each block moves. */

const run = (sim: Sim, ticks: number): void => {
  for (let i = 0; i < ticks; i++) sim.step();
};
/** The starter ship's crew who follow a schedule (people, not robots). */
const people = (sim: Sim): number[] => sim.world.query(CrewC).filter((id) => hoursOf(sim, id) !== undefined);
const fresh = (seed = 3): Sim => newGame(seed, content, 'ship.starter', false);
/** Every hour of every crew member's day set to one block. */
const allDay = (sim: Sim, ids: number[], block: 'any' | 'work' | 'sleep' | 'free'): void => {
  for (const id of ids) sim.enqueue({ type: 'crew.schedule.set', id, from: 0, to: 23, block });
};

describe('schedule presets', () => {
  it('every preset has 24 blocks; the Default keeps about 16 waking hours with some Free time', () => {
    for (const p of Object.values(schedules)) expect(p.hours).toHaveLength(24);
    const d = schedules['schedule.default'].hours;
    expect(d.filter((b) => b === 'sleep')).toHaveLength(8);
    expect(d.filter((b) => b === 'free').length).toBeGreaterThan(0);
    expect(d[CLOCK_START_HOUR]).toBe('work'); // a new game starts in working hours
  });
});

describe('block lookup and commands', () => {
  it('player crew follow the Default until given a row; robots and station crew have none', () => {
    const sim = fresh();
    const ids = people(sim);
    expect(ids.length).toBeGreaterThan(1);
    for (const id of ids) expect(hoursOf(sim, id)).toEqual(schedules['schedule.default'].hours);
    expect(blockAt(sim, ids[0]!)).toBe('work');
    expect(blockAt(sim, ids[0]!, (22 - CLOCK_START_HOUR) * HOUR_TICKS)).toBe('sleep');
    expect(blockAt(sim, ids[0]!, (20 - CLOCK_START_HOUR) * HOUR_TICKS)).toBe('free');
  });

  it('set (one hour, a wrapping range), preset and copy write the crew member own row', () => {
    const sim = fresh();
    const [a, b] = people(sim) as [number, number];
    sim.enqueue({ type: 'crew.schedule.set', id: a, from: 23, to: 1, block: 'free' });
    sim.enqueue({ type: 'crew.schedule.set', id: a, from: 12, block: 'any' });
    sim.applyCommands();
    const h = sim.world.get(a, ScheduleC)!.hours;
    expect([h[22], h[23], h[0], h[1], h[2], h[12], h[13]]).toEqual(['sleep', 'free', 'free', 'free', 'sleep', 'any', 'work']);
    sim.enqueue({ type: 'crew.schedule.copy', id: b, from: a });
    sim.applyCommands();
    expect(sim.world.get(b, ScheduleC)!.hours).toEqual(h);
    expect(sim.world.get(b, ScheduleC)!.hours).not.toBe(h);
    sim.enqueue({ type: 'crew.schedule.preset', id: a, preset: 'schedule.night' });
    sim.enqueue({ type: 'crew.schedule.preset', id: a, preset: 'schedule.nope' });
    sim.enqueue({ type: 'crew.schedule.set', id: a, from: 24, block: 'work' });
    sim.applyCommands();
    expect(sim.world.get(a, ScheduleC)!.hours).toEqual(schedules['schedule.night'].hours);
    const rejected = sim.events.drain().filter((e) => e.type === 'command.rejected').map((e) => (e as { reason: string }).reason);
    expect(rejected).toEqual(['badPreset', 'badHour']);
  });

  it('time to off duty counts to the next Sleep or Free block, 0 inside one; the away stay plans around it', () => {
    const sim = fresh();
    const id = people(sim)[0]!;
    const n = sim.world.get(id, NeedsC)!;
    n.rest = 100;
    n.hunger = 100;
    expect(secToOffDuty(sim, id)).toBe(((20 - CLOCK_START_HOUR) * HOUR_TICKS) / TICK_HZ);
    sim.enqueue({ type: 'crew.schedule.set', id, from: hourAt(sim.tick) + 1, block: 'sleep' });
    sim.applyCommands();
    expect(secToOffDuty(sim, id)).toBe(HOUR_TICKS / TICK_HZ);
    expect(staySec(sim, id)).toBe(HOUR_TICKS / TICK_HZ); // under AWAY_GO_STAY_SEC: no passage now
    sim.enqueue({ type: 'crew.schedule.set', id, from: hourAt(sim.tick), block: 'free' });
    sim.applyCommands();
    expect(secToOffDuty(sim, id)).toBe(0);
    sim.enqueue({ type: 'crew.schedule.preset', id, preset: 'schedule.any' });
    sim.applyCommands();
    expect(secToOffDuty(sim, id)).toBe(Infinity);
  });
});

describe('blocks in play', () => {
  it('crew go to bed in a Sleep block, stay there at full rest, and get up for Work', () => {
    const sim = fresh();
    const ids = people(sim);
    allDay(sim, ids, 'sleep');
    run(sim, 60 * TICK_HZ);
    for (const id of ids) expect(sim.world.get(id, CrewC)?.activity).toBe('sleeping');
    expect(ids.filter((id) => inBed(sim, id))).toEqual(ids); // the starter has a bunk for everyone
    for (const id of ids) sim.world.get(id, NeedsC)!.rest = 100;
    run(sim, 2 * TICK_HZ);
    for (const id of ids) expect(sim.world.get(id, CrewC)?.activity).toBe('sleeping'); // held in bed by the block
    allDay(sim, ids, 'work');
    run(sim, 2 * TICK_HZ);
    for (const id of ids) expect(sim.world.get(id, CrewC)?.activity).not.toBe('sleeping');
  });

  it('an unrested sleeper sleeps on into Work but gets up into Free once rest is at least 50', () => {
    const sim = fresh();
    const [a, b] = people(sim) as [number, number];
    allDay(sim, [a, b], 'sleep');
    run(sim, 60 * TICK_HZ);
    expect(sim.world.get(a, CrewC)?.activity).toBe('sleeping');
    expect(sim.world.get(b, CrewC)?.activity).toBe('sleeping');
    sim.world.get(a, NeedsC)!.rest = 60;
    sim.world.get(b, NeedsC)!.rest = 60;
    sim.enqueue({ type: 'crew.schedule.set', id: a, from: 0, to: 23, block: 'work' });
    sim.enqueue({ type: 'crew.schedule.set', id: b, from: 0, to: 23, block: 'free' });
    run(sim, 2 * TICK_HZ);
    expect(sim.world.get(a, CrewC)?.activity).toBe('sleeping');
    expect(sim.world.get(b, CrewC)?.activity).not.toBe('sleeping');
  });

  it('Free crew take no jobs and drop the one they hold; Work crew take them', () => {
    const sim = fresh();
    const ids = people(sim);
    for (const id of ids) sim.world.get(id, NeedsC)!.hunger = 100;
    allDay(sim, ids, 'free');
    const ship = homeShip(sim);
    const m = sim.world.query(ModuleC).find((id) => shipIdOf(sim, sim.world.get(id, ModuleC)!) === ship && sim.content.modules[sim.world.get(id, ModuleC)!.def]?.bed)!;
    sim.world.get(m, ModuleC)!.hp = 1; // a repair job for an engineer
    run(sim, 30 * TICK_HZ);
    expect(ids.some((id) => sim.world.has(id, AssignmentC))).toBe(false);
    allDay(sim, ids, 'work');
    run(sim, 10 * TICK_HZ);
    expect(ids.some((id) => sim.world.get(sim.world.get(id, AssignmentC)?.jobId ?? 0, JobC)?.kind === 'repair')).toBe(true);
  });

  it('a crew member whose block turns Free mid-job lets the job go before the break', () => {
    const sim = fresh();
    const ids = people(sim);
    for (const id of ids) {
      sim.world.get(id, NeedsC)!.hunger = 100;
      sim.world.get(id, NeedsC)!.rest = 100;
    }
    allDay(sim, ids, 'work');
    const ship = homeShip(sim);
    const m = sim.world.query(ModuleC).find((id) => shipIdOf(sim, sim.world.get(id, ModuleC)!) === ship && sim.content.modules[sim.world.get(id, ModuleC)!.def]?.bed)!;
    sim.world.get(m, ModuleC)!.hp = 1;
    const repairing = (): number | undefined =>
      ids.find((id) => sim.world.get(id, CrewC)?.activity === 'working' && sim.world.get(sim.world.get(id, AssignmentC)?.jobId ?? 0, JobC)?.kind === 'repair');
    for (let i = 0; i < 60 * TICK_HZ && repairing() === undefined; i++) sim.step();
    const worker = repairing()!;
    expect(worker).toBeDefined(); // settled at the job, at work on it
    const job = sim.world.get(worker, AssignmentC)!.jobId;
    sim.world.get(job, JobC)!.work = 1e6; // the repair outlasts the test
    while ((sim.tick + worker) % 20 !== 0) sim.step(); // the turn a break is looked for (leisure LOOK_EVERY): it starts at once
    allDay(sim, ids, 'free');
    run(sim, 2 * TICK_HZ);
    expect(sim.world.has(worker, AssignmentC)).toBe(false);
    expect(sim.world.get(job, JobC)?.reservedBy ?? 0).toBe(0);
  });

  it('a suited crew member in Free still stows the suit', () => {
    const sim = fresh();
    const ids = people(sim);
    const c = ids[0]!;
    for (const id of ids) {
      sim.world.get(id, NeedsC)!.hunger = 100;
      sim.world.get(id, NeedsC)!.rest = 100;
    }
    allDay(sim, ids, 'free');
    sim.enqueue({ type: 'suit.set', crew: c, worn: true });
    run(sim, 2);
    expect(sim.world.has(c, SuitC)).toBe(true);
    run(sim, 60 * TICK_HZ);
    expect(sim.world.has(c, SuitC)).toBe(false);
  });

  it('a fire calls a scheduled sleeper out of bed; one asleep from exhaustion sleeps on', () => {
    const sim = fresh();
    const ids = people(sim);
    const [a, b] = ids as [number, number];
    allDay(sim, ids, 'sleep');
    run(sim, 60 * TICK_HZ);
    expect(sim.world.get(a, CrewC)?.activity).toBe('sleeping');
    expect(sim.world.get(b, CrewC)?.activity).toBe('sleeping');
    for (const id of ids) sim.world.get(id, NeedsC)!.rest = 30; // tired but over the need line (20): an emergency still gets them up
    sim.world.get(b, NeedsC)!.rest = 10;
    const ship = homeShip(sim);
    const grid = shipGrid(sim, ship)!;
    const at = sim.world.get(a, PositionC)!;
    let fire: { x: number; y: number } | undefined;
    for (let d = 3; d < 12 && !fire; d++) for (const [x, y] of [[at.x + d, at.y], [at.x - d, at.y], [at.x, at.y + d], [at.x, at.y - d]] as [number, number][]) {
      if (!fire && grid.inBounds(x, y) && grid.get('struct', x, y) === Struct.Floor) fire = { x, y };
    }
    sim.enqueue({ type: 'debug.ignite', ship, ...fire! });
    run(sim, 3 * TICK_HZ);
    expect(onCall(sim, a)).toBe(true);
    expect(blockNow(sim, a)).toBe('work');
    expect(sim.world.get(a, CrewC)?.activity).not.toBe('sleeping');
    expect(sim.world.get(b, CrewC)?.activity).toBe('sleeping');
  });

  it('Battle Stations suspends every schedule', () => {
    const sim = fresh();
    const ids = people(sim);
    allDay(sim, ids, 'sleep');
    run(sim, 60 * TICK_HZ);
    for (const id of ids) sim.world.get(id, NeedsC)!.rest = 90;
    sim.enqueue({ type: 'combat.battleStations', on: true });
    run(sim, 2 * TICK_HZ);
    for (const id of ids) {
      expect(blockNow(sim, id)).toBe('work');
      expect(sim.world.get(id, CrewC)?.activity).not.toBe('sleeping');
    }
  });
});
