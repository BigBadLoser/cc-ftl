import { shipById } from '../combat/ships';
import { BUILD_TICKS, createJob } from '../crew/handlers';
import { DraftedC, PositionC } from '../crew/components';
import { isSettled } from '../crew/helpers';
import { Struct } from '../structure';
import { sendToEmbark } from '../vehicles/embark';
import { AboardC, EmbarkOrderC, VehicleC } from '../vehicles/components';
import { dockError } from '../vehicles/handlers';
import { boardCrew } from '../vehicles/lifecycle';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { alive, dismiss, landCrew, launchShuttle, stowSuit, topUpAir } from './crew';
import { payStation, refund } from './money';
import { builtCount, dropJobs, jobsOf, shareOf, totalTiles } from './progress';
import { isLiveOrder, type YardOrder } from './types';

/** Ticks between repeats of an order the crew or shuttle has not obeyed yet. */
const REPEAT = 20;
/** Seconds the shuttle gets to dock, the crew to climb back in, and the shuttle to fly home; seconds without a finished tile before the work is called stalled. */
const FLY_SEC = 120;
const RECALL_SEC = 90;
const HOME_SEC = 120;
const STALL_SEC = 600;
const SEAL_SEC = 60;
/** Finished orders kept for the readout. */
export const YARD_HISTORY = 6;

/** Number of tiles standing now. */
const builtTotal = (sim: Sim, o: YardOrder): number => {
  const b = builtCount(sim, o);
  return b.floor + b.walls;
};

/** The unbuilt share of the price goes back to the player now; what is left in escrow is the built share. */
function refundUnbuilt(sim: Sim, o: YardOrder): void {
  const built = shareOf(o, builtTotal(sim, o));
  refund(sim, o, { credits: o.price.credits - built.credits, metal: o.price.metal - built.metal });
}

/** Close an order: the unbuilt part has been refunded, the built part is paid to the station (or refunded if the station is gone). */
function close(sim: Sim, o: YardOrder, reason: string): void {
  const built = builtTotal(sim, o);
  payStation(sim, o);
  refund(sim, o, o.held); // a station that is gone pays nothing: the player gets the rest back
  dismiss(sim, o);
  o.phase = built > 0 ? 'done' : 'failed';
  o.timer = 0;
  if (reason) o.reason = reason;
  sim.events.emit({ type: 'yard.ended', order: o.id, reason: o.reason ?? '', built, total: totalTiles(o) });
  const done = sim.yard.orders.filter((x) => !isLiveOrder(x));
  for (const x of done.slice(0, Math.max(0, done.length - YARD_HISTORY))) sim.yard.orders.splice(sim.yard.orders.indexOf(x), 1);
}

/** End an order on the spot: jobs dropped, crew and shuttle gone, money settled. For when the station, the ship or the node is lost. */
export function endNow(sim: Sim, o: YardOrder, reason: string): void {
  dropJobs(sim, o);
  refundUnbuilt(sim, o);
  close(sim, o, reason);
}

/** The player's ship is leaving (or lost): every live order ends on the spot. */
export function abortYards(sim: Sim, reason: string): void {
  for (const o of [...sim.yard.orders]) if (isLiveOrder(o)) endNow(sim, o, reason);
}

/**
 * Work is over (done, called off, stalled, in the way of a fight): the open jobs go, the unbuilt part of the price is refunded, and the crew are recalled
 * to the shuttle (or, if they never landed, the shuttle just turns for home). The built part stays in escrow until the shuttle is back.
 */
export function finishOrder(sim: Sim, o: YardOrder, reason: string): void {
  if (o.phase === 'recall' || o.phase === 'home' || !isLiveOrder(o)) return;
  dropJobs(sim, o);
  refundUnbuilt(sim, o);
  if (reason) o.reason = reason;
  o.phase = o.crew.some((id) => sim.world.get(id, AboardC)?.vehicle !== o.vehicle && alive(sim, id)) ? 'recall' : 'home';
  o.timer = 0;
}

/** The gap whose outside tile is nearest to a tile. */
function nearestGap(o: YardOrder, at: { x: number; y: number }): YardOrder['gaps'][number] | undefined {
  return [...o.gaps].sort((a, b) => Math.hypot(a.stage.x - at.x, a.stage.y - at.y) - Math.hypot(b.stage.x - at.x, b.stage.y - at.y))[0];
}

function step(sim: Sim, o: YardOrder): void {
  o.timer++;
  const me = shipById(sim, o.ship);
  const station = shipById(sim, o.station);
  if (!me || me.faction !== 'player') return endNow(sim, o, 'lost');
  if (!station || station.state !== 'active' || sim.sector.state !== 'active') return endNow(sim, o, 'left');
  const v = sim.world.get(o.vehicle, VehicleC);
  switch (o.phase) {
    case 'launch':
      if (!launchShuttle(sim, o)) return endNow(sim, o, 'noShuttle');
      o.phase = 'fly';
      o.timer = 0;
      return;
    case 'fly': {
      if (!v) return endNow(sim, o, 'lost');
      if (v.state === 'docked' && v.dock === o.airlock) {
        if (landCrew(sim, o)) {
          o.phase = 'work';
          o.timer = 0;
          o.stall = 0;
          o.built = builtTotal(sim, o);
        }
        return;
      }
      if (dockError(sim, o.vehicle, o.airlock) !== null || o.timer > FLY_SEC * TICK_HZ) return finishOrder(sim, o, 'noDock');
      if (!v.dest && o.timer % REPEAT === 1) v.dest = { type: 'dock', airlock: o.airlock };
      return;
    }
    case 'work': {
      topUpAir(sim, o);
      if (!o.crew.some((id) => alive(sim, id))) return endNow(sim, o, 'crew lost');
      if (sim.sector.inCombat) return finishOrder(sim, o, 'combat');
      const built = builtTotal(sim, o);
      if (built >= totalTiles(o)) return finishOrder(sim, o, '');
      if (!o.sealed && jobsOf(sim, o).length === 0) {
        o.phase = 'seal';
        o.timer = 0;
        return;
      }
      if (built !== o.built) {
        o.built = built;
        o.stall = 0;
      } else if (++o.stall > STALL_SEC * TICK_HZ || jobsOf(sim, o).length === 0) return finishOrder(sim, o, 'stalled');
      return;
    }
    case 'seal': {
      topUpAir(sim, o);
      if (!o.crew.some((id) => alive(sim, id))) return endNow(sim, o, 'crew lost');
      if (sim.sector.inCombat) return finishOrder(sim, o, 'combat');
      // Everyone walks out to the open tile beyond a gap and waits there, so the closing wall is built from outside.
      const waiting = o.crew.filter((id) => {
        const at = sim.world.get(id, PositionC);
        return alive(sim, id) && !!at && !(isSettled(at) && o.gaps.some((g) => g.stage.x === at.x && g.stage.y === at.y));
      });
      if (waiting.length > 0) {
        if (o.timer > SEAL_SEC * TICK_HZ) return finishOrder(sim, o, 'stalled');
        if (o.timer % REPEAT === 1) {
          for (const id of waiting) {
            const at = sim.world.get(id, PositionC) as { x: number; y: number };
            const gap = nearestGap(o, at);
            if (!sim.world.has(id, DraftedC)) sim.enqueue({ type: 'crew.draft', id, drafted: true });
            else if (gap) sim.enqueue({ type: 'crew.moveTo', id, x: gap.stage.x, y: gap.stage.y, ship: o.ship });
          }
        }
        return;
      }
      for (const g of o.gaps) createJob(sim, 'build', o.ship, g.wall.x, g.wall.y, Struct.Wall, BUILD_TICKS[Struct.Wall] as number, true, { yard: o.id });
      for (const id of o.crew) if (sim.world.has(id, DraftedC)) sim.enqueue({ type: 'crew.draft', id, drafted: false });
      o.sealed = true;
      o.phase = 'work';
      o.timer = 0;
      o.stall = 0;
      return;
    }
    case 'recall': {
      topUpAir(sim, o);
      if (!v) return endNow(sim, o, 'lost');
      const out = o.crew.filter((id) => alive(sim, id) && sim.world.get(id, AboardC)?.vehicle !== o.vehicle);
      if (out.length > 0 && o.timer <= RECALL_SEC * TICK_HZ) {
        if (o.timer % REPEAT === 1) for (const id of out) if (!sim.world.has(id, EmbarkOrderC)) sendToEmbark(sim, id, o.vehicle);
        return;
      }
      // Anyone left behind (downed, or boxed in) is carried aboard by the yard.
      for (const id of out) boardCrew(sim, id, o.vehicle);
      for (const id of o.crew) stowSuit(sim, o, id);
      o.phase = 'home';
      o.timer = 0;
      return;
    }
    case 'home': {
      if (!v) return close(sim, o, '');
      for (const id of o.crew) stowSuit(sim, o, id);
      if (v.state === 'docked') {
        if (o.timer % REPEAT === 1) sim.enqueue({ type: 'vehicle.undock', vehicle: o.vehicle });
        return;
      }
      if (v.dest?.type === 'dock') v.dest = null; // it never got there: turn for home
      if (v.hover === o.station && !v.dest) return close(sim, o, '');
      if (!v.dest) {
        v.hover = 0;
        v.dest = { type: 'hover', ship: o.station };
      }
      if (o.timer > HOME_SEC * TICK_HZ) close(sim, o, '');
      return;
    }
    default:
  }
}

/** Advance every live shipyard order one tick. */
export function yardSystem(sim: Sim): void {
  for (const o of [...sim.yard.orders]) if (isLiveOrder(o)) step(sim, o);
}
