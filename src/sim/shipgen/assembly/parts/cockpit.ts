import { BAND } from '../frame';
import { SOLID, SPACE } from '../regions';
import { fillerSpec } from '../roomSize';
import type { BayPart } from './part';

/**
 * An offset cockpit (PROTOTYPE, #581): a pusher's bridge in a pod on one front corner of its hull, not across its bow,
 * so the truss's spine meets the bow square and the bridge looks out past the containers on its side. The pod is broad:
 * it runs from beside the spine to the hull's side (a row past it) and forward past the bow, the hull's own corner run
 * on, its forward corners cut and its outer edge tapering back into the hull's side. The spine runs on to the
 * bow wall, where the truss's spine meets it; the airlocks' cross corridor straight behind the bow, the pod's door off
 * it in its aft wall (so the helm faces forward); the other side of the bow a hold on the spine.
 */

/** Tiles the pod reaches forward of the bow, and out past the hull's side. */
const AHEAD = 7, OUT = 1;
/** Its forward corners' cuts, outer and inner (by the spine). */
const CUT = 3, INNER = 3;

/** The side the pod stands on: the hull's length decides, so seeds differ. */
const sideOf = (W: number): 1 | -1 => (W % 2 === 0 ? 1 : -1);

export const COCKPIT: BayPart = {
  // (The airlocks' cross corridor straight behind the bow, the first flat stretch there: the pod's door opens off it.)
  dock: (s) => {
    for (let x = s.xBand; x <= s.xS - s.CW - 4; x++) if (s.flat(x)) return x;
    return -1;
  },
  paint: (fr, { g, hall, bridge, docks }) => {
    const { W, H, xBr, top, dockAt } = fr, ox = -Math.floor(W / 2), s = sideOf(W);
    const T = top(xBr), outer = T + OUT;
    // The bow's floor shared out: the pod on its side, the spine on to the bow wall, a hold on the other side.
    const hold = g.room('cargo', { spec: fillerSpec('hold', (xBr + 1) * Math.max(1, T)), access: [hall] });
    for (let x = 0; x <= xBr; x++) for (let y = -H; y <= H; y++) {
      if (g.at(ox + x, y) !== bridge) continue;
      // (Its last column the plating between the bow and the bays, as the bridge's aft wall was; the spine through it.)
      if (Math.abs(y) < BAND) g.set(ox + x, y, hall);
      else if (x === xBr) g.set(ox + x, y, SOLID);
      else g.set(ox + x, y, s * y >= BAND ? bridge : hold);
    }
    // The pod past the hull: forward of the bow and a row out past its side, its forward corners cut (the outer a long
    // bevel), its outer edge running back into the hull's side two columns a row.
    for (let x = -AHEAD; x < xBr; x++) for (let r = BAND; r <= outer; r++) {
      const k = g.at(ox + x, s * r), d = x + AHEAD;
      if (d + (outer - r) < CUT || d + (r - BAND) < INNER || 2 * (r - T) > xBr - 1 - x || (k !== SPACE && k !== SOLID)) continue;
      g.set(ox + x, s * r, bridge);
    }
    // Its door off the airlocks' corridor behind it, so the helm at its nose faces forward.
    const reg = g.regions[bridge];
    if (reg && dockAt === xBr + 1) reg.access = [docks[s > 0 ? 1 : 0]];
  },
};
