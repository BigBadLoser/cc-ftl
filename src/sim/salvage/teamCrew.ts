import { abortTask } from '../ai/task';
import { BodyC } from '../body';
import { CarriedC, CrewC, DeadC, DraftedC, PositionC, type Crew, type Position } from '../crew/components';
import { isIncapacitated, isSettled, origin } from '../crew/helpers';
import { AirlockC } from '../modules/airlock';
import { ModuleC } from '../modules/components';
import { EvaFloatC, SuitC } from '../eva/components';
import { planWalk } from '../eva/route';
import { nearestExterior, tileCentre, tileFrame, vehicleSuits } from '../eva/shuttle';
import { isSuited, suitAir, suitDef, suitTile } from '../eva/suit';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { SALVAGE_REFILL_FRAC, SALVAGE_RESCUE_FRAC, SALVAGE_RUN_BACK_FRAC } from '../tuning';
import { AboardC, EmbarkOrderC, VehicleC } from '../vehicles/components';
import { boardCrew } from '../vehicles/lifecycle';
import { SalvageCrewC } from './components';

/** Ticks between repeats of an order a team member has not obeyed yet. */
export const REPEAT = 20;

type Spot = { x: number; y: number };

export const aboard = (sim: Sim, crew: number, vehicle: number): boolean => sim.world.get(crew, AboardC)?.vehicle === vehicle;

/** True if the crew member stands close enough to the hovering shuttle to float back to its hatch. */
export function inFloatRange(sim: Sim, crew: number, vehicle: number): boolean {
  const pos = sim.world.get(crew, PositionC);
  const body = sim.world.get(vehicle, BodyC);
  const at = pos && tileCentre(sim, shipIdOf(sim, pos), pos.x, pos.y);
  return !!at && !!body && Math.hypot(body.x - at.x, body.y - at.y) <= suitDef(sim).floatRange;
}

/** Take a team member off their work and under the shift's orders (drafted, standing still until told where to go). */
function takeOver(sim: Sim, crew: number): void {
  if (sim.world.has(crew, DraftedC)) return;
  abortTask(sim, crew, 'order');
  sim.world.add(crew, DraftedC, { target: null });
  (sim.world.get(crew, CrewC) as Crew).activity = 'drafted';
}

/** Give a team member back to the crew AI (free to take the wreck's jobs). */
export function handBack(sim: Sim, crew: number): void {
  if (!sim.world.remove(crew, DraftedC)) return;
  const c = sim.world.get(crew, CrewC);
  if (c && c.activity === 'drafted') c.activity = 'idle';
}

/** Off the team: no longer drafted or walking to the shuttle, and no team tag. */
export function release(sim: Sim, crew: number, vehicle: number): void {
  if (sim.world.get(crew, EmbarkOrderC)?.vehicle === vehicle) sim.world.remove(crew, EmbarkOrderC);
  if (!sim.world.has(crew, AboardC)) handBack(sim, crew);
  sim.world.remove(crew, SalvageCrewC);
}

/** The wreck's hull tiles a suited crew member can stand on and float to the shuttle from, nearest to the shuttle first. */
function hatchSpots(sim: Sim, ship: number, vehicle: number): Spot[] {
  const body = sim.world.get(vehicle, BodyC);
  const frame = body && tileFrame(sim, ship, body.x, body.y);
  if (!frame) return [];
  return nearestExterior(sim, ship, frame, 12).filter((s) => s.d <= suitDef(sim).floatRange - 0.75);
}

/** Usable suit tiles of airlocks still standing on the wreck (an airlock refills a suit until it is stripped). */
export function airlockSpots(sim: Sim, ship: number): { airlock: number; at: Spot }[] {
  const out: { airlock: number; at: Spot }[] = [];
  for (const id of [...sim.world.query(AirlockC, ModuleC)].sort((a, b) => a - b)) {
    const m = sim.world.get(id, ModuleC)!;
    const at = m.hp > 0 && shipIdOf(sim, m) === ship ? suitTile(sim, id) : null;
    if (at) out.push({ airlock: id, at });
  }
  return out;
}

/** The nearest walk to a place a suit can be refilled: the shuttle's side of the hull (refill 0) or an airlock's suit tile. */
function refillPlan(sim: Sim, crew: number, ship: number, vehicle: number, pos: Position, airlocks: boolean): { refill: number; at: Spot } | null {
  let best: { refill: number; at: Spot; n: number } | null = null;
  const consider = (refill: number, at: Spot): void => {
    const plan = planWalk(sim, crew, ship, origin(pos), at);
    if (plan && (!best || plan.steps.length < best.n)) best = { refill, at, n: plan.steps.length };
  };
  for (const s of hatchSpots(sim, ship, vehicle)) consider(0, s);
  if (airlocks) for (const a of airlockSpots(sim, ship)) consider(a.airlock, a.at);
  return best;
}

/** Send a team member walking to `at` on the wreck. */
function walkTo(sim: Sim, crew: number, ship: number, at: Spot): void {
  takeOver(sim, crew);
  sim.enqueue({ type: 'crew.moveTo', id: crew, x: at.x, y: at.y, ship });
}

/**
 * A team member on the wreck heads back to the shuttle: float over when in range, else walk to the hull beside it. `due` paces the
 * orders (they are applied next tick and repeated until obeyed).
 */
export function headBack(sim: Sim, crew: number, ship: number, vehicle: number, due: boolean): void {
  const pos = sim.world.get(crew, PositionC);
  if (!pos || !due || sim.world.has(crew, EvaFloatC) || isIncapacitated(sim, crew)) return;
  const team = sim.world.get(crew, SalvageCrewC);
  if (team) team.refill = 0;
  if (isSettled(pos) && inFloatRange(sim, crew, vehicle) && isSuited(sim, crew)) {
    takeOver(sim, crew);
    sim.enqueue({ type: 'eva.board', crew, vehicle });
    return;
  }
  if (sim.world.get(crew, DraftedC)?.target) return; // on the way
  const plan = refillPlan(sim, crew, ship, vehicle, pos, false);
  if (plan) walkTo(sim, crew, ship, plan.at);
  else takeOver(sim, crew); // no way to the shuttle's side yet: stop and wait (the shuttle closes in, or picks them up)
}

/**
 * One look at a team member at work on the wreck. Fresh off the shuttle (drafted by `eva.out`, no orders) they are handed back to the crew
 * AI. Low on air they walk off to refill: an airlock on the wreck fills the tank where they stand; the shuttle by climbing back in (the
 * shift sends them out again in a fresh suit).
 */
export function tendWorker(sim: Sim, crew: number, ship: number, vehicle: number, due: boolean): void {
  const pos = sim.world.get(crew, PositionC);
  const team = sim.world.get(crew, SalvageCrewC);
  if (!pos || !team || sim.world.has(crew, EvaFloatC) || isIncapacitated(sim, crew)) return;
  if (team.landing) {
    delete team.landing;
    handBack(sim, crew);
  }
  if (team.refill === undefined) {
    if (isSuited(sim, crew) && suitAir(sim, crew) > suitDef(sim).airSec * SALVAGE_REFILL_FRAC) return;
    if (!due) return;
    const plan = refillPlan(sim, crew, ship, vehicle, pos, true);
    if (!plan) return headBack(sim, crew, ship, vehicle, due); // nowhere to walk: float back if close enough
    team.refill = plan.refill;
    if (plan.refill === 0) return headBack(sim, crew, ship, vehicle, due);
    return walkTo(sim, crew, ship, plan.at);
  }
  if (team.refill === 0) return headBack(sim, crew, ship, vehicle, due);
  const at = suitTile(sim, team.refill);
  const m = sim.world.get(team.refill, ModuleC);
  if (!at || !m || m.hp <= 0) {
    delete team.refill; // stripped meanwhile: look again
    return;
  }
  if (isSettled(pos) && pos.x === at.x && pos.y === at.y) {
    const suit = sim.world.get(crew, SuitC);
    if (suit) suit.air = suitDef(sim).airSec;
    delete team.refill;
    handBack(sim, crew);
    return;
  }
  if (due && !sim.world.get(crew, DraftedC)?.target) walkTo(sim, crew, ship, at);
}

/**
 * True if a team member out on the wreck is nearly out of air: whatever kept them from a refill (cut off from the shuttle's side with no
 * airlock to walk to, boxed in, downed), the hovering shuttle picks them up (`carryAboard`) before the tank runs dry.
 */
export function needsRescue(sim: Sim, crew: number): boolean {
  if (!isSuited(sim, crew) || sim.world.has(crew, EvaFloatC) || sim.world.has(crew, DeadC) || sim.world.has(crew, CarriedC)) return false;
  return suitAir(sim, crew) < suitDef(sim).airSec * SALVAGE_RESCUE_FRAC;
}

/** True if a team member left on the wreck while a cargo run is away needs the shuttle back: out of action, or low on air and not refilling. */
export function needsShuttleBack(sim: Sim, crew: number): boolean {
  if (!isSuited(sim, crew) || sim.world.has(crew, EvaFloatC) || sim.world.has(crew, DeadC) || sim.world.has(crew, CarriedC)) return false;
  return isIncapacitated(sim, crew) || suitAir(sim, crew) < suitDef(sim).airSec * SALVAGE_RUN_BACK_FRAC;
}

/** Carry a team member aboard as is (the end of a recall that ran out of time: downed, boxed in, or cut off from the shuttle's side). */
export function carryAboard(sim: Sim, crew: number, vehicle: number): void {
  const v = sim.world.get(vehicle, VehicleC);
  if (!v) return;
  sim.world.remove(crew, EvaFloatC);
  if (wearsShuttleSuit(sim, crew, vehicle)) {
    sim.world.remove(crew, SuitC);
    v.suits = vehicleSuits(sim, v) + 1;
  }
  const team = sim.world.get(crew, SalvageCrewC);
  if (team) delete team.detached;
  boardCrew(sim, crew, vehicle);
}

/** True if the crew member wears one of the shuttle's suits: tied to it, or a team member's suit untied for a cargo run. */
export function wearsShuttleSuit(sim: Sim, crew: number, vehicle: number): boolean {
  const suit = sim.world.get(crew, SuitC);
  const team = sim.world.get(crew, SalvageCrewC);
  return !!suit && (suit.vehicle === vehicle || (team?.vehicle === vehicle && !!team.detached && suit.vehicle === undefined));
}

/** Untie (`tie` false) or tie again the shuttle's suits worn by the team members out on the wreck (see `SalvageCrew.detached`). */
export function tieSuits(sim: Sim, crew: number[], vehicle: number, tie: boolean): void {
  for (const c of crew) {
    const suit = sim.world.get(c, SuitC);
    const team = sim.world.get(c, SalvageCrewC);
    if (!suit || !team || team.vehicle !== vehicle) continue;
    if (!tie && suit.vehicle === vehicle) {
      delete suit.vehicle;
      team.detached = true;
    } else if (tie && team.detached) {
      if (suit.vehicle === undefined) suit.vehicle = vehicle;
      delete team.detached;
    }
  }
}

/** Send a team member who is aboard out of the hatch onto the wreck, in a fresh suit from the shuttle's stock. */
export function sendOut(sim: Sim, crew: number, vehicle: number): void {
  const team = sim.world.get(crew, SalvageCrewC);
  if (!team) return;
  delete team.refill;
  team.landing = true;
  sim.enqueue({ type: 'eva.out', vehicle, crew });
}

/** True if the team member can walk to the suit tile of an airlock still standing on the wreck (where a tank is refilled without the shuttle). */
export function reachesAirlock(sim: Sim, crew: number, ship: number): boolean {
  const pos = sim.world.get(crew, PositionC);
  return !!pos && airlockSpots(sim, ship).some((a) => !!planWalk(sim, crew, ship, origin(pos), a.at));
}
