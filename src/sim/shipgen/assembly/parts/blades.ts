import type { BayPart, DockSite } from './part';

/** Where a raider's airlocks stand: about halfway along the body, where its fore and aft blades root (assembly/blades.ts). */
const JUNCTION = 0.5;

/**
 * A raider's blades (PROTOTYPE, #581): its cross corridor, and so its airlocks, where the fore and aft blades meet, so the
 * slot each airlock cuts through the blades is a notch between them, not a cut through one.
 */
export const BLADES: BayPart = {
  dock: ({ xBand, xS, CW, flat }: DockSite): number => {
    const want = Math.round(JUNCTION * xS), xs = [...Array(xS).keys()].filter((x) => x > xBand + 1 && x + CW + 2 < xS && flat(x));
    return xs.sort((a, b) => Math.abs(a - want) - Math.abs(b - want))[0] ?? -1;
  },
};
