import { shipById } from '../combat/ships';
import { BUILD_TICKS, createJob } from '../crew/handlers';
import { CrewC, DraftedC, JobC, PositionC } from '../crew/components';
import { isSettled } from '../crew/helpers';
import { Struct } from '../structure';
import { AwaySiteC } from '../away/components';
import { shipIdOf } from '../regions';
import { VehicleC } from '../vehicles/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { alive, dismiss, launchShuttle, yardRun } from './crew';
import { payStation, refund, retryRefund } from './money';
import { builtCount, dropJobs, earned, jobsOf, totalTiles } from './progress';
import { postHullJobs } from './jobs';
import { openInnerWalls } from './open';
import { isLiveOrder, type YardOrder } from './types';

/** Ticks between repeats of an order the crew or shuttle has not obeyed yet. */
const REPEAT = 20;
/**
 * Seconds the crew get to land, and the run to bring them home after the site closes (its own lift after AWAY_LIFT_SEC included); seconds
 * without a finished tile before the work is called stalled.
 */
const FLY_SEC = 120;
const HOME_SEC = 300;
const STALL_SEC = 600;
const SEAL_SEC = 60;
/** Finished orders kept for the readout. */
export const YARD_HISTORY = 6;

/** Number of tiles standing now. */
const builtTotal = (sim: Sim, o: YardOrder): number => {
  const b = builtCount(sim, o);
  return b.truss + b.floor + b.walls;
};

/** The unbuilt share of the price goes back to the player now; what is left in escrow is the built share. */
function refundUnbuilt(sim: Sim, o: YardOrder): void {
  const built = earned(sim, o);
  refund(sim, o, { credits: o.price.credits - built.credits, metal: o.price.metal - built.metal });
}

/**
 * Give back the ship's own crew the order drafted to walk out of the new rooms while they were sealed (`ejected`). Every way an order ends calls it, so
 * a cancel, a combat interruption or a sealing timeout never leaves anyone drafted. Safe to call twice.
 */
function releaseEjected(sim: Sim, o: YardOrder): void {
  for (const id of o.ejected) if (sim.world.has(id, DraftedC)) sim.enqueue({ type: 'crew.draft', id, drafted: false });
  o.ejected = [];
}

/** Close an order: the unbuilt part has been refunded, the built part is paid to the station (or refunded if the station is gone). */
function close(sim: Sim, o: YardOrder, reason: string): void {
  releaseEjected(sim, o);
  const built = builtTotal(sim, o);
  payStation(sim, o);
  refund(sim, o, o.held); // a station that is gone pays nothing: the player gets the rest back
  dismiss(sim, o);
  o.phase = built > 0 ? 'done' : 'failed';
  o.timer = 0;
  if (reason) o.reason = reason;
  sim.events.emit({ type: 'yard.ended', order: o.id, reason: o.reason ?? '', built, total: totalTiles(o) });
  const done = sim.yard.orders.filter((x) => !isLiveOrder(x));
  for (const x of done.filter((y) => !y.pending).slice(0, Math.max(0, done.length - YARD_HISTORY))) sim.yard.orders.splice(sim.yard.orders.indexOf(x), 1);
}

/** End an order on the spot: jobs dropped, crew and shuttle gone, money settled. For when the station, the ship or the node is lost. */
export function endNow(sim: Sim, o: YardOrder, reason: string): void {
  releaseEjected(sim, o);
  dropJobs(sim, o);
  refundUnbuilt(sim, o);
  close(sim, o, reason);
}

/** The player's ship is leaving (or lost): every live order ends on the spot. */
export function abortYards(sim: Sim, reason: string): void {
  for (const o of [...sim.yard.orders]) if (isLiveOrder(o)) endNow(sim, o, reason);
}

/**
 * Work is over (done, called off, stalled, in the way of a fight): the open jobs go, the unbuilt part of the price is refunded, and the site
 * closes: its run calls the crew aboard and flies them home (`recall`). The built part stays in escrow until the shuttle is back.
 */
export function finishOrder(sim: Sim, o: YardOrder, reason: string): void {
  if (o.phase === 'recall' || o.phase === 'home' || !isLiveOrder(o)) return;
  releaseEjected(sim, o);
  dropJobs(sim, o);
  refundUnbuilt(sim, o);
  if (reason) o.reason = reason;
  const site = sim.world.get(o.ship, AwaySiteC);
  if (site?.vehicle === o.vehicle) site.status = 'closing';
  o.phase = 'recall';
  o.timer = 0;
}

/** True once a contractor stands on the player's ship (landed off the shuttle). */
const landed = (sim: Sim, o: YardOrder): boolean => o.crew.some((id) => alive(sim, id) && shipIdOf(sim, sim.world.get(id, PositionC)) === o.ship);

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
      // The site's run flies the crew over and lands them (docked at the order's airlock, or any other, or out of the hatch).
      if (!v || !yardRun(sim, o)) return endNow(sim, o, 'lost');
      if (landed(sim, o)) {
        o.phase = 'work';
        o.timer = 0;
        o.stall = 0;
        o.built = builtTotal(sim, o);
        return;
      }
      if (o.timer > FLY_SEC * TICK_HZ) return finishOrder(sim, o, 'noDock');
      return;
    }
    case 'work': {
      if (!o.crew.some((id) => alive(sim, id))) return endNow(sim, o, 'crew lost');
      if (sim.sector.inCombat) return finishOrder(sim, o, 'combat');
      if (o.stage === 'truss' && jobsOf(sim, o).length === 0) postHullJobs(sim, o); // the planning pass is done: turn trusses into hull
      const built = builtTotal(sim, o);
      // Old hull the new walls shut in is already gone (opened as each wall landed, `openInnerWalls`); the order ends once everything is built.
      if (built !== o.built || built >= totalTiles(o)) openInnerWalls(sim, o);
      if (built >= totalTiles(o)) return finishOrder(sim, o, '');
      if (!o.sealed && jobsOf(sim, o).length === 0) {
        o.phase = 'seal';
        o.timer = 0;
        return;
      }
      const rows = jobsOf(sim, o).map((id) => sim.world.get(id, JobC)?.yardRank ?? o.rank);
      if (rows.length) o.rank = Math.min(...rows);
      if (built !== o.built) {
        o.built = built;
        o.stall = 0;
      } else if (++o.stall > STALL_SEC * TICK_HZ || jobsOf(sim, o).length === 0) return finishOrder(sim, o, 'stalled');
      return;
    }
    case 'seal': {
      if (!o.crew.some((id) => alive(sim, id))) return endNow(sim, o, 'crew lost');
      if (sim.sector.inCombat) return finishOrder(sim, o, 'combat');
      // Everyone walks out to the open tile beyond a gap and waits there, so the closing wall is built from outside: the yard's crew, and any of the
      // ship's own crew who are in the new rooms (they are taken off their work for it and given it back after).
      const floor = new Set(o.floor.map((t) => `${t.x},${t.y}`));
      const outsiders = sim.world.query(CrewC, PositionC).filter((id) => {
        const at = sim.world.get(id, PositionC) as { x: number; y: number };
        return !o.crew.includes(id) && alive(sim, id) && floor.has(`${at.x},${at.y}`);
      });
      const waiting = [...o.crew.filter((id) => {
        const at = sim.world.get(id, PositionC);
        return alive(sim, id) && !!at && !(isSettled(at) && o.gaps.some((g) => g.stage.x === at.x && g.stage.y === at.y));
      }), ...outsiders];
      if (waiting.length > 0) {
        if (o.timer > SEAL_SEC * TICK_HZ) return finishOrder(sim, o, 'stalled');
        if (o.timer % REPEAT === 1) {
          for (const id of waiting) {
            const at = sim.world.get(id, PositionC) as { x: number; y: number };
            const gap = nearestGap(o, at);
            if (!sim.world.has(id, DraftedC)) {
              if (!o.crew.includes(id)) o.ejected.push(id);
              sim.enqueue({ type: 'crew.draft', id, drafted: true });
            } else if (gap) sim.enqueue({ type: 'crew.moveTo', id, x: gap.stage.x, y: gap.stage.y, ship: o.ship });
          }
        }
        return;
      }
      for (const g of o.gaps) createJob(sim, 'build', o.ship, g.wall.x, g.wall.y, Struct.Wall, BUILD_TICKS[Struct.Wall] as number, true, { yard: o.id, yardOnly: true });
      for (const id of [...o.crew, ...o.ejected]) if (sim.world.has(id, DraftedC)) sim.enqueue({ type: 'crew.draft', id, drafted: false });
      o.ejected = [];
      o.sealed = true;
      o.phase = 'work';
      o.timer = 0;
      o.stall = 0;
      return;
    }
    case 'recall': {
      // The site is closing: its run calls everyone aboard (lifting whoever cannot come after AWAY_LIFT_SEC) and flies them home.
      if (!v) return close(sim, o, '');
      if (yardRun(sim, o)?.phase === 'home' || !yardRun(sim, o)) {
        o.phase = 'home';
        o.timer = 0;
      } else if (o.timer > HOME_SEC * TICK_HZ) return close(sim, o, '');
      return;
    }
    case 'home': {
      // Home once the run has ended there (the crew who came home stepped out at the station); the yard then dismisses them.
      if (!v || !yardRun(sim, o) || o.timer > HOME_SEC * TICK_HZ) return close(sim, o, '');
      return;
    }
    default:
  }
}

/** Advance every live shipyard order one tick. */
export function yardSystem(sim: Sim): void {
  for (const o of [...sim.yard.orders]) {
    if (isLiveOrder(o)) step(sim, o);
    else if (o.pending && sim.tick % 60 === 0) retryRefund(sim, o);
  }
}
