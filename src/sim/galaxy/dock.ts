import type { Sim } from '../sim';
import { econOf, moveStock, stockAt, valueAt, type Econ } from './market';
import { portsAt, portOf } from './portIndex';
import { portNode, type Port } from './ports';
import { CARGO_BY_SIZE, MINER_ORE, MINER_RARE_SHARE, TRADE_CANDIDATES, TRADE_MIN_MARGIN, TRADE_TAKE_SHARE } from './tuning';
import type { Fleet } from './types';

/**
 * Docking: the NPC economy's moment (living world stage 3). `onDock(sim, fleet, port, stops)` runs on every arrival at a node with a port, inside the
 * turn step, at the fleet's own turn (`Fleet.synced`), so it is deterministic and the same whether the fleet is stepped or caught up.
 * - A **trader** sells its whole cargo into the port's market (what does not fit the shelf is dumped), then looks at its next stops (`stops`: the nodes its
 *   agenda may go to next): for each it prices every commodity here and there (`valueAt`: base price x kind mods x scarcity) and takes the goods whose price
 *   there beats the price here by TRADE_MIN_MARGIN, best margin first, up to half the stock and the hull's cargo. The stop with the most profit is its next
 *   stop (`Fleet.pick`); with no profitable stop it carries nothing and the agenda picks one as before. Credits are not tracked: the ports are bottomless.
 * - A **miner** loads ore at its field (`onWork`) and sells it into its home outpost's market when it gets home.
 * Everything a fleet carries is `Fleet.cargo`, plain (item, count) lines.
 */

/** The port a fleet of this role does business with at a node: miners at an outpost, everyone else at a station (any port as a fallback). */
export function dockPort(ports: readonly Port[], role: Fleet['role']): Port | undefined {
  const outpost = ports.find((p) => p.kind === 'outpost');
  return role === 'miner' ? outpost ?? ports[0] : ports.find((p) => p.kind !== 'outpost') ?? ports[0];
}

/** Units the fleet's hulls haul. */
export const cargoCap = (f: Fleet): number => f.ships.reduce((n, c) => n + CARGO_BY_SIZE[c.size ?? 'small'], 0);

/** Units the fleet carries. */
export const cargoLoad = (f: Fleet): number => (f.cargo ?? []).reduce((n, l) => n + l.count, 0);

function load(f: Fleet, item: string, count: number): void {
  if (count <= 0) return;
  const line = (f.cargo ??= []).find((l) => l.item === item);
  if (line) line.count += count;
  else f.cargo.push({ item, count });
}

/** Sell the whole cargo into the market. */
function unload(sim: Sim, f: Fleet, e: Econ): void {
  for (const l of f.cargo ?? []) moveStock(sim, e, f.synced, l.item, l.count);
  delete f.cargo;
}

/** A miner loads a hold of ore at its field. */
export function onWork(sim: Sim, f: Fleet): void {
  if (f.role !== 'miner' || !sim.content.galaxy || cargoLoad(f) > 0) return;
  const cap = cargoCap(f);
  const rare = Math.floor(cap * MINER_RARE_SHARE);
  load(f, MINER_ORE[0], cap - rare);
  load(f, MINER_ORE[1], rare);
}

/** Called when a fleet docks at a port: it has arrived at a node that has one (its home, or a stop of its outing) and is about to dwell there. */
export function onDock(sim: Sim, f: Fleet, port: Port, stops: () => string[]): void {
  if (!sim.content.galaxy) return;
  if (f.role === 'miner') {
    const home = f.node === portNode(f.home) ? portOf(sim, f.home) : undefined;
    const e = home && econOf(sim, home);
    if (e) unload(sim, f, e);
    else onWork(sim, f);
  } else if (f.role === 'trader') {
    const e = econOf(sim, port);
    if (e) trade(sim, f, e, stops());
  }
}

interface Plan {
  node: string;
  profit: number;
  buys: { item: string; count: number }[];
}

/** Sell here, buy for the stop that pays best. */
function trade(sim: Sim, f: Fleet, here: Econ, stops: string[]): void {
  unload(sim, f, here);
  const goods = sim.content.galaxy?.market.goods ?? [];
  const mine = stockAt(sim, here, f.synced);
  const cap = cargoCap(f);
  let best: Plan | null = null;
  for (const node of stops.slice(0, TRADE_CANDIDATES)) {
    const port = dockPort(portsAt(sim, node), 'trader');
    const there = port && econOf(sim, port);
    if (!there) continue;
    const theirs = stockAt(sim, there, f.synced);
    const rows: { item: string; take: number; margin: number }[] = [];
    for (const item of goods) {
      const have = Math.floor(mine[item] ?? 0);
      const take = Math.floor(have * TRADE_TAKE_SHARE);
      if (take < 1) continue;
      const cost = valueAt(sim, here, item, have);
      const margin = valueAt(sim, there, item, theirs[item] ?? 0) - cost;
      if (margin > 0 && margin >= TRADE_MIN_MARGIN * cost) rows.push({ item, take, margin });
    }
    rows.sort((a, b) => b.margin - a.margin || (a.item < b.item ? -1 : 1));
    const plan: Plan = { node, profit: 0, buys: [] };
    let room = cap;
    for (const r of rows) {
      const count = Math.min(r.take, room);
      if (count <= 0) break;
      plan.buys.push({ item: r.item, count });
      plan.profit += count * r.margin;
      room -= count;
    }
    if (plan.profit > (best?.profit ?? 0)) best = plan;
  }
  if (!best) return;
  for (const b of best.buys) load(f, b.item, -moveStock(sim, here, f.synced, b.item, -b.count));
  if (cargoLoad(f) > 0) f.pick = best.node;
}
