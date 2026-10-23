import type { Sim } from '../sim';
import { TraderC, type Trader } from '../trade/types';
import { advance, baseLines, econOf, toState, type Econ } from './market';
import { strHash, unit } from './hash';
import { portsAt } from './portIndex';
import type { Port } from './ports';

/**
 * The player's node and the world market (market.ts). A station standing in the player's node is the market of one of the node's ports while the player is
 * there: on entering, its trader takes the port's stock, baseline and profile (`bindMarkets`); while it is live the trader is the only copy, so trades by the
 * player and by NPC traders both change it and prices follow; each turn it moves the same way a frozen market would (`stepLiveMarkets`, rounded with a hashed
 * dither so slow rates still show); on leaving, what differs from the baseline is written back to `GalaxyState.markets` (`unbindMarkets`). A trader is bound
 * exactly while `Trader.port` is set. Nothing here runs for nodes without ports, and stations that are no port's are left alone.
 */

/** Unbound station traders of the sector, ascending id. */
function freeStations(sim: Sim): number[] {
  return sim.world.query(TraderC).filter((id) => {
    const t = sim.world.get(id, TraderC);
    return !!t && t.station && !t.port;
  }).sort((a, b) => a - b);
}

/** The station traders in the player's node become their ports' markets (idempotent: bound ones are left as they are). */
export function bindMarkets(sim: Sim): void {
  const g = sim.galaxy;
  if (!sim.content.galaxy || sim.sector.node !== g.current) return;
  const free = freeStations(sim);
  if (!free.length) return;
  const taken = new Set(sim.world.query(TraderC).map((id) => sim.world.get(id, TraderC)?.port));
  const ports = portsAt(sim, g.current).map((p) => econOf(sim, p)).filter((e): e is Econ => !!e && !taken.has(e.id));
  for (const id of free) {
    const t = sim.world.get(id, TraderC) as Trader;
    const i = Math.max(0, ports.findIndex((e) => e.profile === t.profile));
    const e = ports.splice(i, 1)[0];
    if (!e) break;
    bindTrader(sim, t, e);
  }
}

/** The trader becomes the port's market: its profile, baseline and stock as of now. */
function bindTrader(sim: Sim, t: Trader, e: Econ): void {
  const g = sim.galaxy;
  const full = advance(e, g.markets[e.id] ?? { turn: 0, stock: {} }, g.turn);
  t.port = e.id;
  t.profile = e.profile;
  t.base = baseLines(e);
  t.stock = Object.entries(full).filter(([, v]) => Math.round(v) > 0).map(([item, v]) => ({ item, count: Math.round(v) })).sort((a, b) => (a.item < b.item ? -1 : 1));
}

/** Bind a station that was made for a port (population.ts) to that port's market; false when the port has no market or the station no trader. */
export function bindStation(sim: Sim, station: number, port: Port): boolean {
  const t = sim.world.get(station, TraderC);
  const e = econOf(sim, port);
  if (!t || !e || t.port) return false;
  bindTrader(sim, t, e);
  return true;
}

/** The bound traders leave the market: their stock is written back as the port's state as of now and they are unbound. */
export function unbindMarkets(sim: Sim): void {
  const g = sim.galaxy;
  for (const id of sim.world.query(TraderC)) {
    const t = sim.world.get(id, TraderC) as Trader;
    if (!t.port) continue;
    const e = ownEcon(sim, t.port);
    if (e) {
      g.markets[e.id] = toState(e, shelves(e, t), g.turn);
    }
    delete t.port;
    delete t.base;
  }
}

/** Every shelf of the market as the live trader has it (an item it holds none of is 0, not its baseline). */
function shelves(e: Econ, t: Trader): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of e.items) out[item] = 0;
  for (const l of t.stock) out[l.item] = l.count;
  return out;
}

function ownEcon(sim: Sim, portId: string): Econ | null {
  const node = portId.slice(0, portId.indexOf('#'));
  const port = portsAt(sim, node).find((p) => p.id === portId);
  return port ? econOf(sim, port) : null;
}

/** One turn passes for the bound traders: each stock moves toward its level, rounded by a dither hashed from (seed, port, item, turn) so it stays deterministic. */
export function stepLiveMarkets(sim: Sim, turn: number): void {
  bindMarkets(sim);
  for (const id of sim.world.query(TraderC)) {
    const t = sim.world.get(id, TraderC) as Trader;
    if (!t.port) continue;
    const e = ownEcon(sim, t.port);
    if (!e) continue;
    const next = advance(e, { turn: turn - 1, stock: shelves(e, t) }, turn);
    const ph = strHash(e.id);
    t.stock = Object.entries(next)
      .map(([item, v]) => ({ item, count: Math.floor(v + unit(sim.seed, ph, strHash(item), turn, 74)) }))
      .filter((l) => l.count > 0)
      .sort((a, b) => (a.item < b.item ? -1 : 1));
  }
}
