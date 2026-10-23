import { ftlStatus, playerShip, type Sim } from '../sim';
import type { UiFtl } from '../ui/api';

/** The FTL drive for the UI: the charge (whole tenths), the order and the crew member at the helm. Null when the player has no ship. */
export function buildFtl(sim: Sim): UiFtl | null {
  const ship = playerShip(sim);
  const s = ship ? ftlStatus(sim, ship) : null;
  if (!s) return null;
  return {
    ship, state: s.state, blocker: s.blocker, charge: Math.floor(s.charge * 10) / 10, max: s.max, ordered: s.ordered, queued: !!s.jump, pilot: s.pilotName,
  };
}
