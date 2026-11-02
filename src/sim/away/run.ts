import { BodyC } from '../body';
import { shipById } from '../combat/ships';
import { CarriedC, CrewC, DeadC, DraftedC, JobC, PositionC, type Crew } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { abortTask, isCarrying } from '../ai/task';
import { EvaFloatC, SuitC } from '../eva/components';
import { hatchSpot, vehicleSuits } from '../eva/shuttle';
import { regionAirlock } from '../ferry/pick';
import { destroyJob } from '../items/stacks';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import { haulsTo, planCarry } from '../salvage/cargoRun';
import { liveBox } from '../salvage/team';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { AWAY_BOARD_MIN_SEC, AWAY_BOARD_WAIT_SEC, AWAY_LIFT_SEC, AWAY_TURNAROUND_SEC } from '../tuning';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { bayWorking, hoverPoint } from '../vehicles/geometry';
import { boardCrew, occupants, vehicleDefOf } from '../vehicles/lifecycle';
import { AwayC, AwaySiteC, SiteRunC, type SiteRun } from './components';
import { partyOut, unsafeMembers } from './depart';
import { boardPassengers, calledBack, dropPassages, freeSeats, letOut, passagesOf, postPassages } from './passage';

/** Ticks between repeats of an order the run keeps giving until it is obeyed. */
const REPEAT = 20;
const sec = (n: number): number => Math.round(n * TICK_HZ);
const due = (r: SiteRun): boolean => r.timer % REPEAT === 1;

function go(r: SiteRun, phase: SiteRun['phase']): void {
  r.phase = phase;
  r.timer = 0;
}

const hovering = (v: Vehicle, site: number): boolean => v.state === 'flying' && !v.dest && v.hover === site;

/** True once the shuttle is home: stowed in its bay, or docked at an airlock of its home ship (its bay is gone). */
function atHome(sim: Sim, v: Vehicle): boolean {
  return v.state === 'stowed' || (v.state === 'docked' && shipIdOf(sim, sim.world.get(v.dock, ModuleC)) === v.homeShip);
}

/** True while the site still wants workers: open, its ship there, and no fight in the node. */
function wanted(sim: Sim, site: number): boolean {
  return sim.world.get(site, AwaySiteC)?.status === 'open' && !!shipById(sim, site) && !sim.sector.inCombat;
}

/** Head for the site: hover beside it (undocking first). */
function flyTo(sim: Sim, id: number, v: Vehicle, r: SiteRun): void {
  if (!due(r) || (v.dest?.type === 'hover' && v.dest.ship === r.site)) return;
  if (v.state === 'docked') sim.enqueue({ type: 'vehicle.undock', vehicle: id });
  else sim.enqueue({ type: 'vehicle.hover', vehicle: id, ship: r.site });
}

/** Head home: the bay, else a free working airlock of the home ship (the bay is gone). */
function flyHome(sim: Sim, id: number, v: Vehicle, r: SiteRun): void {
  if (!due(r) || atHome(sim, v)) return;
  if (v.home && bayWorking(sim, v.home)) {
    if (v.dest?.type !== 'bay') sim.enqueue({ type: 'vehicle.return', vehicle: id });
    return;
  }
  const airlock = regionAirlock(sim, v.homeShip, id);
  if (airlock && v.dest?.type !== 'dock') sim.enqueue({ type: 'vehicle.dock', vehicle: id, airlock });
}

/**
 * Keep the shuttle close to what is left of the site (salvage's rule): the hover point is worked out from the live extent of the hull, and the
 * shuttle shifts over while nobody floats to or from it. True while it holds station there.
 */
function keepClose(sim: Sim, id: number, v: Vehicle, r: SiteRun): boolean {
  if (!hovering(v, r.site)) return false;
  if ((r.timer % REPEAT !== 0 && r.timer !== 1) || sim.world.query(EvaFloatC).some((c) => sim.world.get(c, EvaFloatC)?.vehicle === id)) return true;
  const body = sim.world.get(id, BodyC);
  const box = liveBox(sim, r.site);
  const to = body && box && hoverPoint(sim, r.site, vehicleDefOf(sim, v)?.eva?.hoverGap ?? 2, body, box);
  if (!body || !box || !to || Math.hypot(to.x - body.x, to.y - body.y) < 0.75) return true;
  v.hover = 0;
  v.dest = { type: 'hover', ship: r.site, box };
  return false;
}

/** Party members sent out of the hatch who have landed are handed to the crew AI: free to work, the suit theirs (the shuttle may leave). */
function handOver(sim: Sim, vehicle: number): void {
  for (const c of sim.world.query(AwayC, PositionC)) {
    const away = sim.world.get(c, AwayC)!;
    if (away.vehicle !== vehicle || !away.landing || sim.world.has(c, EvaFloatC)) continue;
    delete away.landing;
    const suit = sim.world.get(c, SuitC);
    if (suit?.vehicle === vehicle) delete suit.vehicle;
    if (sim.world.get(c, DraftedC)?.target === null && sim.world.remove(c, DraftedC)) (sim.world.get(c, CrewC) as Crew).activity = 'idle';
  }
}

/** Take a party member aboard where they are (downed, or still out when a closing site gives up waiting): the suit goes back into stock. */
function lift(sim: Sim, c: number, vehicle: number): void {
  const v = sim.world.get(vehicle, VehicleC);
  if (!v || occupants(v).length >= (vehicleDefOf(sim, v)?.capacity ?? 0) + 1) return;
  if (isCarrying(sim, c)) abortTask(sim, c, 'halted'); // a patient in hand is set down first (lifted on their own)
  sim.world.remove(c, EvaFloatC);
  if (sim.world.remove(c, SuitC)) v.suits = vehicleSuits(sim, v) + 1;
  boardCrew(sim, c, vehicle);
  const away = sim.world.get(c, AwayC);
  if (away) {
    away.home = true;
    delete away.landing;
  }
}

function endRun(sim: Sim, id: number, r: SiteRun, reason: 'closed' | 'lost'): void {
  dropPassages(sim, id);
  for (const j of haulsTo(sim, id)) destroyJob(sim, j);
  const v = sim.world.get(id, VehicleC);
  if (v) v.autopilot = false;
  for (const c of sim.world.query(AwayC)) if (sim.world.get(c, AwayC)?.vehicle === id) sim.world.remove(c, AwayC);
  sim.world.remove(id, SiteRunC);
  if (sim.world.get(r.site, AwaySiteC)?.vehicle === id) sim.world.remove(r.site, AwaySiteC);
  sim.events.emit({ type: 'away.closed', ship: r.site, vehicle: id, reason });
}

/** At home: passengers board, the passages follow the free seats, and the shuttle leaves when its passengers are in. */
function board(sim: Sim, id: number, v: Vehicle, r: SiteRun): void {
  const want = wanted(sim, r.site);
  const out = partyOut(sim, id);
  boardPassengers(sim, id, r.site);
  const home = v.homeShip;
  letOut(sim, id, (c) => !want || calledBack(sim, c, home)); // an emergency at home they rank above their passage: they step out again
  postPassages(sim, id, r.site, want);
  const aboard = occupants(v).filter((c) => sim.world.has(c, AwayC));
  const site = sim.world.get(r.site, AwaySiteC);
  if (site) {
    if (want && aboard.length === 0 && out.length === 0 && r.timer > sec(AWAY_BOARD_WAIT_SEC)) site.block = 'noCrew';
    else delete site.block;
  }
  if (!want && out.length === 0) {
    if (!shipById(sim, r.site) || site?.status !== 'open' || !site) endRun(sim, id, r, 'closed');
    return; // a fight: wait at home
  }
  // Someone holds a passage and is still walking to the bay.
  const enRoute = passagesOf(sim, id).some((j) => (sim.world.get(j, JobC)?.reservedBy ?? 0) !== 0);
  if (aboard.length > 0) r.boardedAt ??= sim.tick;
  const waited = r.boardedAt === undefined ? 0 : sim.tick - r.boardedAt;
  let leave: boolean;
  // Part of the party is still out: the stop is short (the departure check counted on AWAY_TURNAROUND_SEC at most).
  if (out.length > 0) leave = r.timer >= sec(AWAY_TURNAROUND_SEC) || (r.timer >= sec(AWAY_BOARD_MIN_SEC) && !enRoute) || freeSeats(sim, v) === 0;
  else if (aboard.length === 0) leave = false;
  else leave = waited >= sec(AWAY_BOARD_WAIT_SEC) || (waited >= sec(AWAY_BOARD_MIN_SEC) && !enRoute) || freeSeats(sim, v) === 0;
  if (!leave) return;
  dropPassages(sim, id);
  v.autopilot = true;
  delete r.boardedAt;
  go(r, 'fly');
  sim.events.emit({ type: 'away.departed', ship: r.site, vehicle: id, crew: [...aboard], home: false });
}

/** On the way to the site. A site gone meanwhile ends the run at home. */
function fly(sim: Sim, id: number, v: Vehicle, r: SiteRun): void {
  if (!shipById(sim, r.site)) {
    r.ending = true;
    return go(r, 'home');
  }
  if (hovering(v, r.site)) return go(r, 'stay');
  flyTo(sim, id, v, r);
}

/**
 * Beside the site. Landed passengers are handed over, the rest sent out of the hatch; a downed member is lifted aboard; loose loot is
 * hauled into the hold. Anyone aboard who came back to go home starts a trip, which leaves only through the departure check
 * (`unsafeMembers`): if a member staying out would not be safe it waits (slice 2b adds the last call and riders).
 */
function stay(sim: Sim, id: number, v: Vehicle, r: SiteRun): void {
  if (!wanted(sim, r.site)) return go(r, 'recall');
  const onStation = keepClose(sim, id, v, r);
  if (!hovering(v, r.site) && !(v.dest?.type === 'hover' && v.dest.ship === r.site)) return go(r, 'fly'); // knocked off station
  handOver(sim, id);
  for (const c of partyOut(sim, id)) if (isIncapacitated(sim, c) && !sim.world.has(c, CarriedC)) lift(sim, c, id);
  if (!onStation || !hatchSpot(sim, id)) return;
  planCarry(sim, id, r.site);
  const aboard = occupants(v).filter((c) => sim.world.has(c, AwayC));
  const going = aboard.filter((c) => sim.world.get(c, AwayC)?.home);
  if (!due(r)) return;
  for (const c of aboard) {
    const away = sim.world.get(c, AwayC)!;
    if (away.home) continue; // (a `landing` still aboard: the last eva.out was refused; it is asked again)
    away.landing = true;
    sim.enqueue({ type: 'eva.out', vehicle: id, crew: c });
  }
  if (going.length === 0 || unsafeMembers(sim, id).length > 0) return;
  for (const j of haulsTo(sim, id)) destroyJob(sim, j); // a load on its way to the hold is set down; it waits for the next trip
  r.lastTrip = sim.tick;
  go(r, 'home');
  sim.events.emit({ type: 'away.departed', ship: r.site, vehicle: id, crew: [...aboard], home: true });
}

/** Everyone is called aboard (the site closes, is gone, or a fight started); after AWAY_LIFT_SEC whoever is still out is lifted. */
function recall(sim: Sim, id: number, v: Vehicle, r: SiteRun): void {
  keepClose(sim, id, v, r);
  handOver(sim, id);
  const out = partyOut(sim, id);
  const gone = !shipById(sim, r.site);
  if (out.length > 0 && !gone && r.timer <= sec(AWAY_LIFT_SEC)) {
    for (const c of out) if (isIncapacitated(sim, c) && !sim.world.has(c, CarriedC)) lift(sim, c, id);
    return;
  }
  // Carriers first: a patient in hand is set down, then lifted on their own.
  for (const c of [...out.filter((c) => isCarrying(sim, c)), ...out.filter((c) => !isCarrying(sim, c))]) lift(sim, c, id);
  if (sim.world.query(EvaFloatC).some((c) => sim.world.get(c, EvaFloatC)?.vehicle === id)) return;
  for (const j of haulsTo(sim, id)) destroyJob(sim, j);
  if (gone || sim.world.get(r.site, AwaySiteC)?.status !== 'open') r.ending = true;
  go(r, 'home');
  sim.events.emit({ type: 'away.departed', ship: r.site, vehicle: id, crew: occupants(v).filter((c) => sim.world.has(c, AwayC)), home: true });
}

/** Flying home; there those aboard step out (leaving the party) and the run boards again, or ends with the site. */
function homeLeg(sim: Sim, id: number, v: Vehicle, r: SiteRun): void {
  if (!atHome(sim, v)) return flyHome(sim, id, v, r);
  const back = occupants(v).filter((c) => sim.world.has(c, AwayC));
  if (back.length > 0 && !letOut(sim, id)) return; // the bay's tile is blocked: try again
  if (back.length > 0) sim.events.emit({ type: 'away.returned', ship: r.site, vehicle: id, crew: back });
  if (r.ending && partyOut(sim, id).length === 0) return endRun(sim, id, r, 'closed');
  go(r, 'board');
}

/**
 * Away sites (docs/DESIGN.md "Away sites", #286 slice 2a). Each site's shuttle runs on its own (autopilot, like ferry runs): at home it
 * offers passages and takes its passengers to the site, hovers there as their air source and the hold for loose loot, brings home anyone
 * who comes back aboard (through the departure check, so nobody staying out is stranded), and when the site closes or a fight starts calls
 * the party in and flies them home. Crew on the site are ordinary crew: the scheduler gives them its jobs, the air drive refills them, the
 * return drive takes them aboard. Vehicle orders go by command, applied next tick. After the salvage teams, beside the other shuttle runs.
 */
export function awaySystem(sim: Sim): void {
  // A party member whose run is gone (the shuttle destroyed) leaves the party where they are (slice 2b: pickup runs).
  for (const c of [...sim.world.query(AwayC)].sort((a, b) => a - b)) {
    const away = sim.world.get(c, AwayC)!;
    if (sim.world.get(away.vehicle, SiteRunC) && !sim.world.has(c, DeadC)) continue;
    sim.world.remove(c, AwayC);
  }
  for (const site of [...sim.world.query(AwaySiteC)].sort((a, b) => a - b)) {
    const s = sim.world.get(site, AwaySiteC)!;
    if (sim.world.get(s.vehicle, SiteRunC)?.site === site) continue;
    sim.world.remove(site, AwaySiteC);
    sim.events.emit({ type: 'away.closed', ship: site, vehicle: s.vehicle, reason: 'lost' });
  }
  for (const id of [...sim.world.query(SiteRunC)].sort((a, b) => a - b)) {
    const r = sim.world.get(id, SiteRunC) as SiteRun;
    const v = sim.world.get(id, VehicleC);
    if (!v) continue;
    r.timer++;
    switch (r.phase) {
      case 'board':
        board(sim, id, v, r);
        break;
      case 'fly':
        fly(sim, id, v, r);
        break;
      case 'stay':
        stay(sim, id, v, r);
        break;
      case 'recall':
        recall(sim, id, v, r);
        break;
      case 'home':
        homeLeg(sim, id, v, r);
        break;
    }
  }
}
