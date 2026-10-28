import { describe, expect, it } from 'vitest';

import { stampShip } from '../combat/ships';
import { AllegianceC } from '../fight/components';
import type { SimEvent } from '../events';
import { ModuleC } from '../modules/components';
import { shipGrid } from '../regions';
import type { ContentRegistry, ModuleDef, ShipTemplate } from '../registry';
import { spawnTemplateModules } from '../ship';
import { Sim } from '../sim';
import { Struct } from '../structure';
import { CREW_MAX_HP } from '../tuning';
import {
  AssignmentC, CrewC, DamageOrderC, DraftedC, HealthC, JobC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities,
} from './components';

const mod = (o: Partial<ModuleDef>): ModuleDef => ({
  name: 'm', asset: 'm', footprint: [1, 1], solid: false, power: 0, flammability: 0.1, maxHp: 100, buildWork: 20, ...o,
});
const content: ContentRegistry = {
  ships: {},
  roles: {},
  species: { 'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6 } },
  modules: { crate: mod({ maxHp: 60 }), shields: mod({ console: 'shields' }), helm: mod({ console: 'helm' }) },
  crewNames: [],
  items: {},
  recipes: {},
  structCosts: {},
};
// A 7x3 room (x 2..8, y 2..4) in a sealed hull.
const rows = ['...........', '.#########.', '.#_______#.', '.#_______#.', '.#_______#.', '.#########.', '...........'];

function make(mods: { def: string; x: number; y: number }[] = []): Sim {
  const sim = new Sim(5, content);
  const t: ShipTemplate = { name: 't', rows };
  stampShip(sim, t, { faction: 'player', state: 'active', x: 0, y: 0 });
  spawnTemplateModules(sim, 1, { ...t, modules: mods.map((m) => ({ ...m, rot: 0 })) });
  return sim;
}
const prio = (v: number): Priorities => ({
  firefighting: v, medical: v, operating: v, repair: v, construction: v, hauling: v, refining: v, crafting: v, research: v, cooking: v, patrol: v,
});
/** A crew member with every work priority off, so only an order can send them anywhere. */
function crew(sim: Sim, x: number, y: number, p = prio(0)): number {
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
const roomOf = (sim: Sim) => shipGrid(sim, 1)!.get('room', 5, 3);
const jobOf = (sim: Sim, id: number) => sim.world.get(sim.world.get(id, AssignmentC)?.jobId ?? 0, JobC);
const rejections = (sim: Sim): string[] => sim.events.drain().filter((e: SimEvent) => e.type === 'command.rejected').map((e) => (e as { reason: string }).reason);

describe('damage control', () => {
  it('fight fire sends the nearest able crew member, whatever their priorities, and the fire goes out', () => {
    const sim = make();
    const far = crew(sim, 2, 4);
    const near = crew(sim, 7, 4);
    run(sim, 1);
    sim.enqueue({ type: 'debug.ignite', ship: 1, x: 8, y: 2 });
    run(sim, 2);
    sim.enqueue({ type: 'damage.fightFire', ship: 1, room: roomOf(sim) });
    run(sim, 2);
    expect(jobOf(sim, near)?.kind).toBe('extinguish');
    expect(sim.world.has(near, DamageOrderC)).toBe(true);
    expect(sim.world.has(far, AssignmentC)).toBe(false);
    run(sim, secs(40));
    expect(burning(sim)).toBe(0);
    // Done: the order is over and they are free again.
    expect(sim.world.has(near, DamageOrderC)).toBe(false);
    expect(sim.world.has(near, AssignmentC)).toBe(false);
  });

  it('goes on to the next burning tile until the room is out', () => {
    const sim = make();
    const c = crew(sim, 7, 4);
    sim.enqueue({ type: 'debug.ignite', ship: 1, x: 8, y: 2 });
    sim.enqueue({ type: 'debug.ignite', ship: 1, x: 3, y: 2 });
    run(sim, 2);
    sim.enqueue({ type: 'damage.fightFire', ship: 1, room: roomOf(sim) });
    run(sim, secs(60));
    expect(burning(sim)).toBe(0);
    expect(sim.world.has(c, DamageOrderC)).toBe(false);
  });

  it('takes a free crew member before a console operator, and a helm operator only as the last option', () => {
    const sim = make([{ def: 'shields', x: 3, y: 3 }, { def: 'helm', x: 4, y: 3 }]);
    const [shields, helm] = sim.world.query(ModuleC);
    const post = (module: number, who: number, x: number, y: number) => {
      const j = sim.world.createEntity();
      sim.world.add(j, JobC, { category: 'operating', kind: 'operate', x, y, struct: 0, work: 1, progress: 0, reservedBy: who, target: module });
      sim.world.add(who, AssignmentC, { jobId: j });
      return j;
    };
    const opShield = crew(sim, 3, 4);
    const opHelm = crew(sim, 4, 4);
    const free = crew(sim, 2, 2);
    post(shields as number, opShield, 3, 4);
    post(helm as number, opHelm, 4, 4);
    run(sim, 1, true);
    sim.enqueue({ type: 'debug.ignite', ship: 1, x: 5, y: 2 });
    run(sim, 2, true);
    sim.enqueue({ type: 'damage.fightFire', ship: 1, room: roomOf(sim) });
    run(sim, 2, true);
    expect(sim.world.has(free, DamageOrderC)).toBe(true);
    expect(sim.world.has(opShield, DamageOrderC)).toBe(false);
    expect(sim.world.has(opHelm, DamageOrderC)).toBe(false);
  });

  it('pulls a shield operator when nobody else can go, and sends them back to the console after', () => {
    const sim = make([{ def: 'shields', x: 3, y: 3 }]);
    const shields = sim.world.query(ModuleC)[0] as number;
    const op = crew(sim, 3, 4);
    const j = sim.world.createEntity();
    sim.world.add(j, JobC, { category: 'operating', kind: 'operate', x: 3, y: 4, struct: 0, work: 1, progress: 0, reservedBy: op, target: shields });
    sim.world.add(op, AssignmentC, { jobId: j });
    run(sim, 1, true);
    sim.enqueue({ type: 'debug.ignite', ship: 1, x: 7, y: 2 });
    run(sim, 2, true);
    sim.enqueue({ type: 'damage.fightFire', ship: 1, room: roomOf(sim) });
    run(sim, 2, true);
    expect(jobOf(sim, op)?.kind).toBe('extinguish');
    expect(sim.world.get(j, JobC)?.reservedBy).toBe(op); // the console stays theirs while they are away
    run(sim, secs(40), true);
    expect(burning(sim)).toBe(0);
    expect(jobOf(sim, op)?.kind).toBe('operate');
    const p = sim.world.get(op, PositionC)!;
    expect([p.x, p.y]).toEqual([3, 4]);
  });

  it('seals a breach with a wall built by the nearest crew member', () => {
    const sim = make();
    const near = crew(sim, 2, 3);
    const far = crew(sim, 8, 3);
    sim.enqueue({ type: 'debug.setStruct', ship: 1, x: 1, y: 3, kind: Struct.Space });
    run(sim, 2);
    sim.enqueue({ type: 'damage.sealBreach', ship: 1, room: roomOf(sim) });
    run(sim, 2);
    expect(jobOf(sim, near)?.kind).toBe('build');
    expect(sim.world.has(far, AssignmentC)).toBe(false);
    run(sim, secs(20));
    expect(shipGrid(sim, 1)!.get('struct', 1, 3)).toBe(Struct.Wall);
    expect(sim.world.has(near, DamageOrderC)).toBe(false);
  });

  it('repairs a damaged module on order', () => {
    const sim = make([{ def: 'crate', x: 8, y: 4 }]);
    const m = sim.world.query(ModuleC)[0] as number;
    sim.world.get(m, ModuleC)!.hp = 10;
    const c = crew(sim, 2, 2);
    run(sim, 2);
    sim.enqueue({ type: 'damage.repair', module: m });
    run(sim, 2);
    expect(jobOf(sim, c)?.kind).toBe('repair');
    run(sim, secs(60));
    expect(sim.world.get(m, ModuleC)!.hp).toBe(60);
    expect(sim.world.has(c, DamageOrderC)).toBe(false);
  });

  it('puts a priority-repair module at the top of the queue, and clears the flag when it is mended', () => {
    const sim = make([{ def: 'crate', x: 3, y: 2 }, { def: 'crate', x: 8, y: 4 }]);
    const [near, farMod] = sim.world.query(ModuleC) as number[];
    sim.world.get(near as number, ModuleC)!.hp = 10;
    sim.world.get(farMod as number, ModuleC)!.hp = 10;
    const c = crew(sim, 3, 3, { ...prio(0), repair: 1 });
    run(sim, 2);
    // Without a priority, the close one is repaired first.
    expect(jobOf(sim, c)?.target).toBe(near);
    sim.enqueue({ type: 'module.priorityRepair', id: farMod as number, on: true });
    const c2 = crew(sim, 3, 3, { ...prio(0), repair: 1 });
    run(sim, 2);
    expect(sim.world.get(farMod as number, ModuleC)!.repairFirst).toBe(1);
    expect(jobOf(sim, c2)?.target).toBe(farMod);
    run(sim, secs(60));
    expect(sim.world.get(farMod as number, ModuleC)!.hp).toBe(60);
    expect(sim.world.get(farMod as number, ModuleC)!.repairFirst).toBeUndefined();
  });

  it('refuses when nobody is able, or there is nothing to do', () => {
    const sim = make([{ def: 'crate', x: 8, y: 4 }]);
    const m = sim.world.query(ModuleC)[0] as number;
    const c = crew(sim, 4, 3);
    sim.world.add(c, DraftedC, { target: null }); // the player's own, hands off
    sim.world.get(m, ModuleC)!.hp = 10;
    sim.enqueue({ type: 'debug.ignite', ship: 1, x: 8, y: 2 });
    run(sim, 2);
    sim.events.drain();
    sim.enqueue({ type: 'damage.fightFire', ship: 1, room: roomOf(sim) });
    sim.enqueue({ type: 'damage.repair', module: m });
    run(sim, 1);
    expect(rejections(sim)).toEqual(['noAbleCrew', 'noAbleCrew']);
    sim.world.get(m, ModuleC)!.hp = 60;
    sim.enqueue({ type: 'damage.repair', module: m });
    sim.enqueue({ type: 'damage.sealBreach', ship: 1, room: roomOf(sim) });
    run(sim, 1);
    expect(rejections(sim)).toEqual(['notDamaged', 'noBreach']);
    expect(sim.world.has(c, DamageOrderC)).toBe(false);
  });

  it('ends the order and frees the console when the crew member is drafted away', () => {
    const sim = make();
    const c = crew(sim, 6, 4);
    sim.enqueue({ type: 'debug.ignite', ship: 1, x: 8, y: 2 });
    run(sim, 2);
    sim.enqueue({ type: 'damage.fightFire', ship: 1, room: roomOf(sim) });
    run(sim, 2);
    expect(sim.world.has(c, DamageOrderC)).toBe(true);
    sim.enqueue({ type: 'crew.draft', id: c, drafted: true });
    run(sim, 2);
    expect(sim.world.has(c, DamageOrderC)).toBe(false);
    expect(sim.world.has(c, AssignmentC)).toBe(false);
  });
});
