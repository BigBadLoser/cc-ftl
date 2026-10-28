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
import { courierDef, spawnCourier } from '../trade/courier';
import { failDeal, isLive } from '../trade/deals';
import { freeAirlock, playerShip } from '../trade/player';
import { ensureTrader, hailVerdict } from '../trade/traders';
import type { Deal } from '../trade/types';
import { CRATE, crateOf, recoverCrate } from './crate';
import { HANDOVER_RETRY_SEC } from './tuningJobs';
import type { StationJob } from './types';

/**
 * The physical handover of a delivery (issue #178). Arriving at the destination with the crate aboard does not pay at once: the station sends its own
 * shuttle (the trade courier, run as a `Deal` with `Deal.handover` set, no goods and no escrow) to dock at a working airlock of the player's ship, the crew haul
 * the crate from the deck to the airlock, and the delivery is paid when the shuttle has it (`StationJob.collected`; jobs.ts `tendJobs` settles it). The
 * shuttle then leaves like any courier (dealFlow.ts `dismissCourier`). Phases reuse `DealPhase`: 'dispatch' (the shuttle is made) -> 'back' (it flies to
 * the airlock and docks) -> 'load' (crew haul the crate into its hold) -> 'done'.
 *
 * When the shuttle cannot come:
 * - combat in the node: it is not sent (or is called off if it is already out); the crate stays on deck and the job's time keeps running. It is tried again
 *   when the node is quiet.
 * - the shuttle could not dock or the crew did not load the crate in time: the run is called off and tried again after HANDOVER_RETRY_SEC; after
 *   MAX_TRIES failed runs the crate is handed across by hand instead.
 * - nothing to send (no station ship at the node, no shuttle model in the content) or nowhere to dock (no working airlock on the player's ship): the crate is
 *   handed across by hand at once, the old behaviour (`job.handedOver` event with `via: 'instant'`).
 */

const MAX_TRIES = 3;
const REPEAT = 20;
const DOCK_SEC = 240;
const LOAD_SEC = 300;

/** The station ship that sends the shuttle: the lowest-id immobile, answering, non-player ship of the node; 0 when there is none. */
function stationShip(sim: Sim): number {
  for (const id of [...sim.world.query(ShipC)].sort((a, b) => a - b)) {
    const s = sim.world.get(id, ShipC);
    if (!s || !s.immobile || s.faction === 'player' || s.state !== 'active') continue;
    if (ensureTrader(sim, id) && hailVerdict(sim, id).answers) return id;
  }
  return 0;
}

/** Whether the player's ship has a working docking airlock at all. */
function hasAirlock(sim: Sim): boolean {
  const me = playerShip(sim);
  return sim.world.query(AirlockC, ModuleC).some((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === me && airlockWorking(sim, id));
}

/** The running handover deal of a job, if any. */
export const handoverOf = (sim: Sim, jobId: number): Deal | undefined => sim.trade.deals.find((d) => d.handover?.job === jobId && isLive(d));

/** Why a job's handover cannot start now: 'running', 'combat', 'wait' (retrying later, or the airlock is busy), 'instant' (nothing can come: hand it across by hand), else 'go'. */
function check(sim: Sim, job: StationJob): 'running' | 'combat' | 'wait' | 'instant' | 'go' {
  if (handoverOf(sim, job.id)) return 'running';
  if (sim.sector.inCombat) return 'combat';
  if (!stationShip(sim) || !courierDef(sim) || !hasAirlock(sim) || (job.handoverTries ?? 0) >= MAX_TRIES) return 'instant';
  const last = sim.trade.deals.filter((d) => d.handover?.job === job.id).pop();
  if (last?.handover?.retryAt !== undefined && sim.tick < last.handover.retryAt) return 'wait';
  return freeAirlock(sim, 0) ? 'go' : 'wait';
}

/**
 * Send the station shuttle for a delivery's crate. Returns 'started' (or already running), 'wait' (try again later), or 'instant' (it cannot come: the
 * caller hands the crate over by hand).
 */
export function startHandover(sim: Sim, job: StationJob): 'started' | 'wait' | 'instant' {
  const c = check(sim, job);
  if (c === 'running') return 'started';
  if (c !== 'go') return c === 'instant' ? 'instant' : 'wait';
  const ship = stationShip(sim);
  const deal: Deal = {
    id: sim.trade.nextId++, ship, give: [], get: [], barter: false, balance: 0, held: 0, courier: 'them', phase: 'dispatch', vehicle: 0,
    airlock: freeAirlock(sim, 0), timer: 0, tick: sim.tick, handover: { job: job.id },
  };
  sim.trade.deals.push(deal);
  sim.events.emit({ type: 'job.shuttleSent', id: job.id, station: ship });
  return 'started';
}

const due = (d: Deal): boolean => d.timer % REPEAT === 1;

function call(sim: Sim, d: Deal, reason: string): void {
  const job = sim.galaxy.jobs.find((j) => j.id === d.handover?.job);
  if (job && reason !== 'combat') job.handoverTries = (job.handoverTries ?? 0) + 1;
  if (d.handover) d.handover.retryAt = sim.tick + HANDOVER_RETRY_SEC * TICK_HZ;
  failDeal(sim, d, reason);
}

/** One tick of a handover deal (dealFlow.ts `step`, which has counted the tick). */
export function stepHandover(sim: Sim, d: Deal): void {
  const job = sim.galaxy.jobs.find((j) => j.id === d.handover?.job);
  if (!job) return call(sim, d, 'jobGone');
  if (sim.sector.inCombat) return call(sim, d, 'combat');
  if (d.phase === 'dispatch') {
    d.vehicle = spawnCourier(sim, d);
    if (!d.vehicle) return call(sim, d, 'noCourier');
    (sim.world.get(d.vehicle, VehicleC) as Vehicle).outbound = true; // sealed: the cargo planner must not unload what the crew load
    d.phase = 'back';
    d.timer = 0;
  }
  const v = sim.world.get(d.vehicle, VehicleC);
  if (!v) return call(sim, d, 'lost');
  if (!airlockWorking(sim, d.airlock)) return call(sim, d, 'noDock');
  if (d.phase === 'back') {
    if (d.timer > DOCK_SEC * TICK_HZ) return call(sim, d, 'noDock');
    if (v.state === 'docked' && v.dock === d.airlock) {
      d.phase = 'load';
      d.timer = 0;
    } else if (due(d) && v.dest?.type !== 'dock') sim.enqueue({ type: 'vehicle.dock', vehicle: d.vehicle, airlock: d.airlock });
    return;
  }
  if (d.timer > LOAD_SEC * TICK_HZ) return call(sim, d, 'loadTimeout');
  if (cargoOf(sim, d.vehicle, CRATE) >= 1) return collect(sim, d, job, v);
  if (sim.tick % PLAN_INTERVAL !== 0 || v.state !== 'docked' || !recoverCrate(sim, job.id)) return;
  const crate = crateOf(sim, job.id);
  const s = crate === undefined ? undefined : sim.world.get(crate, ItemStackC);
  const res = reservations(sim);
  if (crate === undefined || !s || (res.out.get(refKey('floor', crate, CRATE)) ?? 0) > 0) return;
  makeHaul(sim, res, 'hauling', shipIdOf(sim, s), { ref: { kind: 'floor', id: crate }, x: s.x, y: s.y, avail: 1 }, { kind: 'vehicle', id: d.vehicle }, CRATE, 1);
}

/** The shuttle has the crate: it takes it away (it leaves the hold), and the job is marked for payment. The deal is over; the shuttle is sent home. */
function collect(sim: Sim, d: Deal, job: StationJob, v: Vehicle): void {
  cargoTake(sim, d.vehicle, CRATE, cargoCount(v));
  v.outbound = false;
  job.collected = true;
  d.phase = 'done';
  d.timer = 0;
}
