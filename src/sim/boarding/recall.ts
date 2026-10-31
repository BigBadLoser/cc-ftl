import { shipById } from '../combat/ships';
import { AirlockC, airlockWorking } from '../modules/airlock';
import { ModuleC } from '../modules/components';
import { CrewC, DeadC, DraftedC, PositionC } from '../crew/components';
import { clearPath, isIncapacitated, origin } from '../crew/helpers';
import { planWalk } from '../eva/route';
import { abortTask } from '../ai/task';
import { AllegianceC } from '../fight/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { RECALL_BOARD_TICKS } from '../tuning';
import { AboardC, EmbarkOrderC, VehicleC, type Vehicle } from '../vehicles/components';
import { sendToEmbark } from '../vehicles/embark';
import { bayWorking, boardingTile } from '../vehicles/geometry';
import { dockError } from '../vehicles/handlers';
import { occupants, vehicleDefOf, vehicleFaction } from '../vehicles/lifecycle';
import { cancelSabotage } from './sabotage';
import { RecallC, type Recall } from './components';

/** Ticks after a flight order before a shuttle that has no destination and is not home counts as stalled. */
const STALL_TICKS = 4;
/** Ticks the party gets to step out at home before the recall gives up and leaves them aboard. */
const LANDING_TICKS = 40;

/** The first free, working airlock of the vehicle's home ship it could dock at, or 0. */
function homeAirlock(sim: Sim, vehicle: number, v: Vehicle): number {
  for (const mid of sim.world.query(AirlockC)) {
    const m = sim.world.get(mid, ModuleC);
    if (m && shipIdOf(sim, m) === v.homeShip && airlockWorking(sim, mid) && !dockError(sim, vehicle, mid)) return mid;
  }
  return 0;
}

/** Can the shuttle get home: its bay works, or a home airlock is free? */
function canGoHome(sim: Sim, id: number, v: Vehicle): boolean {
  return bayWorking(sim, v.home) || homeAirlock(sim, id, v) !== 0;
}

/**
 * `crew.recall`: send player crew standing on hostile ships back to the shuttle docked there. Each crew member is seated in a
 * docked player shuttle on their ship (lowest vehicle id first, as many as it has free seats), walks to it (`vehicle.embark`'s
 * helper) and the recall system flies it home. Returns a reject reason when nobody could be sent; members that could not go (no
 * seat, no path) are reported with `crew.recallFailed` and stay where they are.
 */
export function orderRecall(sim: Sim, ids: readonly number[]): string | null {
  const failed = new Map<string, number[]>();
  const left: { crew: number; reason: string }[] = [];
  const fail = (reason: string, crew: number): void => {
    (failed.get(reason) ?? failed.set(reason, []).get(reason)!).push(crew);
    left.push({ crew, reason });
  };
  const seats = new Map<number, number>();
  const party = new Map<number, number[]>();
  const shuttles = (shipId: number): number[] =>
    sim.world.query(VehicleC).filter((id) => {
      const v = sim.world.get(id, VehicleC) as Vehicle;
      return v.state === 'docked' && vehicleFaction(sim, v) === 'player' && shipIdOf(sim, sim.world.get(v.dock, ModuleC)) === shipId && !sim.world.has(id, RecallC);
    });
  let first: string | null = null;
  for (const crew of [...ids].sort((a, b) => a - b)) {
    const pos = sim.world.get(crew, PositionC);
    if (!sim.world.has(crew, CrewC) || !pos || sim.world.has(crew, DeadC)) { first ??= 'noCrew'; continue; }
    if (isIncapacitated(sim, crew)) { first ??= 'incapacitated'; fail('incapacitated', crew); continue; }
    const shipId = shipIdOf(sim, pos);
    const ship = shipById(sim, shipId);
    if (sim.world.get(crew, AllegianceC)?.faction !== 'player' || !ship || ship.faction === 'player') { first ??= 'notAboard'; fail('notAboard', crew); continue; }
    const list = shuttles(shipId);
    if (list.length === 0) { first ??= 'noShuttle'; fail('noShuttle', crew); continue; }
    // The first docked shuttle this member can really use: it can go home, has a free seat, and its boarding tile is open and reachable.
    let err: string | null = null;
    let seat = 0;
    for (const sid of list) {
      const v = sim.world.get(sid, VehicleC) as Vehicle;
      if (!canGoHome(sim, sid, v)) { err ??= 'noHome'; continue; }
      const free = seats.get(sid) ?? (vehicleDefOf(sim, v)?.capacity ?? 0) + 1 - occupants(v).length;
      seats.set(sid, free);
      if (free <= 0) { err ??= 'full'; continue; }
      const at = boardingTile(sim, sid);
      if (!at) { err ??= 'notBoardable'; continue; }
      if (!airlockWorking(sim, v.dock)) { err ??= 'airlockDown'; continue; }
      const o = origin(pos);
      if (!(o.x === at.x && o.y === at.y) && !planWalk(sim, crew, shipId, o, { x: at.x, y: at.y, adjacent: false })) { err ??= 'unreachable'; continue; }
      cancelSabotage(sim, [crew]);
      abortTask(sim, crew, 'order');
      const refused = sendToEmbark(sim, crew, sid);
      if (refused) { err ??= refused; continue; }
      seat = sid;
      break;
    }
    if (!seat) { first ??= err ?? 'full'; fail(err ?? 'full', crew); continue; }
    seats.set(seat, (seats.get(seat) ?? 1) - 1);
    (party.get(seat) ?? party.set(seat, []).get(seat)!).push(crew);
  }
  for (const [reason, crew] of failed) sim.events.emit({ type: 'crew.recallFailed', vehicle: 0, crew, reason });
  let reported = false;
  for (const [sid, crew] of party) {
    const v = sim.world.get(sid, VehicleC) as Vehicle;
    const ship = shipIdOf(sim, sim.world.get(v.dock, ModuleC));
    sim.world.add(sid, RecallC, { ship, crew, state: 'boarding', since: sim.tick });
    sim.events.emit({ type: 'crew.recallStarted', vehicle: sid, ship, crew: [...crew], left: reported ? [] : left });
    reported = true; // the members left behind are listed once, on the first shuttle's event
  }
  return party.size > 0 ? null : (first ?? 'noCrew');
}

/** Give up a recall: the vehicle forgets it; `reason` is reported with the members still listed. */
function giveUp(sim: Sim, id: number, crew: number[], reason: string): void {
  sim.world.remove(id, RecallC);
  sim.events.emit({ type: 'crew.recallFailed', vehicle: id, crew, reason });
}

const aboard = (sim: Sim, c: number, vehicle: number): boolean => sim.world.get(c, AboardC)?.vehicle === vehicle;

/** Step the party out of a shuttle (named, so a pilot leaves the controls too). */
function disembarkAll(sim: Sim, id: number, crew: readonly number[]): void {
  for (const c of crew) if (aboard(sim, c, id)) sim.enqueue({ type: 'vehicle.disembark', vehicle: id, crew: c });
}

/** Issue the flight home: stow in the bay, or dock at a home airlock when the bay is down. */
function fly(sim: Sim, id: number, v: Vehicle, rc: Recall): boolean {
  if (bayWorking(sim, v.home)) {
    sim.enqueue({ type: 'vehicle.return', vehicle: id });
  } else {
    const airlock = homeAirlock(sim, id, v);
    if (!airlock) return false;
    if (v.state === 'docked') {
      sim.enqueue({ type: 'vehicle.undock', vehicle: id });
      rc.state = 'undocking';
      rc.since = sim.tick;
      return true;
    }
    sim.enqueue({ type: 'vehicle.dock', vehicle: id, airlock });
  }
  rc.state = 'flying';
  rc.since = sim.tick;
  return true;
}

/**
 * The recall flow, one vehicle at a time, issuing the same vehicle commands the player (and the enemy boarding doctrine) use:
 * the party walks to the docked shuttle and climbs in; the shuttle (the first aboard pilots) is sent home with `vehicle.return`
 * (stow in the bay) or, bay down, `vehicle.undock` and `vehicle.dock` at a home airlock; once home the party steps out with
 * `vehicle.disembark`. Failures are `crew.recallFailed` events and leave the party where they are: no shuttle or path, members
 * that fall out or arrive too late (RECALL_BOARD_TICKS), a shuttle that cannot leave (the party steps back out onto the hostile
 * ship), or one that stalls on the way (they stay aboard, hovering).
 */
export function recallSystem(sim: Sim): void {
  for (const id of sim.world.query(RecallC)) {
    const rc = sim.world.get(id, RecallC)!;
    const v = sim.world.get(id, VehicleC);
    if (!v) {
      sim.world.remove(id, RecallC);
      continue;
    }
    if (rc.state === 'boarding') boarding(sim, id, v, rc);
    else if (rc.state === 'undocking') {
      if (v.state === 'flying') {
        const airlock = homeAirlock(sim, id, v);
        if (airlock) {
          sim.enqueue({ type: 'vehicle.dock', vehicle: id, airlock });
          rc.state = 'flying';
          rc.since = sim.tick;
        } else giveUp(sim, id, rc.crew.filter((c) => aboard(sim, c, id)), 'noHome');
      } else if (sim.tick - rc.since >= STALL_TICKS) stalled(sim, id, v, rc);
    } else if (rc.state === 'flying') {
      const home = v.state === 'stowed' || (v.state === 'docked' && shipIdOf(sim, sim.world.get(v.dock, ModuleC)) === v.homeShip);
      if (home) {
        rc.state = 'landing';
        rc.since = sim.tick;
        disembarkAll(sim, id, rc.crew);
      } else if (v.dest === null && sim.tick - rc.since >= STALL_TICKS) stalled(sim, id, v, rc);
    } else {
      const left = rc.crew.filter((c) => aboard(sim, c, id));
      if (left.length === 0) {
        sim.world.remove(id, RecallC);
        sim.events.emit({ type: 'crew.recalled', vehicle: id, crew: rc.crew.filter((c) => sim.world.has(c, PositionC)) });
      } else if (sim.tick - rc.since >= LANDING_TICKS) giveUp(sim, id, left, 'cannotDisembark');
      else disembarkAll(sim, id, left);
    }
  }
}

/** The flight did not start or has no destination: try once more, then give up (aboard the shuttle if it left, else back out on the hostile ship). */
function stalled(sim: Sim, id: number, v: Vehicle, rc: Recall): void {
  const party = rc.crew.filter((c) => aboard(sim, c, id));
  if (!rc.retried && v.state !== 'docked') {
    rc.retried = true;
    if (fly(sim, id, v, rc)) return;
  }
  if (v.state === 'docked') disembarkAll(sim, id, party); // never left: the party steps back out where they came in
  giveUp(sim, id, party, v.state === 'docked' ? 'cannotLeave' : 'stranded');
}

function boarding(sim: Sim, id: number, v: Vehicle, rc: Recall): void {
  const live: number[] = [];
  const dropped: number[] = [];
  for (const c of rc.crew) {
    const ok = sim.world.has(c, CrewC) && !sim.world.has(c, DeadC);
    if (ok && (aboard(sim, c, id) || sim.world.get(c, EmbarkOrderC)?.vehicle === id)) live.push(c);
    else dropped.push(c);
  }
  if (dropped.length) sim.events.emit({ type: 'crew.recallFailed', vehicle: id, crew: dropped.filter((c) => sim.world.has(c, CrewC) && !sim.world.has(c, DeadC)), reason: 'lost' });
  rc.crew = live;
  if (v.state !== 'docked') {
    for (const c of live) sim.world.remove(c, EmbarkOrderC);
    return giveUp(sim, id, live, 'shuttleGone');
  }
  const waiting = live.filter((c) => !aboard(sim, c, id));
  if (waiting.length > 0 && sim.tick - rc.since < RECALL_BOARD_TICKS) return;
  if (waiting.length > 0) {
    for (const c of waiting) {
      sim.world.remove(c, EmbarkOrderC);
      const drafted = sim.world.get(c, DraftedC);
      if (drafted) drafted.target = null; // too late: they stop where they are
      clearPath(sim, c);
    }
    sim.events.emit({ type: 'crew.recallFailed', vehicle: id, crew: waiting, reason: 'late' });
    rc.crew = live.filter((c) => aboard(sim, c, id));
  }
  if (rc.crew.length === 0) return giveUp(sim, id, [], 'noOneAboard');
  if (!fly(sim, id, v, rc)) {
    disembarkAll(sim, id, rc.crew);
    giveUp(sim, id, rc.crew, 'noHome');
  }
}
