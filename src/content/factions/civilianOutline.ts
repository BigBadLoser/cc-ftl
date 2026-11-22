import type { OutlineRecipe, Profile } from '../../sim';

/** Civilian outline recipes (SHIPGEN_V4, "Ship recipes and layout parts"). PROTOTYPE (#581). */

/**
 * A liner: a forward section (the bridge, the crew, the mess, the sick bay and stores), the passengers' drum amidships
 * (a square cut in a hull section with rounded corners, the airlocks in its sides), the machinery aft, the drive. The
 * sections either side of the drum one width, so the drum stands out the same fore and aft.
 */
const DRUM = (len: [number, number]): { len: [number, number]; half: [number, number]; round: [number, number] } => ({ len, half: [15, 15], round: [8, 9] });
const LINER: readonly Profile[] = [
  // A round bow, a long forward section, a flared drive.
  { id: 'liner.drum', nose: { style: 'round', len: [8, 10], front: [3, 4] },
    sections: [{ len: [38, 42], half: [9, 9], taper: 1 }, DRUM([30, 34]), { len: [28, 32], half: [10, 10] }],
    stern: { kind: 'flare', len: [7, 9], out: [3, 4] } },
  // A command pod at the bow, the drum further forward, a long drive section with quarter flares.
  { id: 'liner.pod', pod: { len: [6, 8], half: [5, 6] },
    sections: [{ len: [34, 38], half: [8, 8], taper: 1 }, DRUM([30, 34]), { len: [34, 38], half: [10, 10] }],
    stern: { kind: 'quarters', len: [9, 11], out: [2, 3], aft: [3, 4] } },
  // A long sharp bow, a slim neck into the drum, a flat drive bank.
  { id: 'liner.neck', nose: { style: ['cheek', 'round'], len: [12, 15], front: [2, 3] },
    sections: [{ len: [34, 38], half: [9, 9], taper: 1 }, { len: [6, 8], half: [6, 6], taper: 1 }, DRUM([30, 34]), { len: [28, 32], half: [10, 10] }],
    stern: { kind: 'bank', len: [0, 0], out: [0, 0] } },
  // A stepped bow, swept wings at the stern, a tapered tail.
  { id: 'liner.swept', nose: { style: 'stepped', len: [9, 12], front: [2, 3] },
    sections: [{ len: [36, 40], half: [9, 9], taper: 1 }, DRUM([32, 36]), { len: [30, 34], half: [10, 10] }],
    rearWings: { len: [10, 12], reach: [3, 4], sweep: [1, 2] }, stern: { kind: 'tail', len: [5, 6], out: [1, 1], rate: 3 } },
];

export const civilianOutline = {
  liner: {
    family: 'liner', profiles: LINER, maxBeam: 33, crew: { sleep: 'bunks', rooms: 1 }, passengers: { base: 6, perDepth: 1 },
    // (Its point defence the plan's own room's: no turret pair. Its passengers' lounges the drum's corners. Any room
    // may take a single-tier bay: its machinery rooms are small.)
    rooms: ['sickbay', 'pantry'], layout: { kind: 'bays', drum: true, program: { pd: false, least: 64 } },
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
