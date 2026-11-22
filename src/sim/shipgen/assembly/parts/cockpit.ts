import { BAND } from '../frame';
import { SOLID, SPACE } from '../regions';
import { fillerSpec } from '../roomSize';
import type { BayPart } from './part';

/**
 * An offset cockpit (PROTOTYPE, #581): a pusher's bridge in a pod on one front corner of its hull, not across its bow,
 * so the truss's spine meets the bow square and the bridge looks out past the containers on its side. The pod is broad:
 * it runs from beside the spine out past the hull's side and forward past the bow, fused to the hull along its whole
 * aft length, its outer forward corner cut and its aft end tapering back into the hull's side. The spine runs on to the
 * bow wall, where the truss's spine meets it; behind the pod a short hall from the spine to its aft wall (its door
 * there, so the helm faces forward); the other side of the bow a hold on the spine.
 */

/** Tiles the pod reaches forward of the bow, and out past the hull's side. */
const AHEAD = 7, OUT = 3;
/** Its outer forward corner's cut. */
const CUT = 3;
/** Columns of the hall behind it. */
const HALL = 3;

/** The side the pod stands on: the hull's length decides, so seeds differ. */
const sideOf = (W: number): 1 | -1 => (W % 2 === 0 ? 1 : -1);

export const COCKPIT: BayPart = {
  paint: (fr, { g, hall, bridge }) => {
    const { W, H, xBr, top } = fr, ox = -Math.floor(W / 2), s = sideOf(W);
    const xP = xBr - HALL, T = top(xP), outer = T + OUT;
    // The bow's floor shared out: the pod, the hall behind it, the hold.
    const hold = g.room('cargo', { spec: fillerSpec('hold', 2 * (xBr + 1) * Math.max(1, T)), access: [hall] });
    for (let x = 0; x <= xBr; x++) for (let y = -H; y <= H; y++) {
      if (g.at(ox + x, y) !== bridge) continue;
      const side = s * y >= BAND;
      // (Its last column the plating between the bow and the bays, as the bridge's aft wall was; the spine through it.)
      if (x === xBr && Math.abs(y) >= BAND) g.set(ox + x, y, SOLID);
      // (The hall behind the pod a row short of the hull's side there: no jut where the hull steps.)
      else if (side && x > xP && s * y >= T) g.set(ox + x, y, SOLID);
      else g.set(ox + x, y, Math.abs(y) < BAND || (side && x > xP) ? hall : side ? bridge : hold);
    }
    // The pod past the hull: forward of the bow and out past its side, its outer forward corner cut.
    for (let x = -AHEAD; x <= xP; x++) for (let r = BAND; r <= outer; r++) {
      const k = g.at(ox + x, s * r);
      // (Out past the hull's side it tapers back into the hull at its aft end, a row a column: a sponson, not a box.)
      if ((x + AHEAD) + (outer - r) < CUT || r - T > xP - x || (k !== SPACE && k !== SOLID)) continue;
      g.set(ox + x, s * r, bridge);
    }
  },
};
