import type { OutlineRecipe, Profile } from '../../sim';

/** Civilian outline recipes (SHIPGEN_V4, "Ship recipes and layout parts"). PROTOTYPE (#581). */

/**
 * A liner: a forward section (the bridge, the crew, the mess, the sick bay and stores), the passengers' drum amidships
 * (a square cut in a hull section with rounded corners), the machinery aft, a flared drive.
 */
const LINER: readonly Profile[] = [
  { id: 'liner.drum', nose: { style: 'round', len: [8, 10], front: [3, 4] },
    sections: [{ len: [32, 36], half: [10, 11], taper: 1 }, { len: [30, 34], half: [15, 15], round: [8, 9] }, { len: [30, 34], half: [8, 9] }],
    stern: { kind: 'flare', len: [7, 9], out: [3, 4] } },
];

export const civilianOutline = {
  liner: {
    family: 'liner', profiles: LINER, maxBeam: 33, crew: { sleep: 'bunks', rooms: 2 }, passengers: { base: 6, perDepth: 1 },
    // (Its point defence the plan's own room's: no turret pair. Its passengers' lounges the drum's corners.)
    rooms: ['medbay', 'pantry'], layout: { kind: 'bays', drum: true, program: { pd: false, grow: 4 } },
    depts: {
      // (Its guns with the systems, a hangar with the stores: it has no flight deck or battery to put them in.)
      of: { weapons: 'systems', hangar: 'stores' },
      // (Spare floor: power and a workshop by the machinery, a lounge or gym by the crew; only lounges and holds more than once.)
      fill: { systems: ['battery', 'workshop'], hab: ['lounge', 'gym'] },
      once: ['gym', 'workshop', 'farm', 'battery', 'provisions'],
      // (Ahead of the drum: the crew and their mess, and the stores and sick bay; the machinery aft of it. No command
      // run: its bridge is the bow.)
      forward: [['hab', 'stores'], ['stores', 'hab']],
    },
  },
} satisfies Record<string, OutlineRecipe>;
