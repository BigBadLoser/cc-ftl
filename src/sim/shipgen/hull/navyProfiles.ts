import type { Profile } from './silhouette';

/**
 * Navy silhouettes, a few per type (SHIPGEN_V4 prototype; content once settled). Mid-depth proportions: a ship's plan
 * will size them. Half-widths are tiles beside the centre row, so a hull is 2 * half + 1 wide.
 */
export const NAVY_PROFILES: Record<string, readonly Profile[]> = {
  // Small and quick: a pointed bow, one body, a pair or two of sponsons forward, the drives in pods.
  corvette: [
    { id: 'corvette.dart', bow: { tip: [1, 2], slope: [2, 3] }, sections: [{ len: [30, 38], half: [6, 7] }], sponsons: [{ count: [2, 2], len: [6, 7], depth: [3, 4], span: [0.2, 0.6] }], pods: { len: [9, 11], out: [4, 5], aft: [2, 3] } },
    { id: 'corvette.wedge', bow: { tip: [2, 3], slope: [3, 4] }, sections: [{ len: [12, 16], half: [7, 8] }, { len: [16, 20], half: [5, 6], join: 'step' }], sponsons: [{ count: [1, 2], len: [6, 7], depth: [3, 3], span: [0.15, 0.45] }], pods: { len: [8, 10], out: [3, 5], aft: [2, 3] } },
  ],
  // Longer: a gun battery of sponsons down the forward body, a waist, the drives on wing pods.
  frigate: [
    { id: 'frigate.battery', bow: { tip: [2, 2], slope: [2, 3] }, sections: [{ len: [28, 34], half: [7, 7] }, { len: [14, 18], half: [5, 6] }], sponsons: [{ count: [3, 3], len: [6, 7], depth: [3, 4], span: [0.12, 0.62] }], pods: { len: [12, 14], out: [4, 5], aft: [2, 3] } },
    { id: 'frigate.wings', bow: { tip: [2, 3], slope: [2, 3] }, sections: [{ len: [16, 20], half: [6, 6] }, { len: [18, 22], half: [10, 11] }, { len: [10, 12], half: [6, 7] }], sponsons: [{ count: [2, 2], len: [6, 6], depth: [3, 3], span: [0.1, 0.4] }], pods: { len: [10, 12], out: [4, 5], aft: [2, 3] } },
  ],
  // Long and lean: a long sharp bow, guns forward, big drives.
  destroyer: [
    { id: 'destroyer.lance', bow: { tip: [1, 2], slope: [4, 4] }, sections: [{ len: [40, 46], half: [6, 6] }, { len: [10, 12], half: [8, 8] }], sponsons: [{ count: [2, 3], len: [6, 7], depth: [3, 3], span: [0.15, 0.5] }], pods: { len: [12, 14], out: [3, 5], aft: [2, 3] } },
  ],
  // Big: a heavy bow block, two long arms round an open void, the drives across the stern.
  cruiser: [
    { id: 'cruiser.twin', bow: { tip: [3, 4], slope: [2, 3] }, sections: [{ len: [14, 16], half: [9, 10] }, { len: [32, 38], half: [11, 12], inner: [4, 5] }, { len: [10, 12], half: [11, 12], join: 'step' }], sponsons: [{ count: [3, 4], len: [6, 7], depth: [3, 3], span: [0.3, 0.8] }], pods: { len: [10, 12], out: [4, 5], aft: [2, 3] } },
    { id: 'cruiser.citadel', bow: { tip: [3, 3], slope: [3, 3] }, sections: [{ len: [18, 22], half: [9, 9] }, { len: [26, 30], half: [12, 13], join: 'step' }, { len: [12, 14], half: [9, 10] }], sponsons: [{ count: [4, 4], len: [6, 7], depth: [3, 4], span: [0.15, 0.85] }], pods: { len: [12, 14], out: [3, 5], aft: [2, 3] } },
  ],
  // Wide and boxy: a broad hangar deck, a blunt bow, the bridge on an island to one side.
  carrier: [
    { id: 'carrier.island', bow: { tip: [4, 5], slope: [2, 2] }, sections: [{ len: [10, 12], half: [8, 9] }, { len: [36, 42], half: [13, 14], join: 'step' }], sponsons: [{ count: [1, 1], len: [10, 12], depth: [3, 3], span: [0.45, 0.7], side: 'south' }, { count: [2, 2], len: [6, 6], depth: [3, 3], span: [0.75, 0.95] }], pods: { len: [12, 14], out: [4, 5], aft: [2, 2] } },
    { id: 'carrier.deck', bow: { tip: [3, 4], slope: [3, 3] }, sections: [{ len: [16, 18], half: [9, 10] }, { len: [30, 36], half: [14, 15] }, { len: [10, 12], half: [10, 11] }], sponsons: [{ count: [3, 3], len: [6, 6], depth: [3, 3], span: [0.1, 0.5] }], pods: { len: [10, 12], out: [3, 5], aft: [2, 3] } },
  ],
};
