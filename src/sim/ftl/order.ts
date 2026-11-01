import { CombatC, ShipC } from '../combat/components';
import { abortTask, reserveJob } from '../ai/task';
import { skillOf } from '../combat/operators';
import { shipById } from '../combat/ships';
import {
  AssignmentC, BedClaimC, CrewC, DeadC, DraftedC, EatC, JobC, PathC, PositionC, type Position,
} from '../crew/components';
import { isIncapacitated, jobGoal, origin } from '../crew/helpers';
import { planWalk } from '../eva/route';
import { isOffDuty } from '../fight/relations';
import { AllegianceC } from '../fight/components';
import { canTakeRobotJob } from '../robots/jobs';
import { routeCharge, routeEdges, jump } from '../galaxy/hyperspace';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { FTL_CHARGE_SEC } from '../tuning';
import { AboardC, EmbarkOrderC } from '../vehicles/components';
import { helmJob } from './status';

/** Ticks between attempts to find a pilot for an unseated helm job. */
const SEAT_EVERY = 10;

/** True if a charge order stands on the ship (the helm is then needed outside combat too). */
export function chargeOrdered(sim: Sim, ship: number): boolean {
  return !!sim.world.get(ship, CombatC)?.ftlOrder;
}

/**
 * A crew member who could sit at the helm: on the ship, of its side, on their feet and not busy with a need or the fight. Free crew
 * (no job) come before busy ones; within each, the best pilot, then the lowest id. The pilot is just the best-skilled crew member, so
 * with no pilot free (or aboard) anyone takes the seat.
 */
function candidates(sim: Sim, ship: number): number[] {
  const faction = shipById(sim, ship)?.faction;
  const out: { id: number; busy: boolean; skill: number }[] = [];
  for (const id of sim.world.query(CrewC, PositionC, PathC)) {
    const crew = sim.world.get(id, CrewC);
    if (!crew || sim.world.has(id, DeadC) || sim.world.has(id, DraftedC) || sim.world.has(id, EmbarkOrderC) || sim.world.has(id, AboardC)) continue;
    if (sim.world.has(id, EatC) || sim.world.has(id, BedClaimC) || isIncapacitated(sim, id) || isOffDuty(sim, id)) continue;
    if (['sleeping', 'charging', 'eating'].includes(crew.activity) || sim.world.get(id, AllegianceC)?.faction !== faction) continue;
    if (shipIdOf(sim, sim.world.get(id, PositionC)) !== ship) continue;
    const a = sim.world.get(id, AssignmentC);
    const kind = a && sim.world.get(a.jobId, JobC)?.kind;
    if (kind === 'rescue') continue;
    out.push({ id, busy: !!a, skill: skillOf(sim, id, 'piloting') });
  }
  return out.sort((a, b) => Number(a.busy) - Number(b.busy) || b.skill - a.skill || a.id - b.id).map((c) => c.id);
}

/** Send the best crew member who can reach it to the open helm job. Returns true once someone holds it. */
function seatHelm(sim: Sim, ship: number, jobId: number): boolean {
  const job = sim.world.get(jobId, JobC);
  if (!job || job.reservedBy) return !!job;
  for (const id of candidates(sim, ship)) {
    if (!canTakeRobotJob(sim, id, job)) continue;
    const plan = planWalk(sim, id, ship, origin(sim.world.get(id, PositionC) as Position), jobGoal(job));
    if (!plan || plan.thin) continue;
    abortTask(sim, id, 'order');
    reserveJob(sim, id, jobId, plan.steps);
    return true;
  }
  return false;
}

/** Keep every ordered ship's helm job seated: look for a pilot when it is open, now and then. `fresh` jobs are tried at once. */
export function seatHelms(sim: Sim, fresh: ReadonlySet<number>): void {
  for (const ship of sim.world.query(ShipC, CombatC)) {
    if (!chargeOrdered(sim, ship)) continue;
    const job = helmJob(sim, ship);
    if (!job || job.by) continue;
    if (fresh.has(job.id) || (sim.tick + ship) % SEAT_EVERY === 0) seatHelm(sim, ship, job.id);
  }
}

/**
 * After the drive has charged this tick: a plain order ends once it is full; a queued jump fires as soon as the charge covers its route
 * (and ends either way: a rejected jump says why through `command.rejected`, and the helm is released).
 */
export function settleOrder(sim: Sim, ship: number): void {
  const combat = sim.world.get(ship, CombatC);
  const order = combat?.ftlOrder;
  if (!combat || !order) return;
  if (!order.jump) {
    if (combat.ftl + 1e-9 >= FTL_CHARGE_SEC) combat.ftlOrder = null;
    return;
  }
  const edges = routeEdges(sim, [sim.galaxy.current, ...order.jump]);
  if (!edges) {
    combat.ftlOrder = null;
    return;
  }
  if (combat.ftl + 1e-9 < routeCharge(edges)) return;
  combat.ftlOrder = null;
  jump(sim, ship, order.jump, order.withDocked, 'ftl.charge', order.overcharge);
}
