import { describe, expect, it } from 'vitest';
import {
  CrewC, DownedC, EatC, HealthC, ModuleC, MoodC, NeedsC, StorageC, TICK_HZ, deserialize, newGame, serialize, stat, totalStock,
  type Sim, type SimEvent, shipEntityOf
} from '../../sim';
import { MOOD_LOW_WORK_MULT, MOOD_VERY_LOW_WORK_MULT } from '../../sim/tuning';
import { content } from '../index';
import { PLAYER_START as P0 } from '../../sim/tuning'; // the player ship's sector top-left

const run = (sim: Sim, n: number) => { for (let i = 0; i < n; i++) sim.step(); };
const humans = (sim: Sim): number[] => sim.world.query(CrewC).filter((id) => sim.world.get(id, CrewC)?.species === 'species.human');
const find = (sim: Sim, def: string): number => sim.world.query(ModuleC).find((id) => sim.world.get(id, ModuleC)?.def === def) as number;
const needs = (sim: Sim, id: number) => sim.world.get(id, NeedsC)!;
/** Remove every ration from storage and switch the galley off so none are printed. */
function emptyLarder(sim: Sim): void {
  (sim.world.get(find(sim, 'module.galley'), ModuleC) as { enabled: boolean }).enabled = false;
  for (const id of sim.world.query(StorageC)) {
    const s = sim.world.get(id, StorageC);
    if (s) s.stacks = s.stacks.filter((st) => st.item !== 'item.ration');
  }
}
/** Starter ship with a single hungry crew member; the rest are fed and held out of the way by being very rested. */
function hungry(hunger: number): { sim: Sim; id: number } {
  const sim = newGame(3, content);
  run(sim, 5);
  for (const h of humans(sim)) needs(sim, h).hunger = 100;
  const id = humans(sim)[0] as number;
  needs(sim, id).hunger = hunger;
  return { sim, id };
}

describe('hunger', () => {
  it('decays at the species rate and starts every crew member part-fed', () => {
    const sim = newGame(3, content);
    run(sim, 2);
    const id = humans(sim)[0] as number;
    const start = needs(sim, id).hunger as number;
    expect(start).toBeGreaterThanOrEqual(70);
    expect(start).toBeLessThanOrEqual(100);
    run(sim, 10 * TICK_HZ);
    expect(start - (needs(sim, id).hunger as number)).toBeCloseTo(0.12 * 10, 1);
  });

  it('a hungry crew member goes to the galley, eats a ration and is fed', () => {
    const { sim, id } = hungry(20);
    const events: SimEvent[] = [];
    const before = totalStock(sim, 'item.ration');
    for (let i = 0; i < 40 * TICK_HZ && !events.some((e) => e.type === 'crew.ate'); i++) {
      sim.step();
      events.push(...sim.events.drain());
    }
    const ate = events.find((e) => e.type === 'crew.ate');
    expect(ate).toMatchObject({ crew: id, item: 'item.ration', galley: true });
    expect(needs(sim, id).hunger as number).toBeGreaterThan(60);
    expect(totalStock(sim, 'item.ration')).toBe(before - 1);
    expect(sim.world.has(id, EatC)).toBe(false);
  });

  it('eats from a crate when there is no working galley', () => {
    const { sim, id } = hungry(20);
    (sim.world.get(find(sim, 'module.galley'), ModuleC) as { enabled: boolean }).enabled = false;
    const events: SimEvent[] = [];
    for (let i = 0; i < 60 * TICK_HZ && !events.some((e) => e.type === 'crew.ate'); i++) {
      sim.step();
      events.push(...sim.events.drain());
    }
    expect(events.find((e) => e.type === 'crew.ate')).toMatchObject({ crew: id, galley: false });
  });

  it('does not eat when it is not hungry, and does not walk off with no food', () => {
    const { sim, id } = hungry(80);
    run(sim, 20 * TICK_HZ);
    expect(sim.world.has(id, EatC)).toBe(false);
    const other = hungry(10);
    emptyLarder(other.sim);
    run(other.sim, 20 * TICK_HZ);
    expect(other.sim.world.has(other.id, EatC)).toBe(false);
  });

  it('starving hurts health slowly, and raises the alert once', () => {
    const { sim, id } = hungry(0.01);
    emptyLarder(sim);
    const hp0 = sim.world.get(id, HealthC)!.hp;
    const events: SimEvent[] = [];
    for (let i = 0; i < 100 * TICK_HZ; i++) {
      sim.step();
      events.push(...sim.events.drain());
    }
    expect(needs(sim, id).hunger).toBe(0);
    const lost = hp0 - sim.world.get(id, HealthC)!.hp;
    expect(lost).toBeGreaterThan(3);
    expect(lost).toBeLessThan(8);
    expect(events.filter((e) => e.type === 'crew.starving')).toHaveLength(1);
    expect(sim.world.has(id, DownedC)).toBe(false);
  });

  it('keeps the starter crew fed for ten minutes of normal play', { timeout: 120000 }, () => {
    const sim = newGame(5, content);
    let starving = 0;
    for (let i = 0; i < 10 * 60 * TICK_HZ; i++) {
      sim.step();
      if (i % TICK_HZ === 0) for (const h of humans(sim)) if ((needs(sim, h).hunger ?? 1) <= 0) starving++;
    }
    expect(starving).toBe(0);
    for (const h of humans(sim)) expect(needs(sim, h).hunger as number).toBeGreaterThan(5);
    expect(totalStock(sim, 'item.ration')).toBeGreaterThanOrEqual(8); // the galley's keep order refills the larder
  });
});

describe('mood', () => {
  it('is built from named factors and hunger lowers it', () => {
    const { sim, id } = hungry(100);
    run(sim, 3 * TICK_HZ);
    const fed = { ...sim.world.get(id, MoodC)! };
    expect(fed.factors.map((f) => f.key)).toContain('wellFed');
    emptyLarder(sim);
    needs(sim, id).hunger = 10;
    run(sim, 2 * TICK_HZ);
    const sad = sim.world.get(id, MoodC)!;
    expect(sad.factors.find((f) => f.key === 'hungry')?.value).toBe(-10);
    expect(sad.value).toBeLessThan(fed.value);
    expect(sad.value).toBe(Math.round(50 + sad.factors.reduce((n, f) => n + f.value, 0)));
  });

  it('remembers a hot meal and a night in a bed or on the floor', () => {
    const { sim, id } = hungry(100);
    run(sim, 2 * TICK_HZ);
    const m = sim.world.get(id, MoodC)!;
    m.meal = 100;
    m.sleep = 100;
    m.bed = -1;
    run(sim, TICK_HZ);
    expect(m.factors.map((f) => f.key)).toEqual(expect.arrayContaining(['hotMeal', 'floor']));
    m.bed = 1;
    run(sim, TICK_HZ);
    expect(m.factors.map((f) => f.key)).toContain('bed');
  });

  it('gets lonely when nobody is near for a while', () => {
    const { sim, id } = hungry(100);
    run(sim, 2 * TICK_HZ);
    const m = sim.world.get(id, MoodC)!;
    expect(m.factors.map((f) => f.key)).toContain('company'); // the starter crew is close together
    for (const h of humans(sim)) if (h !== id) sim.world.get(h, CrewC)!.species = 'species.robot'; // nobody with a mood is left near
    run(sim, 3 * TICK_HZ);
    m.alone = 500;
    run(sim, TICK_HZ);
    expect(m.factors.map((f) => f.key)).toContain('lonely');
  });

  it('slows work when low, more when very low', () => {
    const { sim, id } = hungry(100);
    run(sim, 2 * TICK_HZ);
    const base = stat(sim, id, 'workSpeed');
    const m = sim.world.get(id, MoodC)!;
    m.value = 30;
    expect(stat(sim, id, 'workSpeed')).toBeCloseTo(base * MOOD_LOW_WORK_MULT);
    m.value = 10;
    expect(stat(sim, id, 'workSpeed')).toBeCloseTo(base * MOOD_VERY_LOW_WORK_MULT);
    m.value = 80;
    expect(stat(sim, id, 'workSpeed')).toBeCloseTo(base);
  });

  it('raises moodLow once when mood falls very low', () => {
    const { sim, id } = hungry(0.01);
    emptyLarder(sim);
    needs(sim, id).rest = 5;
    const events: SimEvent[] = [];
    for (let i = 0; i < 30 * TICK_HZ; i++) {
      sim.step();
      events.push(...sim.events.drain());
    }
    expect(events.filter((e) => e.type === 'crew.moodLow' && e.crew === id)).toHaveLength(1);
  });
});

describe('robots and determinism', () => {
  it('robots neither get hungry nor have moods', () => {
    const sim = newGame(3, content);
    sim.enqueue({ type: 'debug.spawnCrew', ship: shipEntityOf(sim, 1), x: P0.x + 9, y: P0.y + 9, role: 'role.robot_worker' });
    run(sim, 30 * TICK_HZ);
    const robot = sim.world.query(CrewC).find((id) => sim.world.get(id, CrewC)?.species === 'species.robot') as number;
    expect(robot).toBeDefined();
    expect(needs(sim, robot).hunger).toBeUndefined();
    expect(sim.world.has(robot, MoodC)).toBe(false);
    expect(sim.world.has(robot, EatC)).toBe(false);
  });

  it('is deterministic and survives a save round trip mid-meal', { timeout: 60000 }, () => {
    const make = () => {
      const { sim, id } = hungry(30);
      return { sim, id };
    };
    const a = make().sim;
    run(a, 6 * TICK_HZ);
    const mid = deserialize(serialize(a), content);
    run(a, 1500);
    run(mid, 1500);
    const b = make().sim;
    run(b, 6 * TICK_HZ + 1500);
    expect(serialize(a)).toBe(serialize(b));
    expect(serialize(mid)).toBe(serialize(a));
  });
});
