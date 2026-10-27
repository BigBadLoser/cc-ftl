import { Struct, shipGrid, hullLoad, isLiveOrder, quoteYard, viewPlan, playerShip, totalTiles, yardPrice, yardService, builtCount, type Sim, type YardOrder, type YardPhase } from '../sim';
import type { UiHullPlan, UiYard, UiYardOrder, UiYardQuote, UiYardService } from '../ui/api';
import { rejectionMessage } from './messages';

type Tile = { x: number; y: number };

/** What each phase of a yard order reads as. */
const PHASE: Record<YardPhase, string> = {
  launch: 'Shuttle launching', fly: 'Yard shuttle on its way', work: 'Yard crew building', seal: 'Yard crew sealing the hull', recall: 'Yard crew heading back to the shuttle',
  home: 'Yard shuttle flying home', done: 'Done', failed: 'Called off',
};

/** Words for a reason an order ended early. */
const ENDED: Record<string, string> = {
  'called off': 'Called off', combat: 'Pulled out for the fight', stalled: 'The crew could not finish', noDock: 'The shuttle could not dock', left: 'You left the node',
  'crew lost': 'The yard crew was lost', lost: 'The shuttle was lost', noShuttle: 'The station had no shuttle to send',
};

/** What one painted tile costs here (the price of ten, over ten, so a fraction of a metal shows). */
function perTile(sim: Sim, svc: NonNullable<ReturnType<typeof yardService>>): { credits: number; metal: number } {
  const ten = yardPrice(sim, svc, 10);
  return { credits: ten.credits / 10, metal: ten.metal / 10 };
}

/** The yard a station runs, as the station panel shows it, or null when it has none. */
export function yardOf(sim: Sim, station: number): UiYardService | null {
  const svc = yardService(sim, station);
  const def = sim.content.yard;
  const ship = playerShip(sim);
  if (!svc || !def) return null;
  const load = ship ? hullLoad(sim, ship) : { tiles: 0, capacity: 0 };
  return { size: svc.size, cap: svc.tier.cap, price: perTile(sim, svc), hull: { tiles: load.tiles, capacity: load.capacity, max: def.maxSize } };
}

/** The ship's hull plan for the build tools and the ghost tiles. */
export function planOf(sim: Sim): UiHullPlan {
  const v = viewPlan(sim);
  return { ship: playerShip(sim), tiles: v.tiles, connected: v.connected, loose: v.loose, blocked: v.blocked, floor: v.floor, hull: v.hull };
}

/** What the yard of `station` would build of the plan now. */
export function quoteOf(sim: Sim, station: number): UiYardQuote | null {
  if (!station) return null;
  const q = quoteYard(sim, station);
  return {
    station, error: q.error, errorText: q.error ? rejectionMessage(q.error) : '', buy: q.walls.length, floor: q.floor.length, planned: q.planned, rest: q.rest,
    price: q.price, afford: q.afford, cap: q.cap, hull: q.hull,
  };
}

function orderOf(sim: Sim, o: YardOrder): UiYardOrder {
  const b = builtCount(sim, o);
  const live = isLiveOrder(o);
  const grid = shipGrid(sim, o.ship);
  const open = (t: Tile): boolean => !!grid && grid.inBounds(t.x, t.y) && grid.get('struct', t.x, t.y) === Struct.Space;
  return {
    id: o.id, station: o.station, live, phase: o.phase, built: b.floor + b.walls, total: totalTiles(o), price: o.price,
    status: live ? PHASE[o.phase] : o.reason ? ENDED[o.reason] ?? o.reason : 'Done', reason: o.reason ? ENDED[o.reason] ?? o.reason : '',
    floor: live ? o.floor.filter(open) : [], walls: live ? o.walls.filter(open) : [],
  };
}

/** The shipyard view: the hull plan, the quote at `station` (the open station panel) and the player's live order (else the last one to end). */
export function buildYard(sim: Sim, station: number): UiYard {
  const mine = sim.yard.orders.filter((o) => o.ship === playerShip(sim));
  const o = mine.find(isLiveOrder) ?? mine[mine.length - 1];
  return { plan: planOf(sim), quote: quoteOf(sim, station), order: o ? orderOf(sim, o) : null };
}
