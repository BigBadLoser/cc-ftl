import { PATROL_CHASE_TURNS } from '../blackmarket/tuning';
import { strHash } from '../galaxy/hash';
import { makeHunters } from '../galaxy/roster';
import { ensureChunkOf, galaxyIndex, nodeOf } from '../galaxy/state';
import type { Port } from '../galaxy/ports';
import type { Sim } from '../sim';

/**
 * Debug (`debug.patrol`, the `?scenario=patrol` start): a patrol of `faction` at `node`, chasing the player (`Fleet.chase`), so it crosses the player's
 * next hop into `node` and hails them whatever the passing odds. It is made as a hunter group from a stand-in port at the node. False when it cannot be.
 */
export function debugPatrol(sim: Sim, node: string, faction: string): boolean {
  ensureChunkOf(sim, node);
  if (!galaxyIndex(sim.galaxy).nodes.has(node)) return false;
  const g = sim.galaxy;
  const port = { id: `${node}#0`, node, kind: 'station', size: 1, owner: faction, role: 'patrol', trade: false } as Port;
  const f = makeHunters(sim, port, faction, 'patrol', nodeOf(sim, node)?.danger ?? 0, [strHash(node), g.turn, 0xd3b], 6, 1, g.turn);
  if (!f) return false;
  f.hunt = { until: g.turn + PATROL_CHASE_TURNS };
  f.chase = true;
  g.fleets.push(f);
  g.rev++;
  return true;
}
