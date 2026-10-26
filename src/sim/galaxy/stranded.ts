import type { Sim } from '../sim';
import { reputationOf } from '../story/state';
import { spillItems } from '../items/stacks';
import { storageAdd } from '../items/storage';
import { ModuleC } from '../modules/components';
import { playerShip } from '../trade/player';
import { FUEL_ITEM, fuelStock, storagesOf } from './fuel';
import { econOf, stockAt, valueAt } from './market';
import { portsAt } from './portIndex';
import { galaxyIndex } from './state';
import { DISTRESS_HOPS, DISTRESS_MARKUP, DISTRESS_MIN_FUEL, DISTRESS_TURNS, DISTRESS_UNPAID_REP } from './tuning';
import type { Distress } from './types';

/**
 * Stranding and the distress tug. Pure functions of the sim state; the one saved piece is `GalaxyState.distress` (a call waiting for its tug).
 * Design: the tug always delivers (never a dead end). The player pays what they can for it at DISTRESS_MARKUP times the base price; what they cannot pay
 * costs reputation with the traders (`DISTRESS_UNPAID_REP`) instead of a debt, so there is nothing to track afterwards.
 */

/** Fuel the cheapest jump out of the current node costs (over edges to discovered nodes, else any edge), or null when the node has no lane. */
export function cheapestHop(sim: Sim): number | null {
  const g = sim.galaxy;
  const edges = galaxyIndex(g).adjacent.get(g.current) ?? [];
  const known = edges.filter((e) => g.discovered[e.a === g.current ? e.b : e.a] !== undefined);
  const list = known.length ? known : edges;
  return list.length ? Math.min(...list.map((e) => e.fuel)) : null;
}

/** True while the ship sits at a node (not in hyperspace or an event grid) holding less fuel than its cheapest jump costs. */
export function isStranded(sim: Sim): boolean {
  const g = sim.galaxy;
  if (!sim.content.galaxy || sim.sector.state !== 'active' || g.event || g.travel) return false;
  const need = cheapestHop(sim);
  return need !== null && fuelStock(sim, playerShip(sim)) < need;
}

/** The hail rule (`hailVerdict`) for a market with no ship: faction relation + trader kind relation + the player's reputation must be at least 0, else it will not trade. */
function wouldTrade(sim: Sim, t: { faction: string; profile: string }): boolean {
  const cfg = sim.content.trade;
  const fac = cfg?.factions[t.faction];
  const score = (fac?.relation ?? 0) + (cfg?.traders[t.profile]?.relation ?? 0) + (fac ? reputationOf(sim.story, fac.reputation) : 0);
  return score >= 0;
}

/** Put fuel in the flown ship's own storage (what `fuelStock` and jumps read); what does not fit lands on the floor of that ship. Returns units that found no room. */
function deliver(sim: Sim, ship: number, count: number): number {
  let left = count;
  const stores = storagesOf(sim, ship);
  for (const id of stores) left -= storageAdd(sim, id, FUEL_ITEM, left);
  const first = stores[0] === undefined ? undefined : sim.world.get(stores[0], ModuleC);
  if (left > 0 && first) left = spillItems(sim, ship, first.x, first.y, FUEL_ITEM, left);
  return left;
}

/**
 * Fuel the player could buy from a station in this node now: the shelf, capped by what their credits pay at the station's price (the market value plus the
 * trade spread; reputation shifts it a little). Civilian stations and mining outposts only: dens and depots may refuse a hail.
 */
export function fuelOnSale(sim: Sim): number {
  let n = 0;
  const spread = sim.content.trade?.spread.sell ?? 1;
  for (const p of portsAt(sim, sim.galaxy.current)) {
    if (p.kind !== 'station' && p.kind !== 'outpost') continue;
    const e = econOf(sim, p);
    if (!e || !wouldTrade(sim, e.trader)) continue;
    const shelf = Math.floor(stockAt(sim, e, sim.galaxy.turn)[FUEL_ITEM] ?? 0);
    const unit = Math.max(1, Math.ceil(valueAt(sim, e, FUEL_ITEM, shelf) * spread));
    n += Math.min(shelf, Math.floor(Math.max(0, sim.trade.credits) / unit));
  }
  return n;
}

/** What the tug would bring and charge now. */
export interface TugQuote {
  fuel: number;
  unit: number;
  total: number;
}

export function tugQuote(sim: Sim): TugQuote {
  const unit = Math.round((sim.content.items[FUEL_ITEM]?.price ?? 1) * DISTRESS_MARKUP);
  const fuel = Math.max(DISTRESS_MIN_FUEL, DISTRESS_HOPS * (cheapestHop(sim) ?? 0));
  return { fuel, unit, total: fuel * unit };
}

/** Why a distress call cannot be sent now, or '' if it can. */
export function distressBlocker(sim: Sim): string {
  if (sim.galaxy.distress) return 'alreadyCalled';
  if (!isStranded(sim)) return 'notStranded';
  const need = (cheapestHop(sim) ?? 0) - fuelStock(sim, playerShip(sim));
  if (fuelOnSale(sim) >= need) return 'fuelOnSale';
  return '';
}

/** `galaxy.distress`: call for a tug. It comes after DISTRESS_TURNS turns. */
export function callForHelp(sim: Sim): boolean {
  const why = distressBlocker(sim);
  if (why) return (sim.events.emit({ type: 'command.rejected', command: 'galaxy.distress', reason: why }), false);
  const g = sim.galaxy;
  const call: Distress = { node: g.current, sent: g.turn, due: g.turn + DISTRESS_TURNS };
  g.distress = call;
  g.rev++;
  sim.events.emit({ type: 'galaxy.distressSent', node: call.node, due: call.due });
  return true;
}

/** Per turn: the tug arrives when its time is up. A call left behind (the ship is somewhere else) is dropped. */
export function stepDistress(sim: Sim, turn: number): void {
  const g = sim.galaxy;
  const call = g.distress;
  if (!call || turn < call.due) return;
  g.distress = null;
  g.rev++;
  if (sim.sector.state !== 'active' || g.current !== call.node) return;
  const q = tugQuote(sim);
  const paid = Math.min(Math.max(0, sim.trade.credits), q.total);
  sim.trade.credits -= paid;
  const left = deliver(sim, playerShip(sim), q.fuel);
  const owed = paid < q.total;
  if (owed) sim.story.reputation['traders'] = reputationOf(sim.story, 'traders') - DISTRESS_UNPAID_REP;
  sim.events.emit({ type: 'galaxy.towArrived', fuel: q.fuel - left, paid, owed: q.total - paid });
}
