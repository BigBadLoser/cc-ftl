import { shipById } from '../combat/ships';
import { CrewC, DeadC } from '../crew/components';
import { EvaFloatC } from '../eva/components';
import { BodyC } from '../body';
import { outsideCrew } from '../eva/shuttle';
import { ItemStackC } from '../items/components';
import { spillItems, takeFromStack } from '../items/stacks';
import { isTileWalkable } from '../modules/walk';
import { shipGrid, shipIdAt } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { cargoAdd, cargoCount } from '../vehicles/cargo';
import { EmbarkOrderC, VehicleC, type Vehicle } from '../vehicles/components';
import { sendToEmbark } from '../vehicles/embark';
import { boardingTile, hoverPoint } from '../vehicles/geometry';
import { occupants, unboardCrew, vehicleDefOf } from '../vehicles/lifecycle';
import { SalvageCrewC, SalvageOrderC, SalvageTripC, type SalvageBlock, type SalvageOrder, type SalvageTrip, type SalvageTripEnd } from './components';
import { partCount, partsOf, salvageJobs } from './plan';
import { liveBox, needsHome, pickTeam, pickTeamShuttle, playerCrewOn, tripFor } from './team';
import { aboard, carryAboard, handBack, headBack, release, REPEAT, sendOut, tendWorker } from './teamCrew';

const sec = (n: number): number => n * TICK_HZ;
/** Seconds the team gets to reach the bay, the shuttle to reach the wreck, the team to float back, and the shuttle to get home. */
const BOARD_SEC = 60;
const FLIGHT_SEC = 240;
const RECALL_SEC = 90;
/** Seconds between hover swaps of loose loot into the hold, after a shift before the next one, and between looks for a shuttle or crew. */
const SWAP_SEC = 3;
const PAUSE_SEC = 10;
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

/** Loose loot lying on the wreck (delivery crates of station jobs excepted), lowest id first. */
function looseOn(sim: Sim, ship: number): number[] {
  return [...sim.world.query(ItemStackC)].filter((id) => {
    const st = sim.world.get(id, ItemStackC)!;
    return !st.job && shipIdAt(sim, st.x, st.y) === ship;
  }).sort((a, b) => a - b);
}

/** The hover swap: loose loot on the wreck goes straight into the hold while there is room (as a ferry's hover pickup does). */
function swapLoose(sim: Sim, vehicle: number, ship: number): void {
  for (const id of looseOn(sim, ship)) {
    const st = sim.world.get(id, ItemStackC)!;
    const { item, x, y } = st;
    const got = takeFromStack(sim, id, st.count);
    const fit = cargoAdd(sim, vehicle, item, got);
    if (fit < got) {
      spillItems(sim, ship, x, y, item, got - fit);
      return;
    }
  }
}

const holdFull = (sim: Sim, v: Vehicle): boolean => cargoCount(v) >= (vehicleDefOf(sim, v)?.cargo ?? 0);

/** Why the shift should end now, or undefined to keep working. */
function endReason(sim: Sim, v: Vehicle, t: SalvageTrip): SalvageTripEnd | undefined {
  const o = sim.world.get(t.ship, SalvageOrderC);
  if (!o) return 'cancelled';
  if (o.block === 'hostile') return 'hostile';
  if (t.crew.length === 0) return 'lost';
  if (finished(sim, t.ship, o)) return 'done';
  if (t.crew.some((c) => needsHome(sim, c))) return 'tired';
  if (holdFull(sim, v) && looseOn(sim, t.ship).length > 0) return 'full';
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

/** Start a shift for an order with no team: a free shuttle with suits and a few rested crew, who walk to its bay. */
function startTrip(sim: Sim, ship: number, o: SalvageOrder): void {
  if (o.status === 'blocked' && o.block === 'hostile') return;
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
  (sim.world.get(vehicle, VehicleC) as Vehicle).autopilot = true;
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
    v.autopilot = false;
  }
  for (const c of t.crew) release(sim, c, id);
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
  const end = endReason(sim, v, t);
  if (end && end !== 'full') return wrapUp(sim, id, t, end);
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
  if (t.timer % sec(SWAP_SEC) === 0) swapLoose(sim, id, t.ship);
  const end = endReason(sim, v, t);
  if (end) return wrapUp(sim, id, t, end);
  const onStation = keepClose(sim, id, v, t);
  if (!onStation && !(v.dest?.type === 'hover' && v.dest.ship === t.ship) && outsideCrew(sim, id).length === 0) return go(t, 'fly'); // knocked off station
  for (const c of t.crew) {
    if (aboard(sim, c, id)) {
      if (due(t) && onStation) sendOut(sim, c, id);
    } else tendWorker(sim, c, t.ship, id, due(t));
  }
}

function recall(sim: Sim, id: number, v: Vehicle, t: SalvageTrip): void {
  if (t.timer % sec(SWAP_SEC) === 0) swapLoose(sim, id, t.ship);
  keepClose(sim, id, v, t);
  const out = t.crew.filter((c) => !aboard(sim, c, id));
  if (out.length > 0 && t.timer <= sec(RECALL_SEC)) {
    for (const c of out) headBack(sim, c, t.ship, id, due(t));
    return;
  }
  for (const c of out) carryAboard(sim, c, id); // downed, boxed in, or cut off from the shuttle's side: the shuttle picks them up
  swapLoose(sim, id, t.ship);
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
 * Salvage teams (DESIGN.md "Salvaging derelicts", EVA work). For each running order without one, a shift starts when a shuttle with suits
 * is free in its bay and crew are free and rested (else the order shows 'noShuttle' or 'noCrew'): a few crew walk to the bay and climb in,
 * the shuttle flies itself to hover beside the wreck, and the team floats over in the shuttle's suits. On the hull they are ordinary crew
 * taking the wreck's stripping jobs; low on air they refill at an airlock still standing on the wreck, or by floating back to the shuttle
 * and out again. Meanwhile the hold takes the loose scrap off the wreck (a hover swap), so the floors are not held up. The shift ends when
 * the order is done, cancelled or blocked by something hostile, when a member needs rest or food, or when the hold is full with loot still
 * lying about: the team floats back (anyone who cannot is carried aboard after a while), the shuttle flies home, the team steps out at the
 * bay and the cargo hauls unload the hold into the ship's storage. Vehicle and crew orders go by command, applied next tick. After the
 * ferry system, beside the other shuttle runs.
 */
export function salvageTripSystem(sim: Sim): void {
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
