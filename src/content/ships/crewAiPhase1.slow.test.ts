import { describe, expect, it } from 'vitest';
import {
  AssignmentC, BedClaimC, CarriedC, CarryingC, CrewC, DraftedC, HealthC, JobC, ModuleC, NeedsC, PositionC, ShipC, Struct, TaskC,
  deserialize, findPath, homeShip, isSuited, isThin, liftShip, newGame, placementError, removeModule, serialize, shipGrid, spawnModule,
  stampPacket, type Sim,
} from '../../sim';
import { auditReservations } from '../../sim/ai/audit';
import { machineStates } from '../../sim/ai/classes';
import { killCrew } from '../../sim/crew/death';
import { findJobAt, isIncapacitated } from '../../sim/crew/helpers';
import { destroyJob } from '../../sim/items/stacks';
import { shipIdOf } from '../../sim/regions';
import { content } from '../index';

/**
 * Crew AI Phase 1 (docs/CREW_AI.md section 10): every executor state is reached on a real ship, saved and loaded there, and torn
 * down there. Four boards: a busy starter (builds, hauls, an EVA wall on the hull ring, a hungry, a tired and a downed crew
 * member), a robot with a flat battery and a bay, and two bedless ships (a rescue with nowhere to go, tired crew with no bed).
 */

const run = (sim: Sim, n: number): void => {
  for (let i = 0; i < n; i++) {
    sim.step();
    sim.events.drain();
  }
};

/** FNV-1a over a string. */
function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

function floorTiles(sim: Sim): { x: number; y: number }[] {
  const g = shipGrid(sim, homeShip(sim))!;
  const out: { x: number; y: number }[] = [];
  for (let y = g.y0; y < g.y0 + g.height; y++) for (let x = g.x0; x < g.x0 + g.width; x++) if (g.get('struct', x, y) === Struct.Floor && !g.get('module', x, y)) out.push({ x, y });
  return out;
}

function busy(seed: number): Sim {
  const sim = newGame(seed, content, 'ship.starter', false);
  run(sim, 2);
  const ship = homeShip(sim);
  const s = sim.world.get(ship, ShipC)!;
  const floor = floorTiles(sim);
  sim.enqueue({ type: 'debug.giveItems', item: 'item.metal', count: 300 });
  for (const t of floor.slice(0, 40).filter((_, i) => i % 7 === 0)) sim.enqueue({ type: 'job.build', ship, x: t.x, y: t.y, struct: Struct.Door });
  for (const t of floor.slice(60, 120).filter((_, i) => i % 9 === 0)) sim.enqueue({ type: 'debug.spawnItems', ship, x: t.x, y: t.y, item: 'item.metal', count: 5 });
  sim.enqueue({ type: 'job.build', ship, x: s.x + 3, y: s.y, struct: Struct.Wall }); // on the hull ring: only reachable in a suit
  run(sim, 1);
  const crew = sim.world.query(CrewC);
  sim.world.get(crew[0]!, NeedsC)!.hunger = 5;
  sim.world.get(crew[1]!, NeedsC)!.rest = 5;
  sim.world.get(crew[2]!, HealthC)!.hp = 0;
  return sim;
}

function robot(seed: number): Sim {
  const sim = newGame(seed, content, 'ship.starter', false);
  run(sim, 2);
  const ship = homeShip(sim);
  const g = shipGrid(sim, ship)!;
  const at = sim.world.get(sim.world.query(CrewC)[0]!, PositionC)!;
  let bay = 0;
  for (let y = g.y0; y < g.y0 + g.height && !bay; y++) for (let x = g.x0; x < g.x0 + g.width && !bay; x++) {
    if (placementError(sim, ship, 'module.robotBay', x, y, 0) !== null) continue;
    const id = spawnModule(sim, 'module.robotBay', x, y, 0);
    if (findPath(sim, ship, { x: at.x, y: at.y }, { x, y })) bay = id;
    else removeModule(sim, id);
  }
  sim.enqueue({ type: 'debug.spawnCrew', ship, x: at.x, y: at.y, role: 'role.robot_worker' });
  run(sim, 1);
  sim.enqueue({ type: 'debug.setCharge', value: 5 });
  return sim;
}

function bedless(seed: number, lifted = false): Sim {
  const sim = newGame(seed, content, 'ship.starter', false);
  run(sim, 2);
  const crew = sim.world.query(CrewC);
  sim.world.get(crew[2]!, HealthC)!.hp = 0;
  run(sim, 30); // the rescue is posted while the beds still stand
  // `lifted`: the beds go only once the patient is carried, so the carrier is left with nowhere to lay them. Under the scheduler (#194 Phase 2)
  // the medic, who ranks medical first, takes the rescue from across the ship and has not lifted in 30 ticks; the legacy picker gave it to
  // the lowest id, two tiles away, at their fourth level.
  for (let i = 0; lifted && i < 600 && !sim.world.has(crew[2]!, CarriedC); i++) run(sim, 1);
  for (const id of [...sim.world.query(ModuleC)]) if (sim.content.modules[sim.world.get(id, ModuleC)!.def]?.bed) removeModule(sim, id);
  for (const c of crew) sim.world.get(c, NeedsC)!.rest = 5;
  return sim;
}

const DRIVERS: { name: string; make: () => Sim; ticks: number }[] = [
  { name: 'busy', make: () => busy(1), ticks: 2000 },
  { name: 'robot', make: () => robot(1), ticks: 400 },
  { name: 'bedless 1', make: () => bedless(1), ticks: 900 },
  { name: 'bedless 2', make: () => bedless(2, true), ticks: 300 },
];

/**
 * States entered and left inside one work step, never seen between ticks: a haul's `Take` (the load is picked up and the job moves
 * on to its destination in the same call). Their save point is the travel state on either side.
 */
const INSTANT = ['haul/Take'];
const HORIZON = 200;

interface Snap {
  state: string;
  driver: string;
  crew: number;
  tick: number;
  save: string;
  /** The uninterrupted run's state hash for the HORIZON ticks after the snapshot. */
  after: number[];
}

/** Run every driver and keep, for each machine state the first time any crew member is in it, a save and the next HORIZON ticks' hashes. */
function census(): Snap[] {
  const snaps: Snap[] = [];
  const seen = new Set<string>();
  for (const d of DRIVERS) {
    const sim = d.make();
    const open: Snap[] = [];
    for (let i = 0; i < d.ticks || open.length > 0; i++) {
      run(sim, 1);
      if (open.length > 0) {
        const h = fnv(serialize(sim));
        for (const s of open) s.after.push(h);
        for (let k = open.length - 1; k >= 0; k--) if (open[k]!.after.length >= HORIZON) open.splice(k, 1);
      }
      if (i >= d.ticks) continue;
      for (const c of sim.world.query(TaskC)) {
        const t = sim.world.get(c, TaskC)!;
        const key = `${t.machine}/${t.state}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const snap = { state: key, driver: d.name, crew: c, tick: sim.tick, save: serialize(sim), after: [] };
        snaps.push(snap);
        open.push(snap);
      }
    }
  }
  return snaps;
}

const SNAPS = census();

describe('crew AI phase 1: every executor state', () => {
  it('is reached by a scenario (a new state without one fails here)', () => {
    const reached = new Set(SNAPS.map((s) => s.state));
    const missing = machineStates().map(([m, s]) => `${m}/${s}`).filter((k) => !reached.has(k) && !INSTANT.includes(k));
    expect(missing).toEqual([]);
  });

  it('saves and loads mid-state: the next 200 ticks hash as the uninterrupted run', () => {
    for (const snap of SNAPS) {
      const sim = deserialize(snap.save, content);
      expect(sim.world.get(snap.crew, TaskC), snap.state).toBeDefined();
      for (let k = 0; k < HORIZON; k++) {
        run(sim, 1);
        if (fnv(serialize(sim)) !== snap.after[k]) throw new Error(`${snap.state} (${snap.driver}, tick ${snap.tick}): differs ${k + 1} ticks after the load`);
      }
    }
  });

  type Disruption = 'draft' | 'down' | 'kill' | 'destroyJob' | 'cancelJob' | 'removeModule' | 'jumpAway';
  const DISRUPTIONS: Disruption[] = ['draft', 'down', 'kill', 'destroyJob', 'cancelJob', 'removeModule', 'jumpAway'];

  /** Apply a disruption to the crew member in the snapshot's state; false when it does not apply (no job, no module). */
  function disrupt(sim: Sim, crew: number, how: Disruption): boolean {
    const task = sim.world.get(crew, TaskC)!;
    const job = sim.world.get(task.job, JobC);
    switch (how) {
      case 'draft': sim.enqueue({ type: 'crew.draft', id: crew, drafted: true }); return true;
      case 'down': sim.world.get(crew, HealthC)!.hp = 0; return true;
      case 'kill': killCrew(sim, crew); return true;
      case 'destroyJob': if (!job) return false; destroyJob(sim, task.job); return true;
      case 'cancelJob': {
        const ship = job ? shipIdOf(sim, job) : 0;
        if (!job || !findJobAt(sim, ship, job.x, job.y)) return false;
        sim.enqueue({ type: 'job.cancel', ship, x: job.x, y: job.y });
        return true;
      }
      case 'removeModule': {
        const ids = [task.bb.target, task.bb.aux, job?.target, ...task.holds.map((h) => h.id)].filter((m): m is number => !!m && sim.world.has(m, ModuleC));
        if (ids.length === 0) return false;
        removeModule(sim, ids[0]!);
        return true;
      }
      case 'jumpAway': {
        // The ship leaves the node and comes back (lifted into a packet, stamped again where it was).
        const ship = homeShip(sim);
        const s = sim.world.get(ship, ShipC)!;
        const [x, y] = [s.x, s.y];
        stampPacket(sim, liftShip(sim, ship), x, y);
        return true;
      }
    }
  }

  it('is torn down cleanly by a draft, a down, a death, a lost job or module, or a jump: no leak after the next three ticks', () => {
    let applied = 0;
    for (const snap of SNAPS) {
      for (const how of DISRUPTIONS) {
        const sim = deserialize(snap.save, content);
        const c = snap.crew;
        if (!disrupt(sim, c, how)) continue;
        applied++;
        const at = `${snap.state} (${snap.driver}) x ${how}`;
        // A load is only carried on a haul (perhaps suiting up for its way on). The scheduler's pass drops a load left over from a
        // haul that ended; one released in that same pass (unreachable) goes on the next, so a load may outlive its haul one pass.
        let loose = new Set<number>();
        const loads = { begin() {}, count() {}, end(label: string) {
          if (label !== 'sim/schedule') return;
          const now = new Set<number>();
          for (const id of sim.world.query(CarryingC)) {
            if (isIncapacitated(sim, id) || sim.world.has(id, DraftedC)) continue;
            const t = sim.world.get(id, TaskC);
            if (![t?.machine, ...(t?.stack ?? []).map((f) => f.machine)].includes('haul')) now.add(id);
          }
          expect([...now].filter((id) => loose.has(id)), `${at}: a load outlived its haul`).toEqual([]);
          loose = now;
        } };
        for (let q = 0; q < 3; q++) {
          sim.step(loads);
          sim.events.drain();
        }
        const audit = auditReservations(sim);
        expect(audit.problems, at).toEqual([]);
        expect(audit.pendingSweep, at).toBe(0);
        if (how === 'draft' || how === 'down' || how === 'kill') {
          expect(sim.world.has(c, AssignmentC), at).toBe(false);
          expect(sim.world.query(JobC).filter((j) => sim.world.get(j, JobC)!.reservedBy === c), at).toEqual([]);
          expect(sim.world.has(c, BedClaimC), at).toBe(false);
        }
        if (how === 'kill') expect(sim.world.has(c, TaskC), at).toBe(false);
        for (const id of sim.world.query(CrewC)) {
          if (isIncapacitated(sim, id) || sim.world.has(id, DraftedC)) continue;
          const pos = sim.world.get(id, PositionC);
          const grid = pos && shipGrid(sim, shipIdOf(sim, pos));
          // An aborted EVA never leaves an unsuited crew member out in thin air.
          if (grid && pos && isThin(grid, pos.x, pos.y) && sim.content.species[sim.world.get(id, CrewC)!.species]?.airless !== true) expect(isSuited(sim, id), `${at}: crew ${id} unsuited in thin air`).toBe(true);
        }
      }
    }
    expect(applied).toBeGreaterThan(SNAPS.length * 4);
  });
});
