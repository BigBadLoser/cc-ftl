import { describe, expect, it } from 'vitest';

import { stampShip } from '../combat/ships';
import { AllegianceC } from '../fight/components';
import { ModuleC } from '../modules/components';
import { shipGrid } from '../regions';
import type { ContentRegistry, ModuleDef, ShipTemplate } from '../registry';
import { spawnTemplateModules } from '../ship';
import { Sim } from '../sim';
import { Struct } from '../structure';
import { CREW_MAX_HP } from '../tuning';
import {
  AssignmentC, CrewC, HealthC, JobC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities,
} from './components';

const mod = (o: Partial<ModuleDef>): ModuleDef => ({
  name: 'm', asset: 'm', footprint: [1, 1], solid: false, power: 0, flammability: 0.1, maxHp: 100, buildWork: 20, ...o,
});
const content: ContentRegistry = {
  ships: {},
  roles: {},
  species: { 'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6 } },
  modules: { crate: mod({ maxHp: 60 }), helm: mod({ console: 'helm' }), gun: mod({ console: 'weapons' }), lamp: mod({ maxHp: 30 }) },
  crewNames: [],
  items: {},
  recipes: {},
  structCosts: {},
};
// A 7x3 room (x 2..8, y 2..4) in a sealed hull.
const rows = ['...........', '.#########.', '.#_______#.', '.#_______#.', '.#_______#.', '.#########.', '...........'];

function make(mods: { def: string; x: number; y: number }[] = [], c: ContentRegistry = content): Sim {
  const sim = new Sim(5, c);
  const t: ShipTemplate = { name: 't', rows };
  stampShip(sim, t, { faction: 'player', state: 'active', x: 0, y: 0 });
  spawnTemplateModules(sim, 1, { ...t, modules: mods.map((m) => ({ ...m, rot: 0 })) });
  return sim;
}
/** Damage control at 1 (the role default), everything else off: only the emergency can send this crew member anywhere. */
const dc = (extra: Partial<Priorities> = {}): Priorities => ({
  firefighting: 1, medical: 0, operating: 0, repair: 0, construction: 0, hauling: 0, refining: 0, crafting: 0, research: 0, cooking: 0, patrol: 0, ...extra,
});
function crew(sim: Sim, x: number, y: number, p: Priorities = dc()): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'r', species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { x, y, toX: x, toY: y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, p);
  sim.world.add(id, NeedsC, { rest: 100 });
  sim.world.add(id, HealthC, { hp: CREW_MAX_HP, max: CREW_MAX_HP });
  sim.world.add(id, AllegianceC, { faction: 'player' });
  return id;
}
const run = (sim: Sim, n: number, combat = false) => { for (let i = 0; i < n; i++) { if (combat) sim.sector.inCombat = true; sim.step(); } };
const secs = (s: number) => s * 20;
const burning = (sim: Sim) => shipGrid(sim, 1)!.load('fire').filter((f) => f > 0).length;
const jobOf = (sim: Sim, id: number) => sim.world.get(sim.world.get(id, AssignmentC)?.jobId ?? 0, JobC);
const rejections = (sim: Sim): string[] => sim.events.drain().flatMap((e) => (e.type === 'command.rejected' ? [e.reason] : []));

describe('automatic damage control', () => {
  it('free crew put a fire out on their own, with no order', () => {
    const sim = make();
    const far = crew(sim, 2, 4);
    const near = crew(sim, 7, 4);
    sim.enqueue({ type: 'debug.ignite', ship: 1, x: 8, y: 2 });
    run(sim, 6);
    expect([near, far].some((c) => jobOf(sim, c)?.kind === 'extinguish')).toBe(true);
    run(sim, secs(40));
    expect(burning(sim)).toBe(0);
  });

  it('seals a hull breach with a wall, the nearest crew member building it', () => {
    const sim = make();
    const near = crew(sim, 2, 3);
    const far = crew(sim, 8, 3);
    sim.enqueue({ type: 'debug.setStruct', ship: 1, x: 1, y: 3, kind: Struct.Space });
    run(sim, 15);
    const job = jobOf(sim, near);
    expect(job?.kind).toBe('build');
    expect(job?.category).toBe('firefighting');
    expect(sim.world.has(far, AssignmentC)).toBe(false);
    run(sim, secs(20));
    expect(shipGrid(sim, 1)!.get('struct', 1, 3)).toBe(Struct.Wall);
    expect(sim.world.query(JobC)).toHaveLength(0);
  });

  it('posts no seal job while the stock cannot pay for a wall', () => {
    const sim = make([], { ...content, structCosts: { wall: [{ item: 'item.metal', count: 2 }] } });
    crew(sim, 2, 3);
    sim.enqueue({ type: 'debug.setStruct', ship: 1, x: 1, y: 3, kind: Struct.Space });
    run(sim, 30);
    expect(sim.world.query(JobC)).toHaveLength(0);
  });

  it('answers only when the damage-control priority is on (the player can lower it)', () => {
    const sim = make();
    const c = crew(sim, 7, 4, dc({ firefighting: 0 }));
    sim.enqueue({ type: 'debug.ignite', ship: 1, x: 8, y: 2 });
    run(sim, 10);
    expect(sim.world.has(c, AssignmentC)).toBe(false);
  });

  it('does not take a console operator off the helm for a fire', () => {
    const sim = make([{ def: 'helm', x: 3, y: 3 }]);
    const helm = sim.world.query(ModuleC)[0] as number;
    const op = crew(sim, 3, 4);
    const j = sim.world.createEntity();
    sim.world.add(j, JobC, { category: 'operating', kind: 'operate', x: 3, y: 4, struct: 0, work: 1, progress: 0, reservedBy: op, target: helm });
    sim.world.add(op, AssignmentC, { jobId: j });
    run(sim, 1, true);
    sim.enqueue({ type: 'debug.ignite', ship: 1, x: 7, y: 2 });
    run(sim, 20, true);
    expect(sim.world.get(op, AssignmentC)?.jobId).toBe(j);
  });
});

describe('priority repair', () => {
  it('puts a module at the top of the repair queue, and clears the flag when it is mended', () => {
    const sim = make([{ def: 'crate', x: 3, y: 2 }, { def: 'crate', x: 8, y: 4 }]);
    const [near, farMod] = sim.world.query(ModuleC) as number[];
    sim.world.get(near as number, ModuleC)!.hp = 10;
    sim.world.get(farMod as number, ModuleC)!.hp = 10;
    const c = crew(sim, 3, 3, dc({ repair: 1 }));
    run(sim, 2);
    expect(jobOf(sim, c)?.target).toBe(near); // without a priority, the close one first
    sim.enqueue({ type: 'module.priorityRepair', id: farMod as number, on: true });
    const c2 = crew(sim, 3, 3, dc({ repair: 1 }));
    run(sim, 2);
    expect(sim.world.get(farMod as number, ModuleC)!.repairFirst).toBe(1);
    expect(jobOf(sim, c2)?.target).toBe(farMod);
    run(sim, secs(60));
    expect(sim.world.get(farMod as number, ModuleC)!.hp).toBe(60);
    expect(sim.world.get(farMod as number, ModuleC)!.repairFirst).toBeUndefined();
  });

  it('refuses a module that is not damaged, and can be taken off again', () => {
    const sim = make([{ def: 'crate', x: 8, y: 4 }]);
    const m = sim.world.query(ModuleC)[0] as number;
    sim.enqueue({ type: 'module.priorityRepair', id: m, on: true });
    run(sim, 1);
    expect(rejections(sim)).toEqual(['notDamaged']);
    sim.world.get(m, ModuleC)!.hp = 10;
    sim.enqueue({ type: 'module.priorityRepair', id: m, on: true });
    run(sim, 1);
    expect(sim.world.get(m, ModuleC)!.repairFirst).toBe(1);
    sim.enqueue({ type: 'module.priorityRepair', id: m, on: false });
    run(sim, 1);
    expect(sim.world.get(m, ModuleC)!.repairFirst).toBeUndefined();
  });
});

describe('combat repair triage', () => {
  /** A weapons console wrecked at the far end and a damaged lamp right beside the crew member. */
  function setup(): { sim: Sim; gun: number; lamp: number; c: number } {
    const sim = make([{ def: 'gun', x: 8, y: 4 }, { def: 'lamp', x: 3, y: 2 }]);
    const [gun, lamp] = sim.world.query(ModuleC) as number[];
    sim.world.get(gun as number, ModuleC)!.hp = 0;
    sim.world.get(lamp as number, ModuleC)!.hp = 5;
    return { sim, gun: gun as number, lamp: lamp as number, c: crew(sim, 3, 3, dc({ repair: 1 })) };
  }

  it('in combat a destroyed weapons console is repaired before a damaged lamp that is closer', () => {
    const { sim, gun, c } = setup();
    run(sim, 4, true);
    expect(jobOf(sim, c)?.target).toBe(gun);
  });

  it('outside combat the old order holds: the closer lamp first', () => {
    const { sim, lamp, c } = setup();
    run(sim, 4);
    expect(jobOf(sim, c)?.target).toBe(lamp);
  });

  it('a manual priority repair beats the combat triage', () => {
    const { sim, lamp, c } = setup();
    sim.enqueue({ type: 'module.priorityRepair', id: lamp, on: true });
    run(sim, 4, true);
    expect(jobOf(sim, c)?.target).toBe(lamp);
  });
});

describe('emergencies call busy crew off lower-ranked jobs', () => {
  it('a fire pulls a crew member off a repair they rank below damage control', () => {
    const sim = make([{ def: 'crate', x: 8, y: 4 }]);
    const m = sim.world.query(ModuleC)[0] as number;
    sim.world.get(m, ModuleC)!.hp = 1;
    const c = crew(sim, 7, 3, dc({ repair: 2 }));
    run(sim, 4);
    expect(jobOf(sim, c)?.kind).toBe('repair');
    sim.enqueue({ type: 'debug.ignite', ship: 1, x: 3, y: 2 });
    run(sim, 40);
    expect(jobOf(sim, c)?.kind).toBe('extinguish');
  });

  it('but not a job they rank the same or higher', () => {
    const sim = make([{ def: 'crate', x: 8, y: 4 }]);
    const m = sim.world.query(ModuleC)[0] as number;
    sim.world.get(m, ModuleC)!.hp = 1;
    const c = crew(sim, 7, 3, dc({ repair: 1 }));
    run(sim, 4);
    sim.enqueue({ type: 'debug.ignite', ship: 1, x: 3, y: 2 });
    run(sim, 40);
    expect(jobOf(sim, c)?.kind).toBe('repair');
  });
});
