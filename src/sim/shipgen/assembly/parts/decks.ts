import { MIN_DEPTH } from '../frame';
import type { BayPart } from './part';

/**
 * Passenger decks aft of the airlocks: single cabins both sides of the spine in the deck's shallow bays, the commons in
 * its two deepest (its bulge); command, stores and systems forward of the airlocks, which stand at the forward section's
 * shoulder.
 */
export const DECKS: BayPart = {
  // (Its annex (the pantry) beside the mess; a hold may take all its bays.)
  program: { beside: true, holds: true },
  // (The forward section's aftmost flat stretch, by its shoulder down to the deck.)
  dock: ({ xBand, xS, CW, depth, flat }) => {
    let peak = 0, at = -1;
    for (let x = xBand + MIN_DEPTH + 1; x <= xS - MIN_DEPTH - CW - 1; x++) {
      peak = Math.max(peak, depth(x));
      if (depth(x + CW) < peak - 1) { if (flat(x)) at = x; break; }
      if (flat(x)) at = x;
    }
    return at;
  },
  zones: { forward: (b, fr) => b.x0 <= fr.dockAt, other: () => 'hab' },
  strip: (g) => {
    const all = g.bays.flatMap((b, k) => (!b.row && b.x0 > g.fr.dockAt ? [k] : []));
    const deepest = [...all].sort((u, v) => g.minDepth(v, v + 1) - g.minDepth(u, u + 1)).slice(0, 2);
    return all.filter((k) => !deepest.includes(k));
  },
};
