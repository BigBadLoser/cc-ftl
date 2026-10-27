import { ShipC, type Ship } from '../combat/components';
import { BUILD_TICKS, createJob } from '../crew/handlers';
import type { Command } from '../commands';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { freeAirlock, playerShip } from '../trade/player';
import { takeMetal } from './money';
import { planYard } from './plan';
import { finishOrder } from './flow';
import { isLiveOrder, type YardOrder } from './types';

type YardCommandType = Extract<Command['type'], `yard.${string}`>;
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
   * `yard.order`: buy a hull expansion at a station of the player's node. Rejected with the plan's error (`noYard`, `yardCap`, `blocked`, `notAdjacent`,
   * `shipMax`, `crowded`...), `busy` (an order is running), `inCombat`, `noYardDock` (the shuttle needs a free airlock), `cantAfford` or `noMetal`.
   * Pays the credits and metal into escrow, grows the ship's rectangle and posts the floor and wall jobs; the station then sends its shuttle.
   */
  'yard.order': (sim, cmd) => {
    const ship = playerShip(sim);
    if (sim.sector.state !== 'active' || sim.galaxy.event) return reject(sim, cmd.type, 'notHere');
    if (sim.sector.inCombat) return reject(sim, cmd.type, 'inCombat');
    if (liveOrderOf(sim, ship)) return reject(sim, cmd.type, 'busy');
    const plan = planYard(sim, cmd.station, cmd.tiles, ship);
    if (plan.error || !plan.rect) return reject(sim, cmd.type, plan.error ?? 'noTiles');
    const airlock = freeAirlock(sim, 0);
    if (!airlock) return reject(sim, cmd.type, 'noYardDock');
    if (!plan.afford.credits) return reject(sim, cmd.type, 'cantAfford');
    if (!plan.afford.metal || !takeMetal(sim, ship, plan.price.metal)) return reject(sim, cmd.type, 'noMetal');
    sim.trade.credits -= plan.price.credits;
    const order: YardOrder = {
      id: sim.yard.nextId++, station: cmd.station, ship, floor: plan.floor, walls: plan.walls, gaps: plan.gaps, sealed: plan.gaps.length === 0, held: { ...plan.price }, price: { ...plan.price },
      phase: 'launch', vehicle: 0, crew: [], airlock, timer: 0, stall: 0, built: 0, tick: sim.tick,
    };
    growShip(sim, ship, plan.rect);
    for (const t of plan.floor) createJob(sim, 'build', ship, t.x, t.y, Struct.Floor, BUILD_TICKS[Struct.Floor] as number, true, { yard: order.id });
    const gapKeys = new Set(plan.gaps.map((g) => `${g.wall.x},${g.wall.y}`));
    for (const t of plan.walls.filter((w) => !gapKeys.has(`${w.x},${w.y}`))) createJob(sim, 'build', ship, t.x, t.y, Struct.Wall, BUILD_TICKS[Struct.Wall] as number, true, { yard: order.id });
    sim.yard.orders.push(order);
    sim.events.emit({ type: 'yard.ordered', order: order.id, station: cmd.station, tiles: plan.floor.length });
  },
  /** `yard.cancel`: send the yard crew home. The unbuilt part is refunded at once; what was built stays and is paid for. */
  'yard.cancel': (sim, cmd) => {
    const o = sim.yard.orders.find((x) => x.id === cmd.order);
    if (!o || !isLiveOrder(o)) return reject(sim, cmd.type, 'noOrder');
    finishOrder(sim, o, 'called off');
  },
};
