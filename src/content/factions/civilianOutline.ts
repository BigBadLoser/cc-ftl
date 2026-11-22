import type { OutlineRecipe, Profile } from '../../sim';

/** Civilian outline recipes (SHIPGEN_V4, "Ship recipes and layout parts"). PROTOTYPE (#581). */

/**
 * A liner: a forward section (the bridge, the crew, the mess, the sick bay and stores), the passengers' drum amidships
 * (a square ring round a garden, its walls on the hull line of the sections either side), the machinery aft, the drive.
 * The sections either side of the drum one width, so that line runs straight through it.
 */
const DRUM = (len: [number, number]): { len: [number, number]; half: [number, number]; chamfer: [number, number] } => ({ len, half: [15, 15], chamfer: [3, 3] });
const LINER: readonly Profile[] = [
  // A round bow, a long forward section, a flared drive.
  { id: 'liner.drum', nose: { style: 'round', len: [8, 10], front: [3, 4] },
    sections: [{ len: [38, 42], half: [10, 10], taper: 1 }, DRUM([31, 33]), { len: [28, 32], half: [10, 10] }],
    stern: { kind: 'flare', len: [7, 9], out: [3, 4] } },
  // A command pod at the bow, the drum further forward, a long drive section with quarter flares.
  { id: 'liner.pod', pod: { len: [6, 8], half: [5, 6] },
    sections: [{ len: [34, 38], half: [10, 10], taper: 1 }, DRUM([31, 33]), { len: [34, 38], half: [10, 10] }],
    stern: { kind: 'quarters', len: [9, 11], out: [2, 3], aft: [3, 4] } },
  // A long sharp bow, a slim neck into the drum, a flat drive bank.
  { id: 'liner.neck', nose: { style: ['cheek', 'round'], len: [12, 15], front: [2, 3] },
    sections: [{ len: [34, 38], half: [10, 10], taper: 1 }, { len: [6, 8], half: [7, 7], taper: 1 }, DRUM([31, 33]), { len: [28, 32], half: [10, 10] }],
    stern: { kind: 'bank', len: [0, 0], out: [0, 0] } },
  // A stepped bow, swept wings at the stern, a tapered tail.
  { id: 'liner.swept', nose: { style: 'stepped', len: [9, 12], front: [2, 3] },
    sections: [{ len: [36, 40], half: [10, 10], taper: 1 }, DRUM([31, 33]), { len: [30, 34], half: [10, 10] }],
    rearWings: { len: [10, 12], reach: [3, 4], sweep: [1, 2] }, stern: { kind: 'tail', len: [5, 6], out: [1, 1], rate: 3 } },
];

/**
 * A freighter: a pusher. A short, blunt hull (bridge forward, looking down the truss; crew, workshop, machinery, drive)
 * behind a long truss of sealed containers it pushes (`truss`): big ship, small floor.
 */
const TUG: readonly Profile[] = [
  { id: 'tug.block', nose: { style: 'stepped', len: [4, 6], front: [5, 6] }, sections: [{ len: [20, 26], half: [9, 10] }],
    stern: { kind: 'flare', len: [6, 8], out: [2, 3] } },
  { id: 'tug.round', nose: { style: 'round', len: [5, 7], front: [5, 6] }, sections: [{ len: [18, 24], half: [10, 11] }],
    stern: { kind: 'bank', len: [0, 0], out: [0, 0] } },
];

export const civilianOutline = {
  freighter: {
    family: 'freighter', profiles: TUG, maxBeam: 27, crew: { sleep: 'bunks', rooms: 1 }, layout: { kind: 'bays', program: { pd: false, least: 64 } },
    // (Its cargo the truss's containers: no holds aboard.)
    bonus: { crates: -8 }, truss: { banks: [4, 5], layers: 1 },
  },
  liner: {
    // (Two gun rooms, one a side, aft with the machinery.)
    family: 'liner', profiles: LINER, maxBeam: 33, gunRooms: 2, crew: { sleep: 'bunks', rooms: 1 }, passengers: { base: 6, perDepth: 1 },
    // (Its point defence the plan's own room's: no turret pair. Its passengers' suites the drum's corners. Any room
    // may take a single-tier bay: its machinery rooms are small.)
    rooms: ['ward', 'pantry'], layout: { kind: 'bays', drum: true, program: { pd: false, least: 64 } },
    depts: {
      // (Its guns with the systems, a hangar with the stores: it has no flight deck or battery to put them in.)
      of: { weapons: 'systems', hangar: 'stores' },
      // (Spare floor: power and a workshop by the machinery, stores by the crew (the lounges and gyms are the drum's);
      // only holds more than once.)
      fill: { systems: ['battery', 'workshop'], hab: ['hold'] },
      once: ['workshop', 'farm', 'battery', 'provisions'],
      // (Ahead of the drum: the crew and their mess, and the stores and sick bay; the machinery aft of it. No command
      // run: its bridge is the bow.)
      forward: [['hab', 'stores'], ['stores', 'hab']],
    },
  },
} satisfies Record<string, OutlineRecipe>;
