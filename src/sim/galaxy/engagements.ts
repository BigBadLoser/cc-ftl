import { ShipC } from '../combat/components';
import type { Engagement } from '../combat/engagementTypes';
import type { Sim } from '../sim';

/**
 * Fights between NPC ships in the player's node (#603): the owning reads. Who is in a fight, on which side, and which fleets it holds in
 * place. The record is `Sector.engagements` (combat/engagementTypes.ts); engagementFlow.ts starts, runs and settles them. Kept free of
 * galaxy logic so the combat rules (combat/engage.ts) can read it.
 */

/** The fights going on in the sector, oldest first. */
export const engagements = (sim: Sim): readonly Engagement[] => sim.sector.engagements ?? [];

const inPlay = (sim: Sim, id: number): boolean => {
  const s = sim.world.get(id, ShipC);
  return !!s && (s.state === 'active' || s.state === 'disabled');
};

/** The side (0 or 1) the ship fights on in this fight, or -1. A ship out of play (wrecked, fled, taken) is in no fight. */
export function sideIn(sim: Sim, e: Engagement, ship: number): 0 | 1 | -1 {
  if (!inPlay(sim, ship)) return -1;
  if (e.members[0].some((m) => m.ship === ship)) return 0;
  return e.members[1].some((m) => m.ship === ship) ? 1 : -1;
}

/** Was the ship taken in a fight here (a prize on its captor's side)? Its beaten crew are captives, not a crew that gives the ship up again. */
export const isPrize = (sim: Sim, ship: number): boolean => engagements(sim).some((e) => e.members.some((side) => side.some((m) => m.ship === ship && m.prize)));

/** Is the ship in play on a side of some fight here? */
export function inEngagement(sim: Sim, ship: number): boolean {
  const list = sim.sector.engagements;
  return !!list?.length && list.some((e) => sideIn(sim, e, ship) >= 0);
}

/** Are the two ships on opposite sides of one fight here? */
export function opposed(sim: Sim, a: number, b: number): boolean {
  const list = sim.sector.engagements;
  if (!list?.length || a === b) return false;
  return list.some((e) => {
    const sa = sideIn(sim, e, a);
    const sb = sideIn(sim, e, b);
    return sa >= 0 && sb >= 0 && sa !== sb;
  });
}

/** The fleets fights here hold in place until they are settled (galaxy/fleets.ts `heldFleets`). */
export function engagedFleets(sim: Sim): Set<number> {
  const out = new Set<number>();
  for (const e of engagements(sim)) for (const side of e.fleets) for (const id of side) out.add(id);
  return out;
}

/** The ships in play on one side of a fight. */
export const sideShips = (sim: Sim, e: Engagement, side: 0 | 1): number[] => e.members[side].map((m) => m.ship).filter((id) => inPlay(sim, id));

/**
 * The player fired on or boarded `ship` (combat/provoke.ts `hostileAct`, the one entry for the player's hostile acts): in a meeting it is part of,
 * the player struck its side, and the first such act joins the other side (engagementFlow.ts credits it when the fight ends).
 */
export function noteJoin(sim: Sim, ship: number): void {
  for (const e of engagements(sim)) {
    const side = e.kind === 'meeting' ? sideIn(sim, e, ship) : -1;
    if (side === -1) continue;
    const struck = (e.struck ??= []);
    if (!struck.includes(side)) struck.push(side);
    e.joined ??= side === 0 ? 1 : 0;
  }
}
