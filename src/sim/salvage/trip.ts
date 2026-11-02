import { shipById } from '../combat/ships';
import { CrewC, DeadC } from '../crew/components';
import { EvaFloatC } from '../eva/components';
import { BodyC } from '../body';
import { outsideCrew } from '../eva/shuttle';
import { SuitC } from '../eva/components';
import { isTileWalkable } from '../modules/walk';
import { shipGrid } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { EmbarkOrderC, VehicleC, type Vehicle } from '../vehicles/components';
import { sendToEmbark } from '../vehicles/embark';
import { boardingTile, hoverPoint } from '../vehicles/geometry';
import { occupants, unboardCrew, vehicleDefOf } from '../vehicles/lifecycle';
import { SalvageCrewC, SalvageOrderC, SalvageTripC, type SalvageBlock, type SalvageOrder, type SalvageTrip, type SalvageTripEnd } from './components';
import { partCount, partsOf, salvageJobs } from './plan';
import { destroyJob } from '../items/stacks';
import { liveBox, needsHome, pickTeam, pickTeamShuttle, playerCrewOn, tripFor } from './team';
import { aboard, carryAboard, handBack, headBack, release, REPEAT, sendOut, tendWorker } from './teamCrew';
import { haulsTo, looseOn, planCarry, runCrew, runDue, startRun, stepRun } from './cargoRun';

const sec = (n: number): number => n * TICK_HZ;
/** Seconds the team gets to reach the bay, the shuttle to reach the wreck, the team to float back, and the shuttle to get home. */
const BOARD_SEC = 60;
const FLIGHT_SEC = 240;
const RECALL_SEC = 90;
/** Seconds after a shift before the next one, between looks for a shuttle or crew, and the team spends carrying off loot once all is stripped. */
const PAUSE_SEC = 10;
const DONE_WAIT_SEC = 120;
const LOOK_SEC = 5;


const due = (t: SalvageTrip): boolean => t.timer % REPEAT === 1;

function go(t: SalvageTrip, phase: SalvageTrip['phase']): void {
  t.phase = phase;
  t.timer = 0;
}

/** Set a team block on the order (the hostile block, owned by the salvage system, wins). */
function block(sim: Sim, ship: number, o: SalvageOrder, reason: SalvageBlock): void {
  o.teamAt = sim.tick + sec(LOOK_SEC);
  if (o.block === 'hostile' || o.block === reason) return;
  o.status = 'blocked';
  o.block = reason;
  sim.events.emit({ type: 'salvage.blocked', ship, reason });
}

function unblock(sim: Sim, ship: number, o: SalvageOrder): void {
  if (o.block !== 'noShuttle' && o.block !== 'noCrew') return;
  o.status = 'running';
  delete o.block;
  sim.events.emit({ type: 'salvage.ordered', ship, types: [...o.types] });
}

/** True when the order has nothing left to strip and no stripping job open. */
const finished = (sim: Sim, ship: number, o: SalvageOrder): boolean => salvageJobs(sim, ship).length === 0 && partCount(partsOf(sim, ship, o.types)) === 0;

/** Why the shift should end now, or undefined to keep working. */
function endReason(sim: Sim, id: number, t: SalvageTrip): SalvageTripEnd | undefined {
  if (t.reason) return t.reason; // already decided (a cargo run found no room at home)
  const o = sim.world.get(t.ship, SalvageOrderC);
  if (!o) return 'cancelled';
  if (o.block === 'hostile') return 'hostile';
  if (t.crew.length === 0) return 'lost';
  if (sim.sector.inCombat) return 'combat';
  if (finished(sim, t.ship, o)) {
    // All stripped: the loot still lying about (or on its way to the hold) is carried off first, for a while.
    const loot = looseOn(sim, t.ship).length > 0 || haulsTo(sim, id).length > 0;
    t.doneAt ??= sim.tick;
    if (!loot || sim.tick - t.doneAt > sec(DONE_WAIT_SEC)) return 'done';
  }
  if (t.crew.some((c) => needsHome(sim, c))) return 'tired';
  return undefined;
}

/** End the shift: recall the team, or (all aboard) head home. */
function wrapUp(sim: Sim, id: number, t: SalvageTrip, reason: SalvageTripEnd): void {
  t.reason ??= reason;
  if (t.crew.every((c) => aboard(sim, c, id))) {
    go(t, 'home');
    sim.enqueue({ type: 'vehicle.return', vehicle: id });
  } else go(t, 'recall');
}

/**
 * Team members whose shift is gone without a word (its shuttle destroyed: the entity, and the trip on it, are removed at once) are let go:
 * off the team, back to the crew AI, and the suits they wear no longer belong to a shuttle (they stow them at an airlock like any suit).
 */
function sweepOrphans(sim: Sim): void {
  for (const c of [...sim.world.query(SalvageCrewC)].sort((a, b) => a - b)) {
    const vehicle = sim.world.get(c, SalvageCrewC)!.vehicle;
    if (sim.world.get(vehicle, SalvageTripC)) continue;
    const suit = sim.world.get(c, SuitC);
    if (suit?.vehicle === vehicle) delete suit.vehicle;
    if (!sim.world.has(c, EvaFloatC)) handBack(sim, c);
    sim.world.remove(c, EvaFloatC);
    release(sim, c, vehicle);
  }
}

/** Start a shift for an order with no team: a free shuttle with suits and a few rested crew, who walk to its bay. */
function startTrip(sim: Sim, ship: number, o: SalvageOrder): void {
  if ((o.status === 'blocked' && o.block === 'hostile') || sim.sector.inCombat) return;
  if (sim.tick < (o.teamAt ?? 0) || finished(sim, ship, o)) return;
  // Crew of the player's who are on the wreck already (a boarding party left on a ship wrecked in the fight) work it without a team.
  const wait = (reason: SalvageBlock): void => {
    if (!playerCrewOn(sim, ship)) return block(sim, ship, o, reason);
    unblock(sim, ship, o);
    o.teamAt = sim.tick + sec(LOOK_SEC);
  };
  const vehicle = pickTeamShuttle(sim);
  if (!vehicle) return wait('noShuttle');
  const crew = pickTeam(sim, vehicle).filter((c) => sendToEmbark(sim, c, vehicle) === null);
  if (crew.length === 0) return wait('noCrew');
  unblock(sim, ship, o);
  for (const c of crew) sim.world.add(c, SalvageCrewC, { vehicle });
  sim.world.add(vehicle, SalvageTripC, { ship, crew, phase: 'board', timer: 0 });
  sim.events.emit({ type: 'salvage.teamSent', ship, vehicle, crew: [...crew] });
}

/** The shift is over: the team is off it (stepping out at the bay if the shuttle is home) and the order rests before the next one. */
function endTrip(sim: Sim, id: number, t: SalvageTrip): void {
  const v = sim.world.get(id, VehicleC);
  if (v?.state === 'stowed') {
    const at = boardingTile(sim, id);
    const grid = at && shipGrid(sim, at.shipId);
    if (at && grid && isTileWalkable(sim, grid, at.x, at.y)) for (const c of occupants(v)) if (t.crew.includes(c)) unboardCrew(sim, c, id, at);
  }
  for (const c of t.crew) release(sim, c, id);
  for (const j of haulsTo(sim, id)) destroyJob(sim, j);
  sim.world.remove(id, SalvageTripC);
  const o = sim.world.get(t.ship, SalvageOrderC);
  if (o) o.teamAt = sim.tick + sec(PAUSE_SEC);
  sim.events.emit({ type: 'salvage.teamHome', ship: t.ship, vehicle: id, reason: t.reason ?? 'done' });
}

function board(sim: Sim, id: number, t: SalvageTrip): void {
  const o = sim.world.get(t.ship, SalvageOrderC);
  // Off the team: the walk to the bay was called off (drafted away by the player, downed) before they got in.
  t.crew = t.crew.filter((c) => {
    const on = aboard(sim, c, id) || sim.world.get(c, EmbarkOrderC)?.vehicle === id;
    if (!on) release(sim, c, id);
    return on;
  });
  if (!o || o.block === 'hostile' || t.crew.length === 0) {
    t.reason ??= !o ? 'cancelled' : o.block === 'hostile' ? 'hostile' : 'noCrew';
    return endTrip(sim, id, t);
  }
  const late = t.timer > sec(BOARD_SEC);
  if (!late && t.crew.some((c) => !aboard(sim, c, id))) return;
  for (const c of t.crew.filter((c) => !aboard(sim, c, id))) release(sim, c, id); // could not get there in time
  t.crew = t.crew.filter((c) => aboard(sim, c, id));
  if (t.crew.length === 0) {
    t.reason = 'noCrew';
    return endTrip(sim, id, t);
  }
  sim.enqueue({ type: 'vehicle.hover', vehicle: id, ship: t.ship });
  go(t, 'fly');
}

function fly(sim: Sim, id: number, v: Vehicle, t: SalvageTrip): void {
  if (v.state === 'flying' && !v.dest && v.hover === t.ship) return go(t, 'work');
  const end = endReason(sim, id, t);
  if (end) return wrapUp(sim, id, t, end);
  if (t.timer > sec(FLIGHT_SEC)) return wrapUp(sim, id, t, 'lost');
  if (due(t) && (v.dest?.type !== 'hover' || v.dest.ship !== t.ship)) sim.enqueue({ type: 'vehicle.hover', vehicle: id, ship: t.ship });
}

/**
 * Keep the shuttle close to what is left of the wreck: as the hull comes apart its edge moves inward, so the hover point is worked out from the
 * live extent of the hull, and the shuttle shifts over (never while someone is floating to or from it). True while it holds station there.
 */
function keepClose(sim: Sim, id: number, v: Vehicle, t: SalvageTrip): boolean {
  if (v.dest?.type === 'hover' && v.dest.ship === t.ship) return false; // shifting over
  if (v.hover !== t.ship || v.dest) return false;
  if ((t.timer % REPEAT !== 0 && t.timer !== 1) || sim.world.query(EvaFloatC).some((c) => sim.world.get(c, EvaFloatC)?.vehicle === id)) return true;
  const body = sim.world.get(id, BodyC);
  const box = liveBox(sim, t.ship);
  const to = body && box && hoverPoint(sim, t.ship, vehicleDefOf(sim, v)?.eva?.hoverGap ?? 2, body, box);
  if (!body || !box || !to || Math.hypot(to.x - body.x, to.y - body.y) < 0.75) return true;
  v.hover = 0;
  v.dest = { type: 'hover', ship: t.ship, box };
  return false;
}

function work(sim: Sim, id: number, v: Vehicle, t: SalvageTrip): void {
  if (t.run && t.run.stage !== 'call') {
    // The shuttle is away with the hold: those left on the wreck work on (refilling at an airlock there, or waiting by the hull).
    const r = stepRun(sim, id, v, t, () => !!endReason(sim, id, t) && t.crew.every((c) => aboard(sim, c, id)));
    if (r === 'home') {
      t.reason ??= endReason(sim, id, t) ?? 'lost';
      if (t.crew.some((c) => !aboard(sim, c, id))) {
        // Never end a shift with someone out on the wreck (home bay gone, a leg that timed out): fly back and recall them first.
        t.run!.stage = 'back';
        t.run!.timer = 0;
        sim.enqueue({ type: 'vehicle.hover', vehicle: id, ship: t.ship });
        return;
      }
      delete t.run;
      return endTrip(sim, id, t);
    }
    for (const c of t.crew) if (!aboard(sim, c, id)) tendWorker(sim, c, t.ship, id, due(t));
    return;
  }
  const end = endReason(sim, id, t);
  if (end) {
    delete t.run;
    return wrapUp(sim, id, t, end);
  }
  const onStation = keepClose(sim, id, v, t);
  if (!onStation && !(v.dest?.type === 'hover' && v.dest.ship === t.ship) && outsideCrew(sim, id).length === 0) return go(t, 'fly'); // knocked off station
  if (t.run) stepRun(sim, id, v, t, () => false);
  else if (onStation && runDue(sim, id, t.ship, planCarry(sim, id, t.ship))) startRun(sim, id, t);
  const called = runCrew(t);
  for (const c of t.crew) {
    if (called.includes(c)) continue;
    if (aboard(sim, c, id)) {
      if (due(t) && onStation && !t.run) sendOut(sim, c, id);
    } else tendWorker(sim, c, t.ship, id, due(t));
  }
}

function recall(sim: Sim, id: number, v: Vehicle, t: SalvageTrip): void {
  keepClose(sim, id, v, t);
  const out = t.crew.filter((c) => !aboard(sim, c, id));
  if (out.length > 0 && t.timer <= sec(RECALL_SEC)) {
    for (const c of out) headBack(sim, c, t.ship, id, due(t));
    return;
  }
  for (const c of out) carryAboard(sim, c, id); // downed, boxed in, or cut off from the shuttle's side: the shuttle picks them up
  for (const j of haulsTo(sim, id)) destroyJob(sim, j);
  go(t, 'home');
  sim.enqueue({ type: 'vehicle.return', vehicle: id });
}

function home(sim: Sim, id: number, v: Vehicle, t: SalvageTrip): void {
  if (v.state === 'stowed') return endTrip(sim, id, t);
  if (t.timer > sec(FLIGHT_SEC * 2) || !v.home) {
    t.reason = 'lost'; // nowhere to land: the shuttle is left where it is
    return endTrip(sim, id, t);
  }
  if (due(t) && v.dest?.type !== 'bay') sim.enqueue({ type: 'vehicle.return', vehicle: id });
}

/**
 * Salvage teams (DESIGN.md "Salvaging derelicts", EVA work). For each running order without one, a shift starts (outside combat) when a
 * shuttle with suits is free in its bay on the home ship and crew are free and rested (else the order shows 'noShuttle' or 'noCrew'): a few
 * crew walk to the bay and climb in, the first in flies it to hover beside the wreck, and they all float over in the shuttle's suits. On the
 * hull they are ordinary crew: they take the wreck's stripping jobs and carry the loose scrap to the shuttle's staging tile as haul jobs into
 * its hold, so the floors are not held up. Low on air they refill at an airlock still standing on the wreck, or by floating back to the
 * shuttle and out again. When the hold is full with loot still lying about, one of them flies it home to unload and back (`cargoRun.ts`)
 * while the rest work on. The shift ends when the order is done (and its loot carried off), cancelled or blocked by something hostile, when
 * a fight starts, or when a member needs rest or food: the team floats back (anyone who cannot is carried aboard after a while), the shuttle
 * flies home, the team steps out at the bay and the cargo hauls unload the hold. Vehicle and crew orders go by command, applied next tick.
 * After the ferry system, beside the other shuttle runs.
 */
export function salvageTripSystem(sim: Sim): void {
  sweepOrphans(sim);
  for (const ship of [...sim.world.query(SalvageOrderC)].sort((a, b) => a - b)) {
    if (!tripFor(sim, ship) && (sim.tick + ship) % REPEAT === 0) startTrip(sim, ship, sim.world.get(ship, SalvageOrderC) as SalvageOrder);
  }
  for (const id of [...sim.world.query(SalvageTripC)].sort((a, b) => a - b)) {
    const t = sim.world.get(id, SalvageTripC) as SalvageTrip;
    const v = sim.world.get(id, VehicleC);
    t.timer++;
    for (const c of t.crew.filter((c) => !sim.world.has(c, CrewC) || sim.world.has(c, DeadC))) sim.world.remove(c, SalvageCrewC);
    t.crew = t.crew.filter((c) => sim.world.has(c, CrewC) && !sim.world.has(c, DeadC));
    if (!v) {
      t.reason = 'lost'; // the shuttle was destroyed: whoever is on the wreck stays there
      for (const c of t.crew) if (!sim.world.has(c, EvaFloatC)) handBack(sim, c);
      endTrip(sim, id, t);
      continue;
    }
    if (!shipById(sim, t.ship) && t.phase !== 'home' && t.phase !== 'board') wrapUp(sim, id, t, 'lost');
    switch (t.phase) {
      case 'board':
        board(sim, id, t);
        break;
      case 'fly':
        fly(sim, id, v, t);
        break;
      case 'work':
        work(sim, id, v, t);
        break;
      case 'recall':
        recall(sim, id, v, t);
        break;
      case 'home':
        home(sim, id, v, t);
        break;
    }
  }
}
