import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { BOND_RIVAL_SPACE } from '../tuning';
import { entityOf, friendsOf, personOf, rivalsOf } from './bonds';
import { CrewC, DeadC, PositionC, BedOwnerC } from './components';
import { ModuleC } from '../modules/components';

/**
 * Friends sit together and rivals keep apart (docs/TRAITS.md section 6): a cost added to the choice of a meal spot, a break spot or a bed.
 * Negative near a friend (within 3 tiles), positive near a rival (within BOND_RIVAL_SPACE); 0 for a crew member with neither, so a ship
 * where nobody has bonds chooses exactly as before.
 */

export interface Peer {
  entity: number;
  friend: boolean;
}

/** The living friends and rivals of a crew member (entities), empty when they have none. */
export function bondedPeers(sim: Sim, id: number): Peer[] {
  const pid = personOf(sim, id);
  if (!pid || !sim.bonds.opinions[pid]) return [];
  const out: Peer[] = [];
  for (const [list, friend] of [[friendsOf(sim, pid), true], [rivalsOf(sim, pid), false]] as const) {
    for (const { person } of list) {
      const e = entityOf(sim, person);
      if (e && sim.world.has(e, CrewC) && !sim.world.has(e, DeadC)) out.push({ entity: e, friend });
    }
  }
  return out;
}

/** The cost of being at (x, y) on `ship` for a crew member with these peers: peers' current tiles (and a peer's owned bed for `bedOf`). */
export function socialCost(sim: Sim, peers: readonly Peer[], ship: number, x: number, y: number): number {
  let cost = 0;
  for (const p of peers) {
    const at = sim.world.get(p.entity, PositionC);
    if (!at || shipIdOf(sim, at) !== ship) continue;
    const d = Math.max(Math.abs(at.x - x), Math.abs(at.y - y));
    if (p.friend && d <= 3) cost -= 3;
    else if (!p.friend && d <= BOND_RIVAL_SPACE) cost += 6;
  }
  return cost;
}

/** The cost of a bed at (x, y): beds near a friend's own bed are better, near a rival's worse (within BOND_RIVAL_SPACE of it). */
export function bedSocialCost(sim: Sim, peers: readonly Peer[], x: number, y: number): number {
  let cost = 0;
  for (const p of peers) {
    const owned = sim.world.get(p.entity, BedOwnerC);
    const bed = owned && sim.world.get(owned.bed, ModuleC);
    if (!bed) continue;
    const d = Math.max(Math.abs(bed.x - x), Math.abs(bed.y - y));
    if (p.friend && d <= 3) cost -= 3;
    else if (!p.friend && d <= BOND_RIVAL_SPACE) cost += 8;
  }
  return cost;
}
