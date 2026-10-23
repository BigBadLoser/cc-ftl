import type { Sim } from '../sim';
import { sensorNodes } from './fleets';
import { fleetName } from './names';
import { isHostileFaction } from './standing';
import type { Fleet } from './types';

/** A fleet on its way to the player's node (a pure query for the arrival warning; nothing here changes the sim). */
export interface IncomingFleet {
  fleet: number;
  /** The fleet's display name: its first ship's name, "+n" for the rest. */
  name: string;
  faction: string;
  role: Fleet['role'];
  ships: number;
  hostile: boolean;
  /** Turns until it is at the player's node: 1 = it drops out after the next turn. */
  eta: number;
  /** True when the node is its destination (it stays), false when it only passes through. */
  stops: boolean;
}

/**
 * The fleets within sensor range whose route reaches the player's current node, nearest first (then ascending id). Fleets move one hop
 * a turn, so the node's place in the remaining route is the ETA. Stranded (damaged) fleets never move and are never incoming.
 */
export function incomingFleets(sim: Sim): IncomingFleet[] {
  const g = sim.galaxy;
  const seen = sensorNodes(sim);
  const out: IncomingFleet[] = [];
  for (const f of g.fleets) {
    if (f.damaged || f.node === g.current || !seen.has(f.node)) continue;
    const at = f.route.indexOf(g.current);
    if (at < 0) continue;
    out.push({
      fleet: f.id, name: fleetName(f), faction: f.faction, role: f.role, ships: f.ships.length, hostile: isHostileFaction(sim, f.faction),
      eta: at + 1, stops: at === f.route.length - 1,
    });
  }
  return out.sort((a, b) => a.eta - b.eta || a.fleet - b.fleet);
}
