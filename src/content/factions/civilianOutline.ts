import type { OutlineRecipe, Profile } from '../../sim';

/** Civilian outline recipes (SHIPGEN_V4, "Ship recipes and layout parts"). PROTOTYPE (#581). */

/** A liner: a broad forward section (command and machinery), a slim passenger deck either side of a bulge amidships (its commons), a flared drive. */
const LINER: readonly Profile[] = [
  { id: 'liner.deck', nose: { style: 'round', len: [8, 11], front: [3, 4] },
    sections: [{ len: [36, 44], half: [10, 11], taper: 1 }, { len: [18, 24], half: [5, 5] }, { len: [16, 20], half: [8, 9], taper: 1 }, { len: [16, 22], half: [5, 5] }],
    stern: { kind: 'flare', len: [7, 9], out: [3, 4] } },
];

export const civilianOutline = {
  liner: {
    family: 'liner', profiles: LINER, maxBeam: 33, crew: { sleep: 'bunks', together: true }, passengers: { base: 6, perDepth: 1 },
    rooms: ['medbay', 'pantry'], layout: { kind: 'bays', decks: true },
  },
} satisfies Record<string, OutlineRecipe>;
