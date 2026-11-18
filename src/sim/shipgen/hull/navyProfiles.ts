import type { Profile } from './silhouette';

/**
 * Navy silhouettes, a few per type (SHIPGEN_V4 prototype; content once settled). Mid-depth proportions: a ship's plan
 * will size them. Half-widths are tiles beside the centre row, so a hull is 2 * half + 1 wide. `pitch` marks a shape
 * offered as a new idea (none of the old generator's).
 */
export const NAVY_PROFILES: Record<string, readonly (Profile & { pitch?: true })[]> = {
  // Small and agile: sleek, no sponsons (the guns stand inside the hull), the drives in pods.
  corvette: [
    { id: 'corvette.dart', bow: { tip: [1, 2], slope: [2, 3] }, sections: [{ len: [30, 38], half: [6, 7] }], pods: { len: [9, 11], out: [4, 5], aft: [2, 3] } },
    { id: 'corvette.wedge', bow: { tip: [2, 3], slope: [3, 4] }, sections: [{ len: [12, 16], half: [7, 8] }, { len: [16, 20], half: [5, 6], join: 'step' }], pods: { len: [8, 10], out: [3, 5], aft: [2, 3] } },
    // A delta: one long taper from a needle bow to a broad stern, no sponsons, the guns inside the wings.
    { id: 'corvette.arrow', pitch: true, bow: { tip: [1, 1], slope: [3, 3] }, sections: [{ len: [10, 12], half: [9, 10] }], pods: { len: [8, 10], out: [2, 3], aft: [2, 3] } },
  ],
  // Longer, still sleek: a forward body and a waist, or a broad midsection, the drives on wing pods.
  frigate: [
    { id: 'frigate.waist', bow: { tip: [2, 2], slope: [2, 3] }, sections: [{ len: [28, 34], half: [7, 7] }, { len: [14, 18], half: [5, 6] }], pods: { len: [12, 14], out: [4, 5], aft: [2, 3] } },
    { id: 'frigate.wings', bow: { tip: [2, 3], slope: [2, 3] }, sections: [{ len: [16, 20], half: [6, 6] }, { len: [18, 22], half: [10, 11] }, { len: [10, 12], half: [6, 7] }], pods: { len: [10, 12], out: [4, 5], aft: [2, 3] } },
    // Asymmetric by design: one big gun blister to port, a boat bay blister further aft to starboard.
    { id: 'frigate.blister', pitch: true, bow: { tip: [2, 2], slope: [2, 3] }, sections: [{ len: [40, 46], half: [6, 7] }], sponsons: [{ count: [1, 1], len: [10, 12], depth: [4, 5], span: [0.2, 0.45], side: 'north' }, { count: [1, 1], len: [9, 10], depth: [3, 4], span: [0.5, 0.75], side: 'south' }], pods: { len: [10, 12], out: [4, 5], aft: [2, 3] } },
  ],
  // Long and lean: a long sharp bow, guns forward, big drives.
  destroyer: [
    { id: 'destroyer.lance', bow: { tip: [1, 2], slope: [4, 4] }, sections: [{ len: [40, 46], half: [6, 6] }, { len: [10, 12], half: [8, 8] }], sponsons: [{ count: [2, 3], len: [6, 7], depth: [3, 3], span: [0.15, 0.5] }], pods: { len: [12, 14], out: [3, 5], aft: [2, 3] } },
    // A hammer head of guns on a long boom, the drives out on the stern quarters.
    { id: 'destroyer.hammer', pitch: true, bow: { tip: [5, 6], slope: [2, 2] }, sections: [{ len: [12, 14], half: [10, 11] }, { len: [30, 36], half: [4, 4] }, { len: [8, 10], half: [7, 8] }], pods: { len: [12, 14], out: [4, 5], aft: [3, 4] } },
  ],
  // Big and heavy: sponson batteries down their sides, a heavy bow block, the drives across the stern.
  cruiser: [
    { id: 'cruiser.twin', bow: { tip: [3, 4], slope: [2, 3] }, sections: [{ len: [14, 16], half: [9, 10] }, { len: [32, 38], half: [11, 12], inner: [4, 5] }, { len: [10, 12], half: [11, 12] }], sponsons: [{ count: [4, 4], len: [6, 7], depth: [3, 4], span: [0.25, 0.85] }], pods: { len: [10, 12], out: [4, 5], aft: [2, 3] } },
    { id: 'cruiser.citadel', bow: { tip: [3, 3], slope: [3, 3] }, sections: [{ len: [18, 22], half: [9, 9] }, { len: [26, 30], half: [12, 13] }, { len: [12, 14], half: [9, 10] }], sponsons: [{ count: [4, 5], len: [6, 7], depth: [3, 4], span: [0.2, 0.85] }], pods: { len: [12, 14], out: [3, 5], aft: [2, 3] } },
    // A fork: the arms run open out of the stern, the drives at their ends.
    { id: 'cruiser.fork', pitch: true, bow: { tip: [3, 4], slope: [3, 3] }, sections: [{ len: [20, 24], half: [9, 10] }, { len: [36, 40], half: [11, 12], inner: [4, 5] }], sponsons: [{ count: [3, 3], len: [6, 7], depth: [3, 4], span: [0.3, 0.8] }], pods: { len: [10, 12], out: [3, 4], aft: [2, 3] } },
    // A trimaran: a slim main hull with an outrigger each side on beams.
    { id: 'cruiser.trimaran', pitch: true, bow: { tip: [2, 3], slope: [3, 3] }, sections: [{ len: [56, 62], half: [6, 7] }], sponsons: [{ count: [2, 2], len: [6, 7], depth: [3, 3], span: [0.1, 0.3] }], outriggers: { len: [30, 36], half: [3, 4], gap: [3, 4], at: [0.35, 0.45], beams: [2, 3], aft: [2, 4] } },
  ],
  // Long and broad, shoulders tapered: a hangar deck, point-defence sponsons, the drives across the stern.
  carrier: [
    { id: 'carrier.island', bow: { tip: [3, 4], slope: [3, 3] }, sections: [{ len: [14, 16], half: [9, 10] }, { len: [46, 52], half: [13, 14] }], sponsons: [{ count: [1, 1], len: [12, 14], depth: [4, 5], span: [0.4, 0.65], side: 'north' }, { count: [3, 3], len: [6, 6], depth: [3, 3], span: [0.15, 0.95], side: 'south' }], pods: { len: [12, 14], out: [3, 4], aft: [2, 3] } },
    // A split deck: two hulls from a shared bow, a launch lane open out of the stern between them.
    { id: 'carrier.split', bow: { tip: [3, 4], slope: [3, 3] }, sections: [{ len: [18, 22], half: [11, 12] }, { len: [42, 48], half: [14, 15], inner: [4, 5] }], sponsons: [{ count: [3, 3], len: [6, 7], depth: [3, 3], span: [0.2, 0.9] }], pods: { len: [12, 14], out: [3, 4], aft: [2, 3] } },
    { id: 'carrier.deck', bow: { tip: [3, 4], slope: [3, 4] }, sections: [{ len: [16, 18], half: [9, 10] }, { len: [40, 46], half: [14, 15] }, { len: [10, 12], half: [11, 12] }], sponsons: [{ count: [3, 3], len: [6, 7], depth: [3, 3], span: [0.2, 0.75] }], pods: { len: [10, 12], out: [3, 5], aft: [2, 3] } },
    // Split with an island: the lane between two decks, the bridge tower out on one side.
    { id: 'carrier.split-island', pitch: true, bow: { tip: [3, 4], slope: [3, 3] }, sections: [{ len: [16, 18], half: [11, 12] }, { len: [46, 52], half: [14, 15], inner: [4, 5] }], sponsons: [{ count: [1, 1], len: [12, 14], depth: [4, 5], span: [0.3, 0.55], side: 'south' }, { count: [3, 3], len: [6, 6], depth: [3, 3], span: [0.2, 0.95], side: 'north' }], pods: { len: [12, 14], out: [3, 4], aft: [2, 3] } },
  ],
};
