import { ShipC, type Ship } from '../combat/components';
import type { Sim } from '../sim';

/**
 * Outposts (user decision, 2026-10-21). An outpost is a **dormant** ship (`ShipC.dormant`, combat/dormant.ts: stamped with it,
 * like a pirate den) until provoked, whatever its faction. A dug outpost is also **hidden** until discovered: not listed, not
 * targetable, not selectable, always under its rock roof. Discovery shows it but leaves it dormant. `ShipC.outpost` holds the
 * style, kind and `hidden` flag, all saved.
 */

/** True for an outpost the player has not discovered yet. */
export function isHiddenOutpost(ship: Ship | undefined): boolean {
  return !!ship?.outpost?.hidden;
}

export type DiscoverReason = 'proximity' | 'breach' | 'provoked';

/** Reveal a hidden outpost (it stays dormant unless it was provoked). No-op if it is not hidden. */
export function discoverOutpost(sim: Sim, ship: number, reason: DiscoverReason): void {
  const s = sim.world.get(ship, ShipC);
  if (!s?.outpost?.hidden) return;
  s.outpost.hidden = false;
  sim.events.emit({ type: 'outpost.discovered', ship, reason });
}
