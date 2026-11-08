import { strHash } from './hash';
import { makeHunters } from './roster';
import { ensureChunkOf, galaxyIndex, nodeOf } from './state';
import type { Port } from './ports';
import type { FleetRole } from './types';
import type { Sim } from '../sim';

/** How long the debug fleet waits at its node, in turns, or how long a debug hunter follows the player. */
const DEBUG_WAIT = 6;

/**
 * Debug (`debug.pirates`, the `?scenario=pirates` start): a fleet of `faction`'s raiding role (or its patrol, for a lawful faction made a hunter) at
 * `node`, waiting there, so the player's next hop into `node` meets it. `hunt` makes it hunters sent after the player instead (they follow the player).
 * It interdicts only if the faction is hostile to the player. False when it cannot be made.
 */
export function debugPirates(sim: Sim, node: string, faction: string, hunt: boolean): boolean {
  ensureChunkOf(sim, node);
  if (!galaxyIndex(sim.galaxy).nodes.has(node)) return false;
  const groups = sim.content.galaxy?.factions[faction]?.fleet?.groups ?? {};
  const role = (['pirate', 'raider', 'patrol'] as const).find((r) => groups[r as FleetRole]);
  if (!role) return false;
  const g = sim.galaxy;
  const port = { id: `${node}#0`, node, kind: 'station', size: 1, owner: faction, role, trade: false } as Port;
  const f = makeHunters(sim, port, faction, role, nodeOf(sim, node)?.danger ?? 0, [strHash(node), g.turn, 0x91a7], 4, 2, g.turn);
  if (!f) return false;
  if (hunt) f.hunt = { until: g.turn + DEBUG_WAIT };
  else f.dwell = DEBUG_WAIT;
  g.fleets.push(f);
  g.rev++;
  return true;
}
