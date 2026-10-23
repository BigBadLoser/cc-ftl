import { spawnDerelict } from '../combat/derelict';
import type { Sim } from '../sim';
import { slot } from './populate';
import { nodeState } from './state';
import { WRECKS_PER_NODE } from './tuningWar';
import type { Contact } from './types';

/**
 * Wrecks of ships that were destroyed at a node while the player was elsewhere (meetings.ts). The destroyed ship's generator key (faction, seed, depth) is kept in the node's
 * state; the next time the player drops there the same hull is generated, ruined (a fresh battle wreck: combat damage, nobody moved in) and stamped east of everything
 * (`placeWrecks`), so the player finds what the fight left and can salvage it like any derelict. A node keeps WRECKS_PER_NODE of them; the oldest are forgotten.
 */

/** A destroyed ship (a descriptor `c` of a fleet of `faction`) leaves its wreck at `node`. */
export function leaveWreck(sim: Sim, node: string, c: Contact, faction: string, turn: number): void {
  const st = nodeState(sim, node);
  const list = (st.wrecks ??= []);
  list.push({ shipgen: c.shipgen, seed: c.seed, depth: c.depth, name: c.name ?? c.shipgen, faction, turn });
  if (list.length > WRECKS_PER_NODE) list.splice(0, list.length - WRECKS_PER_NODE);
}

/** Make the node's waiting wrecks real in the active sector (the player has just dropped here). Returns how many were placed; the list is emptied. */
export function placeWrecks(sim: Sim, node: string): number {
  const st = sim.galaxy.nodes[node];
  const list = st?.wrecks;
  if (!st || !list?.length || sim.sector.node !== node) return 0;
  delete st.wrecks;
  let made = 0;
  list.forEach((w, i) => {
    const r = spawnDerelict(sim, {
      faction: w.shipgen, depth: w.depth, seed: w.seed, at: slot(sim, node, 100 + i), intensity: 0.6, cause: 'combat', name: w.name, infest: 'none',
    });
    if (typeof r !== 'string') made++;
  });
  if (made) sim.galaxy.rev++;
  return made;
}
