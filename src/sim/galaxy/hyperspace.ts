import { dropOut, enterHyperspace } from '../sector/jump';
import type { Sim } from '../sim';
import { playerShipInfo, spawnContact } from './arrivals';
import { burnFuel, ftlCharge, fuelStock, spendCharge } from './fuel';
import { arrive, checkLeaving, type Reject } from './travel';
import { edgeBetween } from './route';
import { ensureAround, galaxyIndex, nodeState } from './state';
import { TURN_TICKS } from './tuning';
import { crossAfterHop, interdicted } from './encounters';
import { liftFleetsAt, materialiseFleetsAt } from './fleetShips';
import { bindMarkets, unbindMarkets } from './marketLive';
import { populateNode } from './populate';
import { placeWrecks } from './wrecks';
import { takeHopTurn } from './turn';
import type { EdgeData, Travel } from './types';

/**
 * Hyperspace travel (the one way the player's ship moves between nodes). `galaxy.jump { ship, route }` validates, pays the FTL
 * charge once and the first hop's fuel, lifts the ship out of its node (`enterHyperspace`) and starts the clock; `advanceTravel`
 * (one call per tick while `sector.state === 'hyperspace'`) carries it hop by hop, paying each hop's fuel as it is entered and
 * moving `galaxy.current` as each node is passed; `galaxy.drop` ends the trip at the node last passed.
 *
 * Rules (user feedback 2026-10-22, choices marked):
 * - Time: turn-based (user decision 2026-10-22). Each hop entered is one turn (`galaxy.turn`, `onTurn`); the sim moves one hop per
 *   TURN_TICKS ticks as pacing only. Edge days stay as data (`galaxy.days`) but do not set the pace.
 * - FTL charge: needed only to enter, the largest any hop needs, spent once (CHOICE: per-hop charge would make a hyperlane hop
 *   mid-route impossible without a fresh full drive).
 * - Drop: `galaxy.drop` at a node (between hops, at the end, or stalled) drops out there at once; mid-hop it cuts the route after the hop under
 *   way and drops out at the next node on arrival (CHOICE: the ship is in a lane, not at a node, and falling back would waste the hop's fuel).
 * - Fuel: paid as each hop is entered; a route may be started with fuel for its first hop only, and stops (phase 'noFuel') at the
 *   last node reached when the next hop cannot be paid.
 */

/** Ticks a hop takes: a fixed pace (the map is turn-based, an edge's days do not stretch it). */
export const hopTicksOf = (): number => TURN_TICKS;

/** The edges along `nodes` (each consecutive pair), or null when any pair is not joined. */
export function routeEdges(sim: Sim, nodes: readonly string[]): EdgeData[] | null {
  const out: EdgeData[] = [];
  for (let i = 0; i + 1 < nodes.length; i++) {
    const e = edgeBetween(sim.galaxy, nodes[i] as string, nodes[i + 1] as string);
    if (!e) return null;
    out.push(e);
  }
  return out.length ? out : null;
}

/** FTL charge a route needs to enter hyperspace: the most any of its hops asks for. */
export const routeCharge = (edges: readonly EdgeData[]): number => edges.reduce((m, e) => Math.max(m, e.charge), 0);

/** Why a trip along `edges` cannot start now, or null: no route, no ship, the drive is short of `routeCharge`, or no fuel for the first hop. */
export function routeBlocker(sim: Sim, edges: readonly EdgeData[] | null, ship?: number): 'noRoute' | 'noShip' | 'notCharged' | 'noFuel' | null {
  if (!edges || !edges.length) return 'noRoute';
  const charge = ftlCharge(sim, ship);
  if (charge === null) return 'noShip';
  if (charge + 1e-9 < routeCharge(edges)) return 'notCharged';
  if (fuelStock(sim, ship) < (edges[0] as EdgeData).fuel) return 'noFuel';
  return null;
}

/** `galaxy.jump`: validate the route, pay the charge and the first hop, lift the ship out and enter hyperspace. */
export function jump(sim: Sim, ship: number, route: readonly string[], withDocked?: number[], command = 'galaxy.jump'): boolean {
  const g = sim.galaxy;
  const reject: Reject = (reason) => (sim.events.emit({ type: 'command.rejected', command, reason }), false);
  if (!checkLeaving(sim, ship, reject)) return false;
  // A pending interdiction holds the ship until it is resolved (`galaxy.respond`); the player's own flee is never blocked.
  if (command !== 'combat.flee' && interdicted(sim)) return reject('interdicted');
  if (!galaxyIndex(g).nodes.has(g.current)) ensureAround(sim, g.current);
  const nodes = [g.current, ...route];
  const edges = routeEdges(sim, nodes);
  const blocked = routeBlocker(sim, edges, ship);
  if (blocked || !edges) return reject(blocked ?? 'noRoute');
  const first = edges[0] as EdgeData;
  const charge = routeCharge(edges);
  spendCharge(sim, charge, ship);
  burnFuel(sim, first.fuel, ship);
  g.pendingDraw = null;
  unbindMarkets(sim);
  liftFleetsAt(sim, g.current);
  enterHyperspace(sim, ship, withDocked ?? false);
  // The node left keeps its ships in its archive: no descriptors of it remain.
  const left = g.nodes[g.current];
  if (left) left.contacts = [];
  g.travel = { route: nodes, charge, at: 0, elapsed: 0, hopTicks: hopTicksOf(), phase: 'hop' };
  takeHopTurn(sim);
  g.rev++;
  sim.events.emit({ type: 'galaxy.hyperspace', ship, route: nodes, charge });
  return true;
}

/**
 * One tick of travel: the clock runs; when a hop is done the ship is at the next node (`galaxy.current` and `sector.node` follow,
 * the arrival scan runs, the hop is counted) and the next hop starts if its fuel can be paid, else the trip stops.
 */
export function advanceTravel(sim: Sim): void {
  const g = sim.galaxy;
  const t = g.travel;
  if (!t || t.phase !== 'hop') return;
  if (++t.elapsed < t.hopTicks) return;
  const edge = edgeBetween(g, t.route[t.at] as string, t.route[t.at + 1] as string) as EdgeData;
  const from = t.route[t.at] as string;
  t.at++;
  g.current = t.route[t.at] as string;
  sim.sector.node = g.current;
  g.jumps++;
  g.days = Math.round((g.days + edge.time) * 10) / 10;
  sim.events.emit({ type: 'galaxy.jumped', from, to: g.current, edge: edge.id, fuel: edge.fuel, charge: from === t.route[0] ? t.charge : 0 });
  arrive(sim);
  // One draw per trip, resolved at deploy. An anchored lane anywhere on the route owes the (rarer) transit draw, which a later plain hop
  // must not overwrite: transit wins over arrival.
  g.pendingDraw = g.pendingDraw === 'transit' || edge.anchor ? 'transit' : 'arrival';
  t.elapsed = 0;
  // The turn ends here: a fleet that crossed the hop, or is in this node, may interdict. The ship halts in hyperspace until `galaxy.respond` settles it.
  if (crossAfterHop(sim, from, g.current)) {
    t.phase = 'interdicted';
    sim.events.emit({ type: 'galaxy.interdicted', node: g.current });
    return;
  }
  resumeAfterHop(sim, t);
}

/**
 * What follows a finished hop (also what an interdicted trip does once it is let go): at the end of the route the trip is 'arrived' (and drops
 * if a drop was asked for), else the next hop starts if its fuel can be paid, else the trip stops for want of fuel.
 */
export function resumeAfterHop(sim: Sim, t: Travel | null = sim.galaxy.travel): void {
  const g = sim.galaxy;
  if (!t) return;
  if (t.at >= t.route.length - 1) {
    t.phase = 'arrived';
    if (t.stopping) drop(sim);
    return;
  }
  t.phase = 'hop';
  const next = edgeBetween(g, g.current, t.route[t.at + 1] as string) as EdgeData;
  if (fuelStock(sim) < next.fuel) {
    t.phase = 'noFuel';
    sim.events.emit({ type: 'galaxy.stalled', node: g.current, need: next.fuel });
    return;
  }
  burnFuel(sim, next.fuel);
  t.hopTicks = hopTicksOf();
  takeHopTurn(sim);
}

/**
 * `galaxy.drop`: end the trip at `galaxy.current` (the node last passed). The node's archive is restored, or, on the first entry,
 * its generated contacts become real ships placed by the deploy bounds and gap rule (the archive owns them once the node is left);
 * the ship then waits in state 'deploying' for `sector.deploy`.
 */
export function drop(sim: Sim, command = 'galaxy.drop'): boolean {
  const g = sim.galaxy;
  const t = g.travel;
  if (sim.sector.state !== 'hyperspace' || !t) return sim.events.emit({ type: 'command.rejected', command, reason: 'notInHyperspace' }), false;
  // An interdiction or an event grid must be settled first.
  if (t.phase === 'interdicted' || t.phase === 'event') return sim.events.emit({ type: 'command.rejected', command, reason: t.phase === 'event' ? 'inEvent' : 'interdicted' }), false;
  if (t.phase === 'hop' && t.elapsed > 0) {
    t.route.length = t.at + 2;
    t.stopping = true;
    return true;
  }
  dropOut(sim, t.route[0] as string);
  const st = nodeState(sim, g.current);
  const first = !st.entered;
  if (first) {
    st.entered = true;
    for (const c of st.contacts) spawnContact(sim, g.current, c);
    st.contacts = st.contacts.filter((c) => c.ship !== undefined);
  }
  materialiseFleetsAt(sim, g.current);
  // The node's structures go in last, east of the ships already there (and of the free water the player deploys in), then the stations become markets.
  if (first) populateNode(sim, g.current);
  // What fights left here while the player was away (meetings.ts) is found now, on a first visit and on a return alike.
  placeWrecks(sim, g.current);
  bindMarkets(sim);
  g.travel = null;
  g.rev++;
  sim.events.emit({ type: 'galaxy.dropped', node: g.current });
  return true;
}

/**
 * The player's flee: a one-hop hyperspace trip to `to` (an adjacent node), else to the cheapest connected node it can pay for now
 * (least fuel, then charge, then node id); when none is affordable the cheapest one's blocker is the reason.
 */
export function flee(sim: Sim, ship: number, to?: string): boolean {
  const g = sim.galaxy;
  if (!galaxyIndex(g).nodes.has(g.current)) ensureAround(sim, g.current);
  const options = (galaxyIndex(g).adjacent.get(g.current) ?? [])
    .map((e) => ({ e, to: e.a === g.current ? e.b : e.a }))
    .filter((o) => to === undefined || o.to === to)
    .sort((p, q) => p.e.fuel - q.e.fuel || p.e.charge - q.e.charge || (p.to < q.to ? -1 : 1));
  const pick = options.find((o) => routeBlocker(sim, [o.e]) === null) ?? options[0];
  return jump(sim, ship, [pick?.to ?? to ?? ''], undefined, 'combat.flee');
}

/** Debug: move the player's ship to any generated node at no cost: into hyperspace and straight out again (then it waits to deploy). */
export function teleport(sim: Sim, to: string): boolean {
  const g = sim.galaxy;
  const reject: Reject = (reason) => (sim.events.emit({ type: 'command.rejected', command: 'debug.galaxyTeleport', reason }), false);
  const me = playerShipInfo(sim);
  if (!me) return reject('notPlayerShip');
  if (!checkLeaving(sim, me.id, reject)) return false;
  const from = g.current;
  unbindMarkets(sim);
  liftFleetsAt(sim, from);
  enterHyperspace(sim, me.id, false);
  const left = g.nodes[from];
  if (left) left.contacts = [];
  g.current = to;
  sim.sector.node = to;
  arrive(sim);
  g.pendingDraw = null;
  g.travel = { route: [from, to], charge: 0, at: 1, elapsed: 0, hopTicks: 1, phase: 'arrived' };
  return drop(sim, 'debug.galaxyTeleport');
}
