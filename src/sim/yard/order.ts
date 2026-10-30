import { ShipC, type Ship } from '../combat/components';
import type { Command } from '../commands';
import type { Sim } from '../sim';

import { freeAirlock, playerShip } from '../trade/player';
import { Struct } from '../structure';
import { takeMetal } from './money';
import { MAX_PLAN, plannedTiles, quoteYard } from './plan';
import { changeViolations } from './width';
import { postHullJobs, postTrussJobs } from './jobs';
import { finishOrder } from './flow';
import { HullPlanC, isLiveOrder, type YardOrder } from './types';

type YardCommandType = Extract<Command['type'], `yard.${string}` | 'hull.plan'>;

/** How far from a ship's rectangle its hull may be planned. */
const PLAN_REACH = 40;
type Handler<T extends YardCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

const reject = (sim: Sim, command: string, reason: string): void => void sim.events.emit({ type: 'command.rejected', command, reason });

/** The live order on a ship, if any (one yard job at a time). */
export const liveOrderOf = (sim: Sim, ship: number): YardOrder | undefined => sim.yard.orders.find((o) => isLiveOrder(o) && o.ship === ship);

/** Give a ship the rectangle it needs to hold the new tiles (the grid view follows the ShipC rectangle). */
function growShip(sim: Sim, ship: number, rect: { x: number; y: number; w: number; h: number }): void {
  const s = sim.world.get(ship, ShipC) as Ship;
  s.x = rect.x;
  s.y = rect.y;
  s.width = rect.w;
  s.height = rect.h;
  sim.sector.width = Math.max(sim.sector.width, rect.x + rect.w + 8);
  sim.sector.height = Math.max(sim.sector.height, rect.y + rect.h + 8);
}

export const yardHandlers: { [T in YardCommandType]: Handler<T> } = {
  /**
   * `hull.plan`: set the plan for a player ship's outer hull: the tiles (sector tiles of open space) the ship should one day have as hull. Replaces
   * the plan; an empty list clears it. Free, at any time, and kept with the ship. Rejected: `badGrid` (not a player ship), `badValue`
   * (not whole tiles, too many, or too far from the ship), `narrowHull` (the replan would leave part of the ship narrower than 3 tiles). Tiles that are not open space or the ship's own truss are dropped.
   */
  'hull.plan': (sim, cmd) => {
    const s = sim.world.get(cmd.ship, ShipC);
    if (!s || s.faction !== 'player') return reject(sim, cmd.type, 'badGrid');
    const near = { x: s.x - PLAN_REACH, y: s.y - PLAN_REACH, w: s.width + 2 * PLAN_REACH, h: s.height + 2 * PLAN_REACH };
    if (cmd.tiles.length > MAX_PLAN || cmd.tiles.some((t) => !Number.isInteger(t.x) || !Number.isInteger(t.y) || t.x < near.x || t.y < near.y || t.x >= near.x + near.w || t.y >= near.y + near.h)) {
      return reject(sim, cmd.type, 'badValue');
    }
    // open space, or the ship's own open truss (a replan keeps the trusses a yard has laid)
    const open = (t: { x: number; y: number }): boolean => {
      const k = sim.sector.grid.get('struct', t.x, t.y);
      return k === Struct.Space || (k === Struct.Beam && sim.sector.grid.get('ship', t.x, t.y) === cmd.ship);
    };
    const tiles = cmd.tiles.filter(open).map((t) => ({ x: t.x, y: t.y }));
    // the 3-wide rule: a replan may not add a narrow part (a replan that only keeps or removes what was already narrow is fine)
    if (changeViolations(sim, cmd.ship, plannedTiles(sim, cmd.ship), tiles).length > 0) return reject(sim, cmd.type, 'narrowHull');
    if (tiles.length === 0) sim.world.remove(cmd.ship, HullPlanC);
    else if (sim.world.has(cmd.ship, HullPlanC)) (sim.world.get(cmd.ship, HullPlanC) as { tiles: unknown }).tiles = tiles;
    else sim.world.add(cmd.ship, HullPlanC, { tiles });
    sim.events.emit({ type: 'hull.planned', ship: cmd.ship, tiles: tiles.length });
  },
  /**
   * `yard.order`: buy what a station's yard builds of the plan now (`quoteYard`): the hull tiles up to its cap that can be reached from the ship, and the
   * floor they enclose. Rejected with the quote's error (`noYard`, `noTiles`, `notAdjacent`, `crowded`), `busy` (an order is running), `inCombat`,
   * `noYardDock` (the shuttle needs a free airlock), `cantAfford` or `noMetal`. Pays into escrow (the planning fee included), grows the ship's rectangle and posts the
   * planning pass (trusses on every reachable planned tile); the station sends its shuttle, and the crew turn trusses into hull and floor when it is done.
   */
  'yard.order': (sim, cmd) => {
    const ship = playerShip(sim);
    if (sim.sector.state !== 'active' || sim.galaxy.event) return reject(sim, cmd.type, 'notHere');
    if (sim.sector.inCombat) return reject(sim, cmd.type, 'inCombat');
    if (liveOrderOf(sim, ship)) return reject(sim, cmd.type, 'busy');
    const quote = quoteYard(sim, cmd.station, ship);
    if (quote.error || !quote.rect) return reject(sim, cmd.type, quote.error ?? 'noTiles');
    const airlock = freeAirlock(sim, 0);
    if (!airlock) return reject(sim, cmd.type, 'noYardDock');
    if (!quote.afford.credits) return reject(sim, cmd.type, 'cantAfford');
    if (!quote.afford.metal || !takeMetal(sim, ship, quote.price.metal)) return reject(sim, cmd.type, 'noMetal');
    sim.trade.credits -= quote.price.credits;
    const order: YardOrder = {
      id: sim.yard.nextId++, station: cmd.station, ship, floor: quote.floor, walls: quote.walls, trusses: quote.trusses, fee: { ...quote.fee }, stage: 'truss', gaps: quote.gaps, sealed: quote.gaps.length === 0, ejected: [], held: { ...quote.price },
      price: { ...quote.price }, rank: 0, phase: 'launch', vehicle: 0, crew: [], airlock, timer: 0, stall: 0, built: 0, tick: sim.tick,
    };
    growShip(sim, ship, quote.rect);
    // Two passes (see `YardOrder`): the planning pass trusses every reachable planned tile now; the hull jobs go up when it is done (`flow.ts`), or at
    // once when every planned tile already has its truss.
    if (order.trusses.length > 0) postTrussJobs(sim, order);
    else postHullJobs(sim, order);
    sim.yard.orders.push(order);
    sim.events.emit({ type: 'yard.ordered', order: order.id, station: cmd.station, tiles: quote.trusses.length + quote.walls.length + quote.floor.length });
  },
  /** `yard.cancel`: send the yard crew home. The unbuilt part is refunded at once; what was built stays and is paid for. */
  'yard.cancel': (sim, cmd) => {
    const o = sim.yard.orders.find((x) => x.id === cmd.order);
    if (!o || !isLiveOrder(o)) return reject(sim, cmd.type, 'noOrder');
    finishOrder(sim, o, 'called off');
  },
};
