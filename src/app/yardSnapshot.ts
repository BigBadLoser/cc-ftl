import { hullLoad, isLiveOrder, planYard, playerShip, shipArea, totalTiles, yardPrice, yardService, builtCount, type Sim, type YardOrder, type YardPhase } from '../sim';
import type { UiYard, UiYardOrder, UiYardPlan, UiYardService } from '../ui/api';
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

/** The yard a station runs, as the station panel shows it, or null when it has none. */
export function yardOf(sim: Sim, station: number): UiYardService | null {
  const svc = yardService(sim, station);
  const def = sim.content.yard;
  const ship = playerShip(sim);
  if (!svc || !def) return null;
  const load = ship ? hullLoad(sim, ship) : { tiles: 0, capacity: 0 };
  return { size: svc.size, cap: svc.tier.cap, maxTiles: def.maxTiles, price: yardPrice(sim, svc, 1), area: ship ? shipArea(sim, ship) : 0, hull: { tiles: load.tiles, capacity: load.capacity } };
}

/** The painted hull checked and priced; null when nothing is planned. */
export function planOf(sim: Sim, station: number, tiles: readonly Tile[]): UiYardPlan | null {
  if (!station) return null;
  const p = planYard(sim, station, tiles);
  return {
    station, tiles: p.floor, walls: p.walls, bad: p.bad, error: p.error, errorText: p.error ? rejectionMessage(p.error) : '', price: p.price, afford: p.afford,
    cap: p.cap, maxTiles: p.maxTiles, area: p.area, areaAfter: p.areaAfter, hull: p.hull,
  };
}

function orderOf(sim: Sim, o: YardOrder): UiYardOrder {
  const b = builtCount(sim, o);
  const live = isLiveOrder(o);
  return {
    id: o.id, station: o.station, live, phase: o.phase, built: b.floor + b.walls, total: totalTiles(o), price: o.price,
    status: live ? PHASE[o.phase] : o.reason ? ENDED[o.reason] ?? o.reason : 'Done', reason: o.reason ? ENDED[o.reason] ?? o.reason : '',
  };
}

/** The shipyard view: the plan for what is painted at `station`, and the player's live order (else the last one to end). */
export function buildYard(sim: Sim, station: number, tiles: readonly Tile[]): UiYard {
  const mine = sim.yard.orders.filter((o) => o.ship === playerShip(sim));
  const o = mine.find(isLiveOrder) ?? mine[mine.length - 1];
  return { plan: tiles.length ? planOf(sim, station, tiles) : null, order: o ? orderOf(sim, o) : null };
}
