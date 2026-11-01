import { ShipC } from '../combat/components';
import { makeHaul } from '../items/plan';
import { refKey, reservations } from '../items/stock';
import { ItemStackC } from '../items/components';
import { AirlockC, airlockWorking } from '../modules/airlock';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { cargoCount, cargoOf, cargoTake } from '../vehicles/cargo';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { PLAN_INTERVAL } from '../tuning';
import { courierDef, playerCourier, spawnCourier } from '../trade/courier';
import { failDeal, isLive } from '../trade/deals';
import { freeAirlock, playerShip } from '../trade/player';
import { ensureTrader, hailVerdict } from '../trade/traders';
import type { Deal } from '../trade/types';
import { CRATE, crateOf, loadCrate, recoverCrate } from './crate';
import { HANDOVER_RETRY_SEC } from './tuningJobs';
import type { StationJob } from './types';

/**
 * The physical handover of a delivery (issue #178). Arriving at the destination with the crate aboard does not pay at once. A shuttle collects it, run as a
 * `Deal` with `Deal.handover` set (no goods, no escrow). Order of preference:
 * 1. The station's own shuttle (`via` 'station'; only a trader kind with `shuttle: true`, trade.ts). The trade courier is spawned at the station, flies to a
 *    working airlock of the player's ship and docks; crew haul the crate from the deck into its hold; when it has the crate (`StationJob.collected` 'shuttle')
 *    the shuttle leaves like any courier (dealFlow.ts `dismissCourier`). Phases reuse `DealPhase`: 'dispatch' -> 'back' -> 'load' -> 'done'.
 * 2. The player's own shuttle (`via` 'own'; most stations have no shuttle of their own). It docks at the airlock like a trade run, crew load the crate, it
 *    flies to hover beside the station and drops it there (`collected` 'own': the delivery pays on the drop-off), then flies home and is stowed
 *    (dealFlow.ts `parkCourier`). Phases: 'dispatch' -> 'load' -> 'out' -> 'exchange' -> 'done'. Starts with no shuttle at all (none in a bay) skip this.
 * 3. By hand, at once (`job.handedOver` `via: 'instant'`): only when neither can run (no station ship at the node, no working airlock on the player's ship,
 *    no shuttle on either side), or each that could has been called off MAX_TRIES times.
 *
 * Combat in the node holds both back the same way: nothing is sent, and a run already out is called off (a crate already in the hold is put back on deck), the
 * job's time keeps running, and it is tried again when the node is quiet. A run that cannot dock or load in time is called off and retried after
 * HANDOVER_RETRY_SEC. A live handover blocks jumping like any live deal.
 */

const MAX_TRIES = 3;
const REPEAT = 20;
const DOCK_SEC = 240;
const LOAD_SEC = 300;
const FLIGHT_SEC = 240;

/** The station ship that takes the crate: the lowest-id immobile, answering, non-player ship of the node; 0 when there is none. */
function stationShip(sim: Sim): number {
  for (const id of [...sim.world.query(ShipC)].sort((a, b) => a - b)) {
    const s = sim.world.get(id, ShipC);
    if (!s || !s.immobile || s.faction === 'player' || s.state !== 'active') continue;
    if (ensureTrader(sim, id) && hailVerdict(sim, id).answers) return id;
  }
  return 0;
}

/** Whether a station has a shuttle of its own to send (its trader kind) and the content has a shuttle model for it. */
const sendsShuttle = (sim: Sim, ship: number): boolean => {
  const t = ensureTrader(sim, ship);
  return !!t && sim.content.trade?.traders[t.profile]?.shuttle === true && !!courierDef(sim);
};

/** Whether the player's ship has a working docking airlock at all. */
function hasAirlock(sim: Sim): boolean {
  const me = playerShip(sim);
  return sim.world.query(AirlockC, ModuleC).some((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === me && airlockWorking(sim, id));
}

/** The running handover deal of a job, if any. */
export const handoverOf = (sim: Sim, jobId: number): Deal | undefined => sim.trade.deals.find((d) => d.handover?.job === jobId && isLive(d));

type Plan = { go: 'station' | 'own'; ship: number; vehicle: number; airlock: number } | 'running' | 'wait' | 'instant';

/** What to do for a job's handover now: 'running', 'wait' (combat, a retry pause or a busy airlock or shuttle), 'instant', or the run to start. */
function plan(sim: Sim, job: StationJob): Plan {
  if (handoverOf(sim, job.id)) return 'running';
  if (sim.sector.inCombat) return 'wait';
  const ship = stationShip(sim);
  if (!ship || !hasAirlock(sim)) return 'instant';
  const last = sim.trade.deals.filter((d) => d.handover?.job === job.id).pop();
  if (last?.handover?.retryAt !== undefined && sim.tick < last.handover.retryAt) return 'wait';
  if (sendsShuttle(sim, ship) && (job.handoverTries ?? 0) < MAX_TRIES) {
    const airlock = freeAirlock(sim, 0);
    return airlock ? { go: 'station', ship, vehicle: 0, airlock } : 'wait';
  }
  if ((job.ownTries ?? 0) >= MAX_TRIES) return 'instant';
  const c = playerCourier(sim);
  if ('error' in c) return c.error === 'courierBusy' ? 'wait' : 'instant';
  const v = sim.world.get(c.vehicle, VehicleC) as Vehicle;
  const airlock = freeAirlock(sim, c.vehicle, v.state === 'docked' ? v.dock : 0);
  return airlock ? { go: 'own', ship, vehicle: c.vehicle, airlock } : 'wait';
}

/**
 * Send a shuttle for a delivery's crate. Returns 'started' (or already running), 'wait' (try again later), or 'instant' (nothing can come: the
 * caller hands the crate over by hand).
 */
export function startHandover(sim: Sim, job: StationJob): 'started' | 'wait' | 'instant' {
  const p = plan(sim, job);
  if (p === 'running') return 'started';
  if (typeof p === 'string') return p;
  const deal: Deal = {
    id: sim.trade.nextId++, ship: p.ship, give: [], get: [], barter: false, balance: 0, held: 0, courier: p.go === 'own' ? 'you' : 'them', phase: 'dispatch', vehicle: p.vehicle,
    airlock: p.airlock, timer: 0, tick: sim.tick, handover: { job: job.id, via: p.go },
  };
  const v = p.vehicle ? sim.world.get(p.vehicle, VehicleC) : undefined;
  if (v) {
    v.autopilot = true;
    v.outbound = true; // sealed: the cargo planner must not unload what the crew load
  }
  sim.trade.deals.push(deal);
  sim.events.emit({ type: 'job.shuttleSent', id: job.id, station: p.ship, via: p.go });
  return 'started';
}

const due = (d: Deal): boolean => d.timer % REPEAT === 1;

/** Call a run off: tries and the retry pause are noted, a crate already in the hold goes back on deck, an own shuttle flies home. */
function call(sim: Sim, d: Deal, reason: string): void {
  const job = sim.galaxy.jobs.find((j) => j.id === d.handover?.job);
  const own = d.handover?.via === 'own';
  // A crate in the hold goes back on deck first. With no free floor for it, the run is not called off: the crate stays in the shuttle (nothing is lost) and the restore is tried again next tick.
  if (job && d.vehicle && cargoOf(sim, d.vehicle, CRATE) > 0) {
    if (!loadCrate(sim, job.id)) return;
    cargoTake(sim, d.vehicle, CRATE, cargoOf(sim, d.vehicle, CRATE));
  }
  if (job && reason !== 'combat') {
    if (own) job.ownTries = (job.ownTries ?? 0) + 1;
    else job.handoverTries = (job.handoverTries ?? 0) + 1;
  }
  if (d.handover) d.handover.retryAt = sim.tick + HANDOVER_RETRY_SEC * TICK_HZ;
  failDeal(sim, d, reason);
  const v = d.vehicle ? sim.world.get(d.vehicle, VehicleC) : undefined;
  if (own && v && v.state !== 'stowed') {
    v.autopilot = true; // parkCourier clears it once the shuttle is stowed
    sim.enqueue({ type: 'vehicle.return', vehicle: d.vehicle });
  }
}

/** Crew haul the job's crate from the deck into the docked shuttle (one haul at a time). */
function haulCrate(sim: Sim, d: Deal, v: Vehicle, job: StationJob): void {
  if (sim.tick % PLAN_INTERVAL !== 0 || v.state !== 'docked' || !recoverCrate(sim, job.id)) return;
  const crate = crateOf(sim, job.id);
  const s = crate === undefined ? undefined : sim.world.get(crate, ItemStackC);
  const res = reservations(sim);
  if (crate === undefined || !s || (res.out.get(refKey('floor', crate, CRATE)) ?? 0) > 0) return;
  makeHaul(sim, res, 'hauling', shipIdOf(sim, s), { ref: { kind: 'floor', id: crate }, x: s.x, y: s.y, avail: 1 }, { kind: 'vehicle', id: d.vehicle }, CRATE, 1);
}

/** One tick of a handover deal (dealFlow.ts `step`, which has counted the tick). */
export function stepHandover(sim: Sim, d: Deal): void {
  const job = sim.galaxy.jobs.find((j) => j.id === d.handover?.job);
  if (!job) return call(sim, d, 'jobGone');
  if (sim.sector.inCombat) return call(sim, d, 'combat');
  if (!sim.world.get(d.ship, ShipC)) return call(sim, d, 'stationGone');
  if (d.handover?.via === 'station' && d.phase === 'dispatch') {
    d.vehicle = spawnCourier(sim, d);
    if (!d.vehicle) return call(sim, d, 'noCourier');
    (sim.world.get(d.vehicle, VehicleC) as Vehicle).outbound = true;
    d.phase = 'back';
    d.timer = 0;
  }
  const v = sim.world.get(d.vehicle, VehicleC);
  if (!v) return call(sim, d, 'lost');
  if (!airlockWorking(sim, d.airlock) && d.phase !== 'out' && d.phase !== 'exchange') return call(sim, d, 'noDock');
  if (d.handover?.via === 'own') return stepOwn(sim, d, v, job);
  if (d.phase === 'back') {
    if (d.timer > DOCK_SEC * TICK_HZ) return call(sim, d, 'noDock');
    if (v.state === 'docked' && v.dock === d.airlock) {
      d.phase = 'load';
      d.timer = 0;
    } else if (due(d) && v.dest?.type !== 'dock') sim.enqueue({ type: 'vehicle.dock', vehicle: d.vehicle, airlock: d.airlock });
    return;
  }
  if (d.timer > LOAD_SEC * TICK_HZ) return call(sim, d, 'loadTimeout');
  if (cargoOf(sim, d.vehicle, CRATE) >= 1) return collect(sim, job, d, v, 'shuttle');
  haulCrate(sim, d, v, job);
}

/** The player's own shuttle: dock at the airlock, take the crate on, fly to the station, drop it, fly home. */
function stepOwn(sim: Sim, d: Deal, v: Vehicle, job: StationJob): void {
  if (d.phase === 'dispatch') {
    if (d.timer > DOCK_SEC * TICK_HZ) return call(sim, d, 'noDock');
    if (v.state === 'docked' && v.dock === d.airlock) go(d, 'load');
    else if (due(d)) {
      if (v.state === 'docked') sim.enqueue({ type: 'vehicle.undock', vehicle: d.vehicle });
      else if (v.dest?.type !== 'dock') sim.enqueue({ type: 'vehicle.dock', vehicle: d.vehicle, airlock: d.airlock });
    }
  } else if (d.phase === 'load') {
    if (d.timer > LOAD_SEC * TICK_HZ) return call(sim, d, 'loadTimeout');
    if (cargoOf(sim, d.vehicle, CRATE) >= 1) go(d, 'out');
    else haulCrate(sim, d, v, job);
  } else if (d.phase === 'out') {
    if (d.timer > FLIGHT_SEC * TICK_HZ) return call(sim, d, 'flightTimeout');
    if (v.state === 'flying' && !v.dest && v.hover === d.ship) go(d, 'exchange');
    else if (due(d)) {
      if (v.state === 'docked') sim.enqueue({ type: 'vehicle.undock', vehicle: d.vehicle });
      else if (v.dest?.type !== 'hover') sim.enqueue({ type: 'vehicle.hover', vehicle: d.vehicle, ship: d.ship });
    }
  } else if (d.phase === 'exchange') {
    if (d.timer < Math.round((sim.content.trade?.exchangeSec ?? 3) * TICK_HZ)) return;
    collect(sim, job, d, v, 'own');
    sim.enqueue({ type: 'vehicle.return', vehicle: d.vehicle });
  }
}

function go(d: Deal, phase: Deal['phase']): void {
  d.phase = phase;
  d.timer = 0;
}

/** The shuttle has the crate (taken from the airlock, or dropped at the station): it leaves the hold, and the job is marked for payment. The deal is over. */
function collect(sim: Sim, job: StationJob, d: Deal, v: Vehicle, how: 'shuttle' | 'own'): void {
  cargoTake(sim, d.vehicle, CRATE, cargoCount(v));
  v.outbound = false;
  job.collected = how;
  go(d, 'done');
}
