import { BAND } from '../frame';
import { SOLID, SPACE } from '../regions';
import { fillerSpec } from '../roomSize';
import type { BayPart } from './part';

/**
 * An offset cockpit (PROTOTYPE, #581): a pusher's bridge in a pod on one front corner of its hull, not across its bow, so
 * the truss's spine meets the bow square and the bridge looks out past the containers on its side. The pod is broad: it
 * runs from beside the spine out past the hull's side and forward past the bow, fused to the hull along its whole aft
 * length, its outer forward corner cut. Behind it a short hall from the spine's end to its aft wall (its door there, so
 * the helm faces forward); the rest of the bow a hold on the spine's end.
 */

/** Tiles the pod reaches forward of the bow, and out past the hull's side. */
const AHEAD = 7, OUT = 2;
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
      else g.set(ox + x, y, side && x <= xP ? bridge : (side || Math.abs(y) < BAND) && x > xP ? hall : hold);
    }
    // The pod past the hull: forward of the bow and out past its side, its outer forward corner cut.
    for (let x = -AHEAD; x <= xP; x++) for (let r = BAND; r <= outer; r++) {
      const k = g.at(ox + x, s * r);
      if ((x + AHEAD) + (outer - r) < CUT || (k !== SPACE && k !== SOLID)) continue;
      g.set(ox + x, s * r, bridge);
    }
  },
};
