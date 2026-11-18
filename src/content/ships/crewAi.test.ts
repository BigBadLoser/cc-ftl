import { describe, expect, it } from 'vitest';
import { IntentC, InterruptC, TaskC } from '../../sim/ai/components';
import { ShipC } from '../../sim/combat/components';
import { homeShip } from '../../sim/combat/shipQuery';
import { AssignmentC, CarriedC, CrewC, DownedC, DraftedC, HealthC, JobC, NeedsC, PositionC } from '../../sim/crew/components';
import { findPath } from '../../sim/crew/pathfind';
import type { SimEvent } from '../../sim/events';
import { CarryingC, ItemStackC, StorageC } from '../../sim/items/components';
import { storageCount } from '../../sim/items/storage';
import { ModuleC } from '../../sim/modules/components';
import { placementError, removeModule, spawnModule } from '../../sim/modules/spawn';
import { newGame } from '../../sim/newGame';
import { shipGrid } from '../../sim/regions';
import { deserialize, serialize } from '../../sim/save';
import type { Sim } from '../../sim/sim';
import { Struct } from '../../sim/structure';
import { auditReservations } from '../../sim/ai/audit';
import { deriveTask, mealOf } from '../../sim/ai/task';
import { killCrew } from '../../sim/crew/death';
import { explainCrew } from '../../sim/ai/explain';
import { destroyJob } from '../../sim/items/stacks';
import { policyOf } from '../../sim/ai/utility';
import { content } from '../index';
import { expectScriptedReplay, haulBoard, lcg } from '../../../test/support/fixtures/crewAi';

/**
 * Crew AI Phase 1 (docs/CREW_AI.md section 10) on real boards: the task mirror and reservations stay consistent through combat,
 * fire and boarding; the interrupt detector agrees with the legacy tests; a `finish`-class rescue is never dropped; items are
 * conserved through an abort storm; and runs replay exactly, with or without save/load points. The per-state save/load and
 * teardown tests are in `crewAiPhase1.slow.test.ts`.
 */

const run = (sim: Sim, n: number, each: () => void = () => {}): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
    each();
  }
  return out;
};

/** Every unit of an item on the board: in storage, on the floor, carried, delivered to jobs. */
function itemTotal(sim: Sim, item: string): number {
  let n = 0;
  for (const s of sim.world.query(StorageC)) n += storageCount(sim, s, item);
  for (const s of sim.world.query(ItemStackC)) if (sim.world.get(s, ItemStackC)!.item === item) n += sim.world.get(s, ItemStackC)!.count;
  for (const c of sim.world.query(CarryingC)) {
    const k = sim.world.get(c, CarryingC)!;
    if (k.item === item) n += k.count;
    for (const q of k.extra ?? []) if (q.item === item) n += q.count;
  }
  for (const j of sim.world.query(JobC)) for (const q of sim.world.get(j, JobC)!.delivered ?? []) if (q.item === item) n += q.count;
  return n;
}

describe('crew AI phase 1', () => {
  it('keeps the task mirror and every reservation consistent through combat, fire and boarding; the interrupt detector agrees with the legacy tests', () => {
    const sim = newGame(3, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raiderBoarder', x: 100, y: 50 });
    let checked = 0;
    let interrupts = 0;
    run(sim, 1500, () => {
      const r = auditReservations(sim);
      if (r.problems.length) throw new Error(`tick ${sim.tick}: ${r.problems.join('; ')}`);
      interrupts += sim.world.query(CrewC).filter((c) => sim.world.has(c, InterruptC)).length;
      checked++;
    });
    expect(checked).toBe(1500);
    expect(sim.aiLog.interruptMismatches).toBe(0);
    expect(interrupts).toBeGreaterThan(0); // the fight did hold crew out of the loop
    // Every crew member in the job loop has an intent from their kind's policy (content/policies.ts).
    const loop = sim.world.query(CrewC).filter((c) => sim.world.has(c, IntentC));
    expect(loop.length).toBeGreaterThan(3);
    expect(loop.every((c) => sim.world.get(c, IntentC)!.policy === policyOf(sim, c).id && policyOf(sim, c).id !== 'policy.none')).toBe(true);
  });

  it('finish class: a rescuer carrying a patient lays them in a bed before sleep, hunger or an emergency can pull them off', () => {
    const sim = newGame(1, content, 'ship.starter', false);
    run(sim, 2);
    const [patient] = sim.world.query(CrewC);
    sim.world.get(patient!, HealthC)!.hp = 0;
    let carrier = 0;
    const events = run(sim, 600, () => {
      const c = sim.world.get(patient!, CarriedC)?.carrier;
      if (c && !carrier) {
        carrier = c;
        expect(sim.world.get(c, TaskC)).toMatchObject({ machine: 'rescue', state: 'ToBed', class: 'finish' });
        // exhausted, starving and a fire next to them: none of it pulls them off
        sim.world.get(c, NeedsC)!.rest = 1;
        sim.world.get(c, NeedsC)!.hunger = 1;
        const p = sim.world.get(c, PositionC)!;
        sim.enqueue({ type: 'debug.ignite', ship: homeShip(sim), x: p.x, y: p.y });
      }
      if (carrier && sim.world.has(patient!, CarriedC)) expect(sim.world.get(carrier, AssignmentC), `tick ${sim.tick}`).toBeDefined();
    });
    expect(carrier).not.toBe(0);
    expect(events.filter((e) => e.type === 'crew.rescued')).toEqual([expect.objectContaining({ crew: patient, by: carrier })]);
  });

  it('a carrier who goes down leaves the patient where they are, and the rescue is posted again', () => {
    const sim = newGame(1, content, 'ship.starter', false);
    run(sim, 2);
    const [patient] = sim.world.query(CrewC);
    sim.world.get(patient!, HealthC)!.hp = 0;
    run(sim, 600, () => {
      const c = sim.world.get(patient!, CarriedC)?.carrier;
      if (c && sim.world.get(c, HealthC)!.hp > 0) sim.world.get(c, HealthC)!.hp = 0;
    });
    expect(sim.world.has(patient!, CarriedC)).toBe(false);
    expect(sim.world.query(JobC).some((j) => sim.world.get(j, JobC)!.kind === 'rescue' && sim.world.get(j, JobC)!.target === patient)
      || sim.world.get(patient!, DownedC)?.stabilized).toBe(true);
    expect(auditReservations(sim).problems).toEqual([]);
  });

  it('conserves items through an abort storm (drafts, undrafts and lost haul jobs while loads are on the move)', () => {
    const sim = haulBoard(2);
    const before = itemTotal(sim, 'item.metal');
    const next = lcg(7);
    let drafts = 0;
    let lost = 0;
    run(sim, 900, () => {
      if (sim.tick % 5 === 0) {
        const crew = sim.world.query(CrewC);
        const c = crew[Math.floor(next() * crew.length)]!;
        sim.enqueue({ type: 'crew.draft', id: c, drafted: !sim.world.has(c, DraftedC) });
        drafts++;
      }
      if (sim.tick % 37 === 0) {
        const hauls = sim.world.query(JobC).filter((j) => sim.world.get(j, JobC)!.kind === 'haul' && sim.world.get(j, JobC)!.reservedBy !== 0);
        if (hauls.length > 0) {
          destroyJob(sim, hauls[Math.floor(next() * hauls.length)]!);
          lost++;
        }
      }
      expect(itemTotal(sim, 'item.metal'), `tick ${sim.tick}`).toBe(before);
    });
    expect(drafts).toBeGreaterThan(100);
    expect(lost).toBeGreaterThan(3);
    expect(auditReservations(sim).problems).toEqual([]);
  });

  it('replays exactly: three runs give the same events and tick hashes, and random save/load points change nothing', () => {
    expectScriptedReplay(10); // the state hashed every 10 ticks here, every tick in crewAi.slow
  });

  it('the inspector shows each crew member\'s drive, task state path and holds', () => {
    const sim = haulBoard(2);
    run(sim, 30);
    const hauler = sim.world.query(CrewC).find((c) => sim.world.get(c, TaskC)?.machine === 'haul');
    expect(hauler).toBeDefined();
    const x = explainCrew(sim, hauler!);
    const job = sim.world.get(hauler!, AssignmentC)!.jobId;
    expect(x).toMatchObject({ policy: 'policy.colonist', drive: 'work', assignment: job, task: { job: { id: job, kind: 'haul' }, holds: [`job ${job}`] } });
    expect(x.task!.path).toMatch(/^haul\/(ToSource|ToDest|Deposit)$/);
    expect(x.scores).toMatchObject({ sleep: 0, eat: 0, work: 100 });
  });

  /**
   * Job tasks mirror `AssignmentC`, so a world whose job tasks were dropped (a sector cut, a ship stamped back from a packet:
   * `restoreTasks`) gets them back from it. The sleep and eat tasks are their own truth (Phase 3) and stay in the data. Every crew
   * member holding a job or in a need state must have their `Task` straight after the load and after a tick, whatever branch the
   * scheduler takes for them (an operator at a console, a sleeper, a robot charging, an eater, a hauler, a crew member suiting up).
   */
  it('loading a world whose job tasks were dropped derives every missing one', () => {
    // A busy starter: builds, hauls, an EVA wall on the hull ring, a hungry and a tired crew member, a robot with a flat battery.
    const sim = haulBoard(1);
    const ship = homeShip(sim);
    const s = sim.world.get(ship, ShipC)!;
    sim.enqueue({ type: 'debug.giveItems', item: 'item.metal', count: 300 });
    sim.enqueue({ type: 'job.build', ship, x: s.x + 3, y: s.y, struct: Struct.Wall });
    const g = shipGrid(sim, ship)!;
    const crew = sim.world.query(CrewC);
    const at = sim.world.get(crew[0]!, PositionC)!;
    let placed = false;
    for (let y = g.y0; y < g.y0 + g.height && !placed; y++) for (let x = g.x0; x < g.x0 + g.width && !placed; x++) {
      if (placementError(sim, ship, 'module.robotBay', x, y, 0) !== null) continue;
      const id = spawnModule(sim, 'module.robotBay', x, y, 0);
      if (findPath(sim, ship, { x: at.x, y: at.y }, { x, y })) placed = true;
      else removeModule(sim, id);
    }
    sim.enqueue({ type: 'debug.spawnCrew', ship, x: at.x, y: at.y, role: 'role.robot_worker' });
    run(sim, 1);
    sim.enqueue({ type: 'debug.setCharge', value: 5 });
    sim.world.get(crew[0]!, NeedsC)!.hunger = 5;
    sim.world.get(crew[1]!, NeedsC)!.rest = 5;
    // An operator: drafted and sent to man a console.
    const console = sim.world.query(ModuleC).find((m) => sim.content.modules[sim.world.get(m, ModuleC)!.def]?.console)!;
    sim.enqueue({ type: 'crew.draft', id: crew[2]!, drafted: true });
    run(sim, 1);
    sim.enqueue({ type: 'crew.man', id: crew[2]!, module: console });
    const want = new Set(['generic', 'sleep', 'charge', 'eat', 'haul', 'eva']);
    const seen = new Set<string>();
    let checks = 0;
    for (let i = 0; i < 1200 && checks < 12; i++) {
      run(sim, 1);
      const states = new Set(sim.world.query(TaskC).map((c) => sim.world.get(c, TaskC)!.machine));
      for (const m of states) seen.add(m);
      if (i % 100 !== 99) continue;
      checks++;
      // Drop the job tasks (and the intents and interrupts, re-derived at the next pass); keep the need tasks, which hold the meals and bed claims.
      const data = JSON.parse(serialize(sim)) as { world: { stores: Record<string, unknown> } };
      data.world.stores.task = (data.world.stores.task as [number, { job: number }][]).filter(([, t]) => t.job === 0);
      for (const k of ['intent', 'interrupt']) delete data.world.stores[k];
      const old = deserialize(JSON.stringify(data), content);
      for (const phase of ['loaded', 'one tick later']) {
        if (phase !== 'loaded') run(old, 1);
        const audit = auditReservations(old);
        expect(audit.problems, `tick ${old.tick}, ${phase}`).toEqual([]);
        for (const c of old.world.query(CrewC)) {
          const derived = deriveTask(old, c);
          const task = old.world.get(c, TaskC);
          if (old.world.has(c, AssignmentC) || mealOf(old, c) || derived) {
            expect(task, `crew ${c} at tick ${old.tick}, ${phase}`).toBeDefined();
            if (derived) {
              expect(task!.job, `crew ${c} at tick ${old.tick}, ${phase}`).toBe(derived.job);
              expect(task!.machine, `crew ${c} at tick ${old.tick}, ${phase}`).toBe(derived.machine);
            }
          }
        }
      }
    }
    expect([...want].filter((m) => !seen.has(m))).toEqual([]);
  });
  it('a crew member who dies mid-meal leaves no task or meal behind, and a reload restores none', () => {
    const sim = newGame(1, content);
    const [cook] = sim.world.query(CrewC);
    sim.world.get(cook!, NeedsC)!.hunger = 5;
    for (let i = 0; i < 2000 && !mealOf(sim, cook!); i++) run(sim, 1);
    expect(mealOf(sim, cook!)).toBeDefined();
    killCrew(sim, cook!); // the meal is the task: both go
    expect(sim.world.has(cook!, TaskC)).toBe(false);
    const old = deserialize(serialize(sim), content);
    expect(old.world.has(cook!, TaskC)).toBe(false);
    expect(auditReservations(old).problems).toEqual([]);
  });
});
