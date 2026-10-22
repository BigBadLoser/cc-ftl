import { CombatC } from '../combat/components';
import { drawEvent } from '../story/engine';
import { takeItems } from '../story/effects';
import { playerStock } from '../story/world';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { playerShipInfo, spawnPresent } from './arrivals';
import { chunkOfId } from './generator';
import { edgeBetween } from './route';
import { isHostileFaction, repKey } from './standing';
import { currentNode, ensureAround, ensureChunkOf, galaxyIndex, nodeState } from './state';
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

/**
 * Arriving at a node: generate the frontier, scan, set the context events and enemy generation read, restart the
 * arrival clock, bring in the hostile ships present, and draw an arrival event (a 'transit' one after an anchored
 * hyperlane) unless enemies are waiting.
 *
 * HOOK (sector refactor step 9): this is where the player's ship (plus docked vehicles) is lifted into a packet, the
 * node left behind is archived, the new node's grid is generated or restored with its structures
 * (`NodeData.structures`) and the deploy modal opens. Until then the sector grid is not swapped: ships of the node left
 * behind stay where they are, and new arrivals are placed around the player by the gap rule.
 */
export function enterNode(sim: Sim, node: string, via: EdgeData | null): void {
  const g = sim.galaxy;
  ensureAround(sim, node);
  g.visited[node] ??= sim.tick;
  discover(sim);
  const data = currentNode(sim);
  if (!data) return;
  setContext(sim, data);
  g.nextArrival = sim.tick + Math.round(ARRIVAL_EVERY_SEC * TICK_HZ);
  spawnPresent(sim);
  const enemies = nodeState(sim, node).contacts.some((c) => isHostileFaction(sim, c.faction));
  if (via && !enemies) drawEvent(sim, via.anchor ? 'transit' : 'arrival');
  g.rev++;
}

/** Set up the galaxy for a new game: the start node, its frontier and the first scan. */
export function startGalaxy(sim: Sim): void {
  enterNode(sim, sim.galaxy.current, null);
}

/** Jump one edge from the current node to `to`, spending its fuel and FTL charge. Rejects with a reason code. */
export function jump(sim: Sim, to: string): void {
  const g = sim.galaxy;
  if (sim.sector.state === 'deploying') return void sim.events.emit({ type: 'command.rejected', command: 'galaxy.jump', reason: 'deploying' });
  if (!galaxyIndex(g).nodes.has(g.current)) ensureAround(sim, g.current);
  const edge = edgeBetween(g, g.current, to);
  const blocked = jumpBlocker(sim, edge);
  if (blocked || !edge) return void sim.events.emit({ type: 'command.rejected', command: 'galaxy.jump', reason: blocked ?? 'noRoute' });
  const me = playerShipInfo(sim);
  const combat = me ? sim.world.get(me.id, CombatC) : undefined;
  if (combat) combat.ftl = Math.max(0, combat.ftl - edge.charge);
  takeItems(sim, FUEL_ITEM, edge.fuel);
  const from = g.current;
  g.current = to;
  g.jumps++;
  g.days = Math.round((g.days + edge.time) * 10) / 10;
  sim.events.emit({ type: 'galaxy.jumped', from, to, edge: edge.id, fuel: edge.fuel, charge: edge.charge });
  enterNode(sim, to, edge);
}
