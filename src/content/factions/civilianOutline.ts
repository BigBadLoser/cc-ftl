import type { OutlineRecipe, Profile } from '../../sim';

/** Civilian outline recipes (SHIPGEN_V4, "Ship recipes and layout parts"). PROTOTYPE (#581). */

/**
 * A liner: a forward section (the bridge, the crew, stores and machinery), a slim passenger deck either side of a bulge
 * amidships (its commons), a flared drive.
 */
const LINER: readonly Profile[] = [
  { id: 'liner.deck', nose: { style: 'round', len: [8, 11], front: [3, 4] },
    sections: [{ len: [20, 25], half: [9, 10], taper: 1 }, { len: [20, 26], half: [5, 5] }, { len: [16, 20], half: [8, 9], taper: 1 }, { len: [14, 20], half: [5, 5] }],
    stern: { kind: 'flare', len: [7, 9], out: [3, 4] } },
];

export const civilianOutline = {
  liner: {
    family: 'liner', profiles: LINER, maxBeam: 33, crew: { sleep: 'bunks', rooms: 2 }, passengers: { base: 6, perDepth: 1 },
    // (Its point defence the plan's own room's: no turret pair.)
    rooms: ['medbay', 'pantry', 'lounge'], layout: { kind: 'bays', decks: true, program: { pd: false } },
    depts: {
      // (Its guns with the systems, a hangar with the stores: it has no flight deck or battery to put them in.)
      of: { weapons: 'systems', hangar: 'stores' },
      // (Spare floor: power and a workshop by the machinery, the passengers' lounges, gym and farm on the decks; only
      // lounges and holds more than once.)
      fill: { systems: ['battery', 'workshop'] },
      once: ['gym', 'workshop', 'farm', 'battery', 'provisions'],
      // (No command run: its bridge is the bow.)
      forward: [['stores', 'systems'], ['systems', 'stores']],
    },
  },
} satisfies Record<string, OutlineRecipe>;
