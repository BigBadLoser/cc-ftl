import { describe, expect, it } from 'vitest';
import {
  AssignmentC, CarriedC, CarryingC, CrewC, DownedC, DraftedC, HealthC, IntentC, InterruptC, ItemStackC, JobC, NeedsC, PositionC,
  StorageC, Struct, TaskC, deserialize, homeShip, newGame, serialize, shipGrid, storageCount, type Sim, type SimEvent,
} from '../../sim';
import { auditReservations } from '../../sim/ai/audit';
import { explainCrew } from '../../sim/ai/explain';
import { destroyJob } from '../../sim/items/stacks';
import { content } from '../index';

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

function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** A small deterministic sequence for the tests' own choices (the sim's RNG is not touched). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}

function floorTiles(sim: Sim): { x: number; y: number }[] {
  const g = shipGrid(sim, homeShip(sim))!;
  const out: { x: number; y: number }[] = [];
  for (let y = g.y0; y < g.y0 + g.height; y++) for (let x = g.x0; x < g.x0 + g.width; x++) if (g.get('struct', x, y) === Struct.Floor && !g.get('module', x, y)) out.push({ x, y });
  return out;
}

/** The starter with metal stacks on its floor to haul. */
function haulBoard(seed: number): Sim {
  const sim = newGame(seed, content, 'ship.starter', false);
  run(sim, 2);
  const ship = homeShip(sim);
  for (const t of floorTiles(sim).filter((_, i) => i % 6 === 0)) sim.enqueue({ type: 'debug.spawnItems', ship, x: t.x, y: t.y, item: 'item.metal', count: 7 });
  run(sim, 1);
  return sim;
}

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
    // Every crew member in the job loop has an intent from policy.legacy.
    const loop = sim.world.query(CrewC).filter((c) => sim.world.has(c, IntentC));
    expect(loop.length).toBeGreaterThan(3);
    expect(loop.every((c) => sim.world.get(c, IntentC)!.policy === 'policy.legacy')).toBe(true);
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

  /** One scripted run: hauls, a downed crew member, draft and move orders, a cancelled job. Returns the events and per-tick hashes. */
  function scripted(saveAt: readonly number[] = []): { events: string; hashes: number[] } {
    let sim = haulBoard(5);
    const crew = sim.world.query(CrewC);
    sim.world.get(crew[1]!, HealthC)!.hp = 0;
    sim.world.get(crew[2]!, NeedsC)!.rest = 10;
    const ship = homeShip(sim);
    const floor = floorTiles(sim);
    const events: string[] = [];
    const hashes: number[] = [];
    for (let i = 0; i < 500; i++) {
      if (i === 40) sim.enqueue({ type: 'crew.draft', id: crew[0]!, drafted: true });
      if (i === 41) sim.enqueue({ type: 'crew.moveTo', id: crew[0]!, x: floor[3]!.x, y: floor[3]!.y });
      if (i === 120) sim.enqueue({ type: 'crew.draft', id: crew[0]!, drafted: false });
      if (i === 200) sim.enqueue({ type: 'job.build', ship, x: floor[10]!.x, y: floor[10]!.y, struct: Struct.Door });
      if (i === 260) sim.enqueue({ type: 'job.cancel', ship, x: floor[10]!.x, y: floor[10]!.y });
      if (saveAt.includes(i)) sim = deserialize(serialize(sim), content);
      sim.step();
      events.push(...sim.events.drain().map((e) => JSON.stringify(e)));
      hashes.push(fnv(serialize(sim)));
    }
    return { events: events.join('\n'), hashes };
  }

  it('replays exactly: three runs give the same events and tick hashes, and random save/load points change nothing', () => {
    const a = scripted();
    const b = scripted();
    const c = scripted();
    expect(b.events).toBe(a.events);
    expect(c.events).toBe(a.events);
    expect(b.hashes).toEqual(a.hashes);
    expect(c.hashes).toEqual(a.hashes);
    const next = lcg(11);
    const points = Array.from({ length: 8 }, () => Math.floor(next() * 500)).sort((x, y) => x - y);
    const d = scripted(points);
    expect(d.events).toBe(a.events);
    expect(d.hashes).toEqual(a.hashes);
  });

  it('the inspector shows each crew member\'s drive, task state path and holds', () => {
    const sim = haulBoard(2);
    run(sim, 30);
    const hauler = sim.world.query(CrewC).find((c) => sim.world.get(c, TaskC)?.machine === 'haul');
    expect(hauler).toBeDefined();
    const x = explainCrew(sim, hauler!);
    const job = sim.world.get(hauler!, AssignmentC)!.jobId;
    expect(x).toMatchObject({ policy: 'policy.legacy', drive: 'work', assignment: job, task: { job: { id: job, kind: 'haul' }, holds: [`job ${job}`] } });
    expect(x.task!.path).toMatch(/^haul\/(ToSource|ToDest|Deposit)$/);
    expect(x.scores).toEqual({ recharge: 0, sleep: 0, eat: 0, work: 1000 });
  });
});
