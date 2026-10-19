import { describe, expect, it } from 'vitest';
import {
  CarriedC, CrewC, DeadC, DownedC, HealthC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities,
} from '../crew/components';
import type { SimEvent } from '../events';
import { ModuleC } from '../modules/components';
import type { ContentRegistry, ModuleDef } from '../registry';
import { gridFromTemplate, spawnTemplateModules } from '../ship';
import { Sim } from '../sim';
import { Struct } from '../structure';
import { BLEED_OUT_SECONDS, CREW_MAX_HP, GET_UP_HP } from '../tuning';

const mod = (o: Partial<ModuleDef>): ModuleDef => ({
  name: 'm', asset: 'm', footprint: [1, 1], solid: false, power: 0, flammability: 0.1, maxHp: 100, buildWork: 20, ...o,
});
const content: ContentRegistry = {
  ships: {},
  roles: {},
  species: { 'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6 } },
  modules: {
    reactor: mod({ footprint: [2, 2], solid: true, power: 20 }),
    light: mod({ power: -1, priority: 2, light: { radius: 8, level: 230 } }),
    bed: mod({ footprint: [1, 2], bed: true }),
  },
  crewNames: [],
  items: {},
  recipes: {},
  structCosts: {},
};
const all = (v: number): Priorities => ({
  firefighting: v, medical: v, operating: v, repair: v, construction: v, hauling: v, crafting: v, cooking: v,
});

// V (x 2-3) is a small room that gets breached; B (x 5-12) is the sick bay with the bed.
const rows = [
  '...............',
  '.#############.',
  '.#__#________#.',
  '.#__D________#.',
  '.#__#________#.',
  '.#############.',
  '...............',
];
const FLOW = [{ def: 'bed', x: 11, y: 2, rot: 0 }];

function make(modules = FLOW): Sim {
  const sim = new Sim(3, content);
  sim.grids.set(1, gridFromTemplate(1, { name: 't', rows }));
  spawnTemplateModules(sim, 1, { name: 't', rows, modules });
  return sim;
}
function crew(sim: Sim, x: number, y: number, p: Priorities): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'r', species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { gridId: 1, x, y, toX: x, toY: y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, { ...p });
  sim.world.add(id, NeedsC, { rest: 100 });
  sim.world.add(id, HealthC, { hp: CREW_MAX_HP, max: CREW_MAX_HP });
  return id;
}
const breach = (sim: Sim) => sim.enqueue({ type: 'debug.setStruct', gridId: 1, x: 1, y: 3, kind: Struct.Floor });

/** Step until `stop` holds (or `limit` ticks), collecting events with the tick they were emitted. */
function runUntil(sim: Sim, limit: number, stop: () => boolean): { type: string; tick: number }[] {
  const log: { type: string; tick: number }[] = [];
  for (let i = 0; i < limit && !stop(); i++) {
    sim.step();
    for (const e of sim.events.drain() as SimEvent[]) log.push({ type: e.type, tick: sim.tick });
  }
  return log;
}
const tickOf = (log: { type: string; tick: number }[], type: string) => log.find((e) => e.type === type)?.tick;

describe('downed crew', () => {
  it('go down in vacuum and, with nobody to rescue them, die when the timer runs out', () => {
    const sim = make([]);
    const victim = crew(sim, 2, 3, all(0));
    breach(sim);
    const log = runUntil(sim, 20 * 400, () => sim.world.has(victim, DeadC));
    const down = tickOf(log, 'crew.downed');
    const died = tickOf(log, 'crew.died');
    expect(down).toBeDefined();
    expect(down).toBeLessThan(20 * 60);
    expect((died as number) - (down as number)).toBeGreaterThanOrEqual(20 * BLEED_OUT_SECONDS - 2);
    expect((died as number) - (down as number)).toBeLessThanOrEqual(20 * BLEED_OUT_SECONDS + 2);
    // A corpse: crew data and a Dead marker, no AI.
    expect(sim.world.get(victim, CrewC)?.activity).toBe('dead');
    expect(sim.world.has(victim, DownedC)).toBe(false);
    expect(sim.world.has(victim, PrioritiesC)).toBe(false);
    expect(sim.world.has(victim, NeedsC)).toBe(false);
  });

  it('are carried to a free bed by a medic before they bleed out, then heal and get up', () => {
    const sim = make();
    const victim = crew(sim, 2, 3, all(0));
    const medic = crew(sim, 6, 3, { ...all(4), medical: 1 });
    sim.enqueue({ type: 'suit.set', crew: medic, worn: true }); // crew do not walk into vacuum bare: the medic goes in suited
    breach(sim);
    const bed = sim.world.query(ModuleC)[0] as number;
    let carried = false;
    let wasCarried = false;
    const log = runUntil(sim, 20 * 90, () => {
      const nowCarried = sim.world.has(victim, CarriedC);
      if (nowCarried && wasCarried) {
        carried = true;
        // From the tick after pickup the patient rides on the medic's tile.
        const v = sim.world.get(victim, PositionC)!;
        const m = sim.world.get(medic, PositionC)!;
        expect([v.x, v.y]).toEqual([m.x, m.y]);
      }
      wasCarried = nowCarried;
      return sim.world.get(victim, DownedC)?.stabilized === true;
    });
    expect(tickOf(log, 'crew.downed')).toBeDefined();
    expect(tickOf(log, 'crew.rescued')).toBeDefined();
    expect(carried).toBe(true);
    expect(log.some((e) => e.type === 'crew.died')).toBe(false);
    const pos = sim.world.get(victim, PositionC)!;
    expect([pos.x, pos.y]).toEqual([11, 2]);
    expect(sim.world.get(victim, DownedC)?.bed).toBe(bed);
    expect(sim.world.get(bed, ModuleC)?.reservedBy).toBe(victim);
    expect(sim.world.has(victim, CarriedC)).toBe(false);
    expect(sim.world.has(medic, DownedC)).toBe(false);

    // Stabilized: the bleed timer stops while they heal in bed.
    const bleed = sim.world.get(victim, DownedC)!.bleed;
    runUntil(sim, 100, () => false);
    expect(sim.world.get(victim, DownedC)!.bleed).toBe(bleed);
    runUntil(sim, 20 * 60, () => !sim.world.has(victim, DownedC));
    expect(sim.world.has(victim, DownedC)).toBe(false);
    expect(sim.world.get(victim, HealthC)!.hp).toBeGreaterThanOrEqual(GET_UP_HP);
    expect(sim.world.get(bed, ModuleC)?.reservedBy).toBe(0);
    expect(sim.world.get(victim, CrewC)?.activity).not.toBe('downed');
  });

  it('are not rescued when there is no free bed', () => {
    const sim = make([]);
    const victim = crew(sim, 2, 3, all(0));
    crew(sim, 6, 3, { ...all(4), medical: 1 });
    breach(sim);
    runUntil(sim, 20 * 200, () => sim.world.has(victim, DeadC));
    expect(sim.world.has(victim, DeadC)).toBe(true);
  });
});

describe('darkness', () => {
  const lit = [{ def: 'reactor', x: 11, y: 3, rot: 0 }, { def: 'light', x: 9, y: 4, rot: 0 }];

  function buildTicks(modules: typeof lit): number {
    const sim = make(modules);
    crew(sim, 8, 3, { ...all(4), construction: 1 });
    sim.enqueue({ type: 'job.build', gridId: 1, x: 8, y: 2, struct: Struct.Wall });
    let done = -1;
    for (let i = 0; i < 600 && done < 0; i++) {
      sim.step();
      if (sim.events.drain().some((e) => e.type === 'crew.jobDone')) done = sim.tick;
    }
    return done;
  }

  it('slows work: the same job takes longer in an unlit room', () => {
    const litTicks = buildTicks(lit);
    const darkTicks = buildTicks([]);
    expect(litTicks).toBeGreaterThan(0);
    expect(darkTicks).toBeGreaterThan(litTicks + 15);
  });
});
