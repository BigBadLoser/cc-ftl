import { CombatC } from '../combat/components';
import { takeItems } from '../story/effects';
import { playerStock } from '../story/world';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { leaveNode } from '../sector/jump';
import { isLive } from '../trade/deals';
import { playerShipInfo } from './arrivals';
import { chunkOfId } from './generator';
import { edgeBetween } from './route';
import { repKey } from './standing';
import { currentNode, ensureAround, ensureChunkOf, galaxyIndex } from './state';
import { ARRIVAL_EVERY_SEC, SENSOR_HOPS } from './tuning';
import type { EdgeData, NodeData } from './types';

/** The item jumps burn. */
export const FUEL_ITEM = 'item.fuel';

/** Why a jump along `edge` cannot go now, or null when it can. */
export function jumpBlocker(sim: Sim, edge: EdgeData | undefined): 'noRoute' | 'noShip' | 'notCharged' | 'noFuel' | null {
  if (!edge) return 'noRoute';
  const me = playerShipInfo(sim);
  const combat = me ? sim.world.get(me.id, CombatC) : undefined;
  if (!me || !combat) return 'noShip';
  if (combat.ftl + 1e-9 < edge.charge) return 'notCharged';
  if (playerStock(sim, FUEL_ITEM) < edge.fuel) return 'noFuel';
  return null;
}

/**
 * Sensors: mark every node of the current sector, and every node within SENSOR_HOPS jumps of the current one,
 * discovered (so every exit of your sector can be plotted to). Hyperlanes that lead into chunks not generated yet
 * generate them first, so the scan never stops at a seam.
 */
export function discover(sim: Sim): number {
  const g = sim.galaxy;
  let frontier = [g.current];
  const seen = new Set(frontier);
  let found = 0;
  for (let hop = 0; hop <= SENSOR_HOPS; hop++) {
    for (const id of frontier) {
      if (g.discovered[id] === undefined) {
        g.discovered[id] = sim.tick;
        found++;
      }
    }
    if (hop === SENSOR_HOPS) break;
    for (const id of frontier) {
      const key = chunkOfId(id);
      for (const e of (key && g.chunks[key]?.edges) || []) {
        if (e.a === id) ensureChunkOf(sim, e.b);
        if (e.b === id) ensureChunkOf(sim, e.a);
      }
    }
    const index = galaxyIndex(g);
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of index.adjacent.get(id) ?? []) {
        const other = e.a === id ? e.b : e.a;
        if (seen.has(other)) continue;
        seen.add(other);
        next.push(other);
      }
    }
    frontier = next.sort();
  }
  const here = galaxyIndex(g).nodes.get(g.current);
  for (const id of (here && galaxyIndex(g).sectors.get(here.sector)?.nodes) ?? []) {
    if (g.discovered[id] === undefined) {
      g.discovered[id] = sim.tick;
      found++;
    }
  }
  if (found) {
    g.rev++;
    sim.events.emit({ type: 'galaxy.discovered', count: found });
  }
  return found;
}

/** Point the story pool (danger tier, territory by its owner's reputation key, e.g. 'corp') at a node. Enemy generation reads the node's danger directly. */
function setContext(sim: Sim, node: NodeData): void {
  sim.story.context.danger = node.danger;
  sim.story.context.faction = node.faction ? repKey(sim, node.faction) : null;
}

/** The galaxy side of arriving at `sim.galaxy.current`: frontier, visited, the sensor scan and the story context. */
function arrive(sim: Sim): void {
  const g = sim.galaxy;
  ensureAround(sim, g.current);
  g.visited[g.current] ??= sim.tick;
  discover(sim);
  const data = currentNode(sim);
  if (data) setContext(sim, data);
  g.rev++;
}

/** Set up the galaxy for a new game: the start node (the ship is already in it), its frontier and the first scan. */
export function startGalaxy(sim: Sim): void {
  arrive(sim);
  sim.galaxy.nodes[sim.galaxy.current] = { contacts: [], entered: true };
  sim.galaxy.nextArrival = sim.tick + Math.round(ARRIVAL_EVERY_SEC * TICK_HZ);
}

type Reject = (reason: string) => false;

/** The player's flown ship may leave now: sector active, a ship with combat state, no live trade deal.  */
function checkLeaving(sim: Sim, ship: number, reject: Reject): boolean {
  if (sim.sector.state !== 'active') return reject('deploying');
  const me = playerShipInfo(sim);
  if (!me || me.id !== ship) return reject('notPlayerShip');
  // A deal in flight names ships, shuttles and escrow of this sector: finish or cancel it first.
  if (sim.trade.deals.some(isLive)) return reject('tradeInProgress');
  return true;
}

/**
 * Pay for `edge` and leave: spend its FTL charge and fuel, lift the ship out (`leaveNode`), then move the galaxy: `current`
 * follows the sector, the jump is counted, the arrival scan runs and the story draw is owed for `sector.deploy`.
 * `edge` null = a free move (debug teleport). The caller has validated; nothing here can fail after the payment.
 */
function go(sim: Sim, ship: number, to: string, edge: EdgeData | null, withDocked: number[] | undefined): void {
  const g = sim.galaxy;
  const combat = sim.world.get(ship, CombatC);
  if (edge && combat) combat.ftl = Math.max(0, combat.ftl - edge.charge);
  if (edge) takeItems(sim, FUEL_ITEM, edge.fuel);
  const from = g.current;
  leaveNode(sim, ship, to, withDocked ?? false);
  // The node left keeps its ships in its archive: no descriptors of it remain.
  const left = g.nodes[from];
  if (left) left.contacts = [];
  g.current = to;
  if (edge) {
    g.jumps++;
    g.days = Math.round((g.days + edge.time) * 10) / 10;
    sim.events.emit({ type: 'galaxy.jumped', from, to, edge: edge.id, fuel: edge.fuel, charge: edge.charge });
  }
  arrive(sim);
  g.pendingDraw = edge ? (edge.anchor ? 'transit' : 'arrival') : null;
}

/** `galaxy.jump`: validate the edge, charge and fuel (and that the ship may leave), then pay and go. Rejects with a reason code. */
export function jump(sim: Sim, ship: number, to: string, withDocked?: number[], command = 'galaxy.jump'): boolean {
  const g = sim.galaxy;
  const reject: Reject = (reason) => (sim.events.emit({ type: 'command.rejected', command, reason }), false);
  if (!checkLeaving(sim, ship, reject)) return false;
  if (!galaxyIndex(g).nodes.has(g.current)) ensureAround(sim, g.current);
  const edge = edgeBetween(g, g.current, to);
  const blocked = jumpBlocker(sim, edge);
  if (blocked || !edge) return reject(blocked ?? 'noRoute');
  go(sim, ship, to, edge, withDocked);
  return true;
}

/**
 * The player's flee: a jump to `to` (an adjacent node), else to the cheapest connected node it can pay for now (least fuel,
 * then charge, then node id); when none is affordable the cheapest one's blocker is the reason. Same payment as a jump.
 */
export function flee(sim: Sim, ship: number, to?: string): boolean {
  const g = sim.galaxy;
  if (!galaxyIndex(g).nodes.has(g.current)) ensureAround(sim, g.current);
  const options = (galaxyIndex(g).adjacent.get(g.current) ?? [])
    .map((e) => ({ e, to: e.a === g.current ? e.b : e.a }))
    .filter((o) => to === undefined || o.to === to)
    .sort((p, q) => p.e.fuel - q.e.fuel || p.e.charge - q.e.charge || (p.to < q.to ? -1 : 1));
  const pick = options.find((o) => jumpBlocker(sim, o.e) === null) ?? options[0];
  return jump(sim, ship, pick?.to ?? to ?? '', undefined, 'combat.flee');
}

/** Debug: move the player's ship to any generated node at no cost (the same lift, archive and deploy path). */
export function teleport(sim: Sim, to: string): boolean {
  const reject: Reject = (reason) => (sim.events.emit({ type: 'command.rejected', command: 'debug.galaxyTeleport', reason }), false);
  const me = playerShipInfo(sim);
  if (!me) return reject('notPlayerShip');
  if (!checkLeaving(sim, me.id, reject)) return false;
  go(sim, me.id, to, null, undefined);
  return true;
}
