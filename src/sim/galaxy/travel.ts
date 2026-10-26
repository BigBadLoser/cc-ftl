import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { isLive } from '../trade/deals';
import { playerShipInfo } from './arrivals';
import { ftlCharge, fuelStock, jumpFuel } from './fuel';
import { chunkOfId } from './generator';
import { syncFleets } from './fleets';
import { repKey } from './standing';
import { currentNode, ensureAround, ensureChunkOf, galaxyIndex } from './state';
import { ARRIVAL_EVERY_SEC, SENSOR_HOPS } from './tuning';
import type { EdgeData, NodeData } from './types';

/** Why a jump along `edge` cannot go now, or null when it can (the single-hop check; routes use `routeBlocker`). */
export function jumpBlocker(sim: Sim, edge: EdgeData | undefined, ship?: number): 'noRoute' | 'noShip' | 'notCharged' | 'noFuel' | null {
  if (!edge) return 'noRoute';
  const charge = ftlCharge(sim, ship);
  if (charge === null) return 'noShip';
  if (charge + 1e-9 < edge.charge) return 'notCharged';
  if (fuelStock(sim, ship) < jumpFuel(sim, edge.fuel, ship)) return 'noFuel';
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
export function arrive(sim: Sim): void {
  const g = sim.galaxy;
  ensureAround(sim, g.current);
  g.visited[g.current] ??= sim.tick;
  discover(sim);
  const data = currentNode(sim);
  if (data) setContext(sim, data);
  syncFleets(sim, g.turn);
  g.rev++;
}

/** Set up the galaxy for a new game: the start node (the ship is already in it), its frontier and the first scan. */
export function startGalaxy(sim: Sim): void {
  arrive(sim);
  sim.galaxy.nodes[sim.galaxy.current] = { contacts: [], entered: true };
  sim.galaxy.nextArrival = sim.tick + Math.round(ARRIVAL_EVERY_SEC * TICK_HZ);
}

export type Reject = (reason: string) => false;

/** The player's flown ship may leave now: sector active, a ship with combat state, no live trade deal. */
export function checkLeaving(sim: Sim, ship: number, reject: Reject): boolean {
  if (sim.galaxy.event) return reject('inEvent');
  if (sim.sector.state === 'hyperspace') return reject('inHyperspace');
  if (sim.sector.state !== 'active') return reject('deploying');
  const me = playerShipInfo(sim);
  if (!me || me.id !== ship) return reject('notPlayerShip');
  // A deal in flight names ships, shuttles and escrow of this sector: finish or cancel it first.
  if (sim.trade.deals.some(isLive)) return reject('tradeInProgress');
  return true;
}
