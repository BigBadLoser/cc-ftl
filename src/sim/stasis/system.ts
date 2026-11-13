import { CarriedC, CrewC, DeadC, JobC, PositionC, type Job } from '../crew/components';
import { isIncapacitated, origin } from '../crew/helpers';
import { PrisonerC } from '../fight/components';
import { destroyJob } from '../items/stacks';
import { ModuleC } from '../modules/components';
import { shipIdAt, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { playerShips } from '../story/world';
import { PLAN_INTERVAL } from '../tuning';
import { StasisC } from './components';
import { dropSlab, thawPrisoner } from './freeze';
import { aimFetch, pickWheel, stasisRoom } from './jobs';
import { cartsFor, fullSlabs, slabDraining, slabHeld, wheelHatch, wheelOf } from './query';
import { REFILL_PER_TICK, RESERVE_TICKS } from './tuning';

/** Work value of the phases that end by an act, not by progress (the seal phase sets its own). */
const ACT_WORK = 1;

/**
 * Prisoner holding (#116), once a tick, after power:
 *  - every full slab's place is checked: a cart whose carrier no longer works the slab's job (downed, called off, job gone) sets the slab down
 *    on the floor where they stand; a slab whose wheel is gone lies by where the wheel's hatch was;
 *  - reserve: a slab out of a powered wheel and off a cart drains one tick a tick, and its prisoner thaws, hostile, at 0; a slab in a powered
 *    wheel refills REFILL_PER_TICK a tick;
 *  - every PLAN_INTERVAL ticks the 'stasis' jobs (hauling) are kept or dropped, slabs on the floor get a pickup job and prisoners on the player's
 *    ships get a seal job, while the ship's wheels have room (`stasisRoom`) and, for a seal, an empty slab is to be had.
 */
export function stasisSystem(sim: Sim): void {
  for (const id of fullSlabs(sim)) {
    const s = sim.world.get(id, StasisC);
    if (!s) continue;
    if (s.at === 'carried') {
      const pos = sim.world.get(s.carrier, PositionC);
      if (pos && cartsFor(sim, s.carrier, id) && !isIncapacitated(sim, s.carrier)) Object.assign(s, origin(pos));
      else dropSlab(sim, id, shipIdAt(sim, s.x, s.y), { x: s.x, y: s.y });
    } else if (s.at === 'wheel') {
      const m = sim.world.get(wheelOf(sim, id)?.wheel ?? 0, ModuleC);
      if (m) Object.assign(s, wheelHatch(sim, m));
      else dropSlab(sim, id, shipIdAt(sim, s.x, s.y), { x: s.x, y: s.y });
    }
    if (slabDraining(sim, id)) {
      s.reserve -= 1;
      if (s.reserve <= 0) thawPrisoner(sim, id);
    } else if (slabHeld(sim, id)) {
      s.reserve = Math.min(RESERVE_TICKS, s.reserve + REFILL_PER_TICK);
    }
  }
  if (sim.tick % PLAN_INTERVAL === 0) planJobs(sim);
}

/** Keep, re-aim or drop each stasis job, then post pickups (draining slabs first) and seals while there is room. */
function planJobs(sim: Sim): void {
  const handled = new Set<number>();
  for (const jid of [...sim.world.query(JobC)].sort((a, b) => a - b)) {
    const job = sim.world.get(jid, JobC) as Job;
    if (job.kind !== 'stasis') continue;
    if (keep(sim, job) && !handled.has(job.target ?? 0)) handled.add(job.target ?? 0);
    else destroyJob(sim, jid);
  }
  const ships = playerShips(sim);
  const room = new Map<number, number>();
  const roomOf = (ship: number): number => {
    if (!room.has(ship)) room.set(ship, stasisRoom(sim, ship));
    return room.get(ship) as number;
  };
  const take = (ship: number): boolean => {
    const left = roomOf(ship);
    room.set(ship, left - 1);
    return left > 0;
  };
  for (const id of fullSlabs(sim)) {
    const s = sim.world.get(id, StasisC);
    const ship = s ? shipIdAt(sim, s.x, s.y) : 0;
    if (!s || s.at !== 'floor' || handled.has(id) || !ships.has(ship) || !pickWheel(sim, ship, s) || !take(ship)) continue;
    post(sim, { kind: 'stasis', x: s.x, y: s.y, target: id, stasis: { phase: 'pickup' } });
  }
  for (const id of [...sim.world.query(PrisonerC, PositionC, CrewC)].sort((a, b) => a - b)) {
    const pos = sim.world.get(id, PositionC);
    const ship = shipIdOf(sim, pos);
    if (!pos || handled.has(id) || !ships.has(ship) || !sealable(sim, id) || roomOf(ship) <= 0) continue;
    const job: Job = { category: 'hauling', kind: 'stasis', x: pos.x, y: pos.y, struct: 0, work: ACT_WORK, progress: 0, reservedBy: 0, target: id, stasis: { phase: 'fetch' } };
    if (!aimFetch(sim, job, job.stasis!, ship, origin(pos))) continue; // no empty slab on this ship
    take(ship);
    sim.world.add(sim.world.createEntity(), JobC, job);
  }
}

function post(sim: Sim, job: Pick<Job, 'kind' | 'x' | 'y' | 'target' | 'stasis'>): void {
  sim.world.add(sim.world.createEntity(), JobC, { category: 'hauling', struct: 0, work: ACT_WORK, progress: 0, reservedBy: 0, ...job });
}

/** A prisoner who can be sealed now: alive, in the world, not being carried. */
const sealable = (sim: Sim, id: number): boolean =>
  sim.world.has(id, PrisonerC) && sim.world.has(id, PositionC) && !sim.world.has(id, DeadC) && !sim.world.has(id, CarriedC) && !sim.world.has(id, StasisC);

/** Is the job still wanted? Re-aims it at the moved prisoner or slab, and turns a stow whose cart was set down back into a pickup. */
function keep(sim: Sim, job: Job): boolean {
  const st = job.stasis;
  const prisoner = job.target ?? 0;
  if (!st || !sim.world.has(prisoner, CrewC) || sim.world.has(prisoner, DeadC)) return false;
  if (st.phase === 'fetch' || st.phase === 'seal') {
    const pos = sim.world.get(prisoner, PositionC);
    if (!pos || !sealable(sim, prisoner) || !playerShips(sim).has(shipIdOf(sim, pos))) return false;
    if (job.reservedBy) {
      if (st.phase === 'seal') Object.assign(job, origin(pos));
      return true;
    }
    // Nobody on it: start again from the nearest empty slab (a crew member who left it dropped theirs).
    return aimFetch(sim, job, st, shipIdOf(sim, pos), origin(pos));
  }
  const s = sim.world.get(prisoner, StasisC);
  if (s?.at === 'floor') {
    st.phase = 'pickup';
    delete st.wheel;
    Object.assign(job, { x: s.x, y: s.y, work: ACT_WORK });
    delete job.size;
    return true;
  }
  return st.phase === 'stow' && !!job.reservedBy && cartsFor(sim, job.reservedBy, prisoner);
}
