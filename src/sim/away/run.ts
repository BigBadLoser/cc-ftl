import { shipById } from '../combat/ships';
import { CrewC, DeadC, JobC, PositionC } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { AllegianceC } from '../fight/components';
import { shipIdOf } from '../regions';
import { regionAirlock } from '../ferry/pick';
import type { Sim } from '../sim';
import { AWAY_BOARD_MIN_SEC, AWAY_BOARD_WAIT_SEC, AWAY_INVITE_WAIT_SEC, AWAY_LIFT_SEC, AWAY_TURNAROUND_SEC } from '../tuning';
import { cargoCount } from '../vehicles/cargo';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { bayWorking } from '../vehicles/geometry';
import { dockError } from '../vehicles/handlers';
import { AwayC, AwaySiteC, SiteRunC, type SiteRun } from './components';
import { endRun } from './end';
import { planCarry } from './haul';
import { stagedStacks } from '../items/staging';
import { releaseOwned } from './owned';
import { partyOut } from './depart';
import { boardPassengers, calledBack, dropPassages, endInvites, freeSeats, letOut, passagesOf, postPassages } from './passage';
import { atHome, atSite, due, go, hovering, sec, wanted } from './phase';
import { boxAround, replaceLostShuttles, startPickupRuns } from './pickup';
import { depart, lift, recall, stay } from './site';
import { mustTurnBack, partyAboard, settled } from './trips';

/**
 * Head for the site: dock at a free working airlock of it if it has one (passengers step out there), else hover beside it (they go out of
 * the hatch); a pickup always hovers, beside the crew member it fetches. Undocks first.
 */
function flyTo(sim: Sim, id: number, v: Vehicle, r: SiteRun, fetch: number): void {
  if (!due(r)) return;
  if (v.state === 'docked') return sim.enqueue({ type: 'vehicle.undock', vehicle: id });
  const want = sim.world.get(r.site, AwaySiteC)?.dock ?? 0;
  const lock = fetch ? 0 : want && dockError(sim, id, want) === null ? want : regionAirlock(sim, r.site, id);
  if (lock) {
    if (v.dest?.type !== 'dock' || v.dest.airlock !== lock) sim.enqueue({ type: 'vehicle.dock', vehicle: id, airlock: lock });
    return;
  }
  if (v.dest?.type === 'hover' && v.dest.ship === r.site) return;
  const box = fetch ? boxAround(sim, fetch) : null;
  sim.enqueue(box ? { type: 'vehicle.hover', vehicle: id, ship: r.site, box } : { type: 'vehicle.hover', vehicle: id, ship: r.site });
}

/** Head home: the bay, else a free working airlock of the home ship (the bay is gone). Undocks from a site's airlock first. */
function flyHome(sim: Sim, id: number, v: Vehicle, r: SiteRun): void {
  if (!due(r) || atHome(sim, v)) return;
  if (v.home && bayWorking(sim, v.home)) {
    if (v.dest?.type !== 'bay') sim.enqueue({ type: 'vehicle.return', vehicle: id });
    return;
  }
  if (v.state === 'docked') return sim.enqueue({ type: 'vehicle.undock', vehicle: id });
  const airlock = regionAirlock(sim, v.homeShip, id);
  if (airlock && v.dest?.type !== 'dock') sim.enqueue({ type: 'vehicle.dock', vehicle: id, airlock });
}

/**
 * At home: those aboard for home have stepped out; passengers board, the passages follow the free seats, the hold is unloaded, and the
 * shuttle leaves once its passengers are in (or the wait is over). With part of the party out the stop is short: AWAY_TURNAROUND_SEC at
 * most, and it leaves at once when the watch says so (`mustTurnBack`).
 */
function board(sim: Sim, id: number, v: Vehicle, r: SiteRun): void {
  const want = wanted(sim, r.site);
  const out = partyOut(sim, id);
  boardPassengers(sim, id, r.site);
  const home = v.homeShip;
  letOut(sim, id, (c) => !want || calledBack(sim, c, home)); // an emergency at home they rank above their passage: they step out again
  postPassages(sim, id, r.site, want);
  const aboard = partyAboard(sim, v);
  const site = sim.world.get(r.site, AwaySiteC);
  if (r.timer === 1) r.held = cargoCount(v);
  // Loot staged at the site and nobody going: the shuttle fetches it alone (loading needs no crew), once nobody is on the way to a seat.
  const cargoRun = want && aboard.length === 0 && out.length === 0 && stagedStacks(sim, r.site).length > 0;
  // A named party that has not come by AWAY_INVITE_WAIT_SEC: those not aboard stay home (with someone aboard the general wait below rules).
  if (site?.invited && aboard.length === 0 && r.timer >= sec(AWAY_INVITE_WAIT_SEC)) endInvites(sim, id, r.site);
  if (site) {
    if (want && aboard.length === 0 && out.length === 0 && !cargoRun && !site.invited && r.timer > sec(AWAY_BOARD_WAIT_SEC)) site.block = 'noCrew';
    else if (site.block === 'noCrew') delete site.block;
  }
  if (!want && out.length === 0) {
    if (!shipById(sim, r.site) || site?.status !== 'open' || !site) endRun(sim, id, r, 'closed');
    return; // a fight: wait at home
  }
  // Someone holds a passage and is still walking to the bay; the hold is still being emptied.
  const enRoute = passagesOf(sim, id).some((j) => (sim.world.get(j, JobC)?.reservedBy ?? 0) !== 0);
  const unloading = cargoCount(v) > 0 && r.timer < sec(AWAY_TURNAROUND_SEC);
  if (aboard.length > 0) r.boardedAt ??= sim.tick;
  const waited = r.boardedAt === undefined ? 0 : sim.tick - r.boardedAt;
  let leave: boolean;
  if (out.length > 0) {
    leave = mustTurnBack(sim, id, v, r) || r.timer >= sec(AWAY_TURNAROUND_SEC) || (r.timer >= sec(AWAY_BOARD_MIN_SEC) && !enRoute && !unloading) || (freeSeats(sim, v) === 0 && !unloading);
  } else if (aboard.length === 0) leave = cargoRun && !enRoute && !unloading && (passagesOf(sim, id).length === 0 || r.timer >= sec(AWAY_BOARD_WAIT_SEC));
  else leave = waited >= sec(AWAY_BOARD_WAIT_SEC) || (waited >= sec(AWAY_BOARD_MIN_SEC) && !enRoute && !unloading) || (freeSeats(sim, v) === 0 && !unloading);
  if (!leave) return;
  // The hold could not be emptied at all: no room at home (the loot waits on the site; the panel shows it).
  if (site && (r.held ?? 0) > 0 && cargoCount(v) >= (r.held ?? 0)) site.block = 'noRoom';
  else if (site?.block === 'noRoom') delete site.block;
  delete r.held;
  endInvites(sim, id, r.site);
  dropPassages(sim, id);
  v.autopilot = true;
  delete r.boardedAt;
  go(r, 'fly');
  sim.events.emit({ type: 'away.departed', ship: r.site, vehicle: id, crew: [...aboard], home: false });
  // Nobody able is left aboard the home ship: a line in the ship's log (the player may want some cover kept back).
  const left = sim.world.query(CrewC, PositionC).some((c) => !isIncapacitated(sim, c) && !sim.world.has(c, DeadC) && sim.world.get(c, AllegianceC)?.faction === 'player' && shipIdOf(sim, sim.world.get(c, PositionC)!) === home);
  if (!left && aboard.length > 0) sim.events.emit({ type: 'away.homeEmpty', ship: home, site: r.site });
}

/** On the way to the site (or to the crew member a pickup run fetches). A site gone meanwhile ends the run at home. */
function fly(sim: Sim, id: number, v: Vehicle, r: SiteRun): void {
  if (!shipById(sim, r.site)) {
    r.ending = true;
    return go(r, 'home');
  }
  if (atSite(sim, v, r.site)) {
    r.lastTrip = sim.tick;
    return go(r, r.pickup ? 'pickup' : 'stay');
  }
  flyTo(sim, id, v, r, r.pickup ?? 0);
}

/** Flying home (watched: back at once if a worker left out needs it); there those aboard step out and the run boards again, or ends. */
function homeLeg(sim: Sim, id: number, v: Vehicle, r: SiteRun): void {
  if (!atHome(sim, v)) {
    if (!r.ending && due(r) && mustTurnBack(sim, id, v, r)) return go(r, 'fly');
    return flyHome(sim, id, v, r);
  }
  // Riders stay aboard for the way back (unless the run ends).
  const back = partyAboard(sim, v).filter((c) => r.ending || !sim.world.get(c, AwayC)?.ride);
  if (back.length > 0 && !letOut(sim, id, (c) => back.includes(c))) return; // the bay's tile is blocked: try again
  if (back.length > 0) sim.events.emit({ type: 'away.returned', ship: r.site, vehicle: id, crew: back });
  if (r.ending && partyOut(sim, id).length === 0) return endRun(sim, id, r, 'closed');
  go(r, 'board');
}

/**
 * A pickup run beside the requester's grid: it holds station by them until they come aboard (the return drive), lifting them after
 * AWAY_LIFT_SEC if they cannot; then home, where the run ends. Given up when they are gone or dead, or when it has no seat for them
 * (the request is then free for another shuttle).
 */
function pickup(sim: Sim, id: number, v: Vehicle, r: SiteRun): void {
  const c = r.pickup ?? 0;
  const out = partyOut(sim, id).includes(c) && !sim.world.has(c, DeadC);
  if (out && freeSeats(sim, v) === 0) {
    // No seat for them after all (filled meanwhile): give the request up so another shuttle can take it, and go home.
    sim.world.remove(c, AwayC);
    r.ending = true;
    return go(r, 'home');
  }
  if (out && !hovering(v, r.site) && !(v.dest?.type === 'hover' && v.dest.ship === r.site)) return go(r, 'fly');
  if (out && r.timer > sec(AWAY_LIFT_SEC) && settled(sim, id, v)) lift(sim, c, id);
  if (partyOut(sim, id).length > 0 || !settled(sim, id, v)) return;
  r.ending = true;
  go(r, 'home');
}

/**
 * Away sites (docs/DESIGN.md "Away sites", #286). Each site's shuttle runs on its own (autopilot, like ferry runs): at home it offers
 * passages and takes its passengers to the site; there it docks or hovers as their air source and the hold for loose loot, and brings
 * home those who come back aboard in batched round trips that leave only through the departure check (last call, riders), watched while
 * away so nobody staying out is stranded. When the site closes or a fight starts it calls the party in and flies them home. Pickup runs
 * fetch crew out of air reach; a site whose shuttle is lost gets another. Crew on the site are ordinary crew: the scheduler gives them its
 * jobs, the air drive refills them, the return drive takes them aboard. Vehicle orders go by command, applied next tick.
 */
export function awaySystem(sim: Sim): void {
  replaceLostShuttles(sim);
  startPickupRuns(sim);
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
      case 'depart':
        depart(sim, id, v, r);
        break;
      case 'recall':
        recall(sim, id, v, r);
        break;
      case 'home':
        homeLeg(sim, id, v, r);
        break;
      case 'pickup':
        pickup(sim, id, v, r);
        break;
    }
  }
  // Staging goes on whether the shuttle is at the site or away: the party hauls loose loot into the zone (away/haul.ts).
  for (const ship of [...sim.world.query(AwaySiteC)].sort((a, b) => a - b)) if (sim.world.get(ship, AwaySiteC)!.status === 'open') planCarry(sim, ship);
  // Away-owned holds and flags whose owner is gone end here, and only here (away/owned.ts).
  releaseOwned(sim);
}
