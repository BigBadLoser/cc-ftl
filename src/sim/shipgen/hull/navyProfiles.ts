import type { Profile } from './silhouette';

/**
 * Navy silhouettes, two per type, from the parts settled on the option sheets and the type identities (docs/SHIPGEN_V4.md,
 * "Hull shape decisions"). Mid-depth proportions: a ship's plan will size them. Half-widths are tiles beside the centre
 * row, so a hull is 2 * half + 1 wide.
 */
export const NAVY_PROFILES: Record<string, readonly Profile[]> = {
  // Skirmisher: small and slim, drives large for its size.
  corvette: [
    { id: 'corvette.swift', nose: { style: 'round', len: [8, 10], front: [2, 2] }, sections: [{ len: [24, 28], half: [5, 5] }], rearWings: { len: [12, 14], reach: [5, 6] }, stern: { kind: 'bank', len: [0, 0], out: [0, 0] } },
    { id: 'corvette.flare', nose: { style: 'steep', len: [10, 12], front: [2, 2] }, sections: [{ len: [26, 30], half: [5, 5] }], mounts: [{ kind: 'wing', count: [1, 1], len: [9, 10], reach: [3, 3], cut: true, span: [0.15, 0.4] }], stern: { kind: 'flare', len: [10, 12], out: [4, 4] } },
  ],
  // Escort: medium and compact, a wing pair for its point defence.
  frigate: [
    { id: 'frigate.screen', nose: { style: 'cheek', len: [12, 14], front: [3, 3] }, sections: [{ len: [34, 38], half: [7, 7] }], mounts: [{ kind: 'wing', count: [1, 1], len: [12, 14], reach: [4, 4], span: [0.25, 0.55] }], stern: { kind: 'quarters', len: [10, 12], out: [3, 3] } },
    { id: 'frigate.belly', nose: { style: 'round', len: [14, 16], front: [3, 3] }, sections: [{ len: [12, 14], half: [6, 6] }, { len: [18, 20], half: [9, 9] }, { len: [10, 12], half: [7, 7] }], mounts: [{ kind: 'wing', count: [2, 2], len: [9, 10], reach: [3, 3], cut: true, span: [0.3, 0.75] }], stern: { kind: 'flare', len: [10, 12], out: [3, 3], rate: 3 } },
  ],
  // Striker: long and lean, the guns forward in embrasures.
  destroyer: [
    { id: 'destroyer.pod', pod: { len: [6, 8], half: [3, 3] }, sections: [{ len: [44, 50], half: [6, 6] }], mounts: [{ kind: 'embrasure', count: [3, 3], len: [4, 4], depth: [2, 2], span: [0.05, 0.4] }], stern: { kind: 'pylons', len: [12, 14], out: [0, 0] } },
    { id: 'destroyer.lance', nose: { style: 'stepped', len: [18, 21], front: [2, 2] }, sections: [{ len: [42, 46], half: [6, 6] }], mounts: [{ kind: 'embrasure', count: [3, 3], len: [4, 4], depth: [2, 2], span: [0.05, 0.4] }], stern: { kind: 'flare', len: [12, 14], out: [3, 3] } },
  ],
  // Ship of the line: big and heavy, embrasures down the side and a raked wing, a square drive bank.
  cruiser: [
    { id: 'cruiser.line', nose: { style: 'stepped', len: [18, 21], front: [3, 3] }, sections: [{ len: [16, 18], half: [9, 9] }, { len: [40, 44], half: [11, 11] }], mounts: [{ kind: 'embrasure', count: [4, 4], len: [4, 4], depth: [2, 2], span: [0.3, 0.7] }, { kind: 'wing', count: [1, 1], len: [18, 20], reach: [5, 5], rake: 3, span: [0.72, 0.98] }], stern: { kind: 'bank', len: [0, 0], out: [0, 0] } },
    { id: 'cruiser.citadel', pod: { len: [8, 10], half: [5, 5] }, sections: [{ len: [44, 50], half: [11, 11] }], mounts: [{ kind: 'wing', count: [1, 1], len: [14, 14], reach: [4, 4], span: [0.08, 0.32] }, { kind: 'embrasure', count: [4, 4], len: [4, 4], depth: [2, 2], span: [0.4, 0.85] }], stern: { kind: 'quarters', len: [12, 14], out: [3, 3] } },
  ],
  // Launcher: broad, a launch lane open out of the stern between two decks.
  carrier: [
    { id: 'carrier.split', nose: { style: 'round', len: [14, 16], front: [4, 4] }, sections: [{ len: [12, 14], half: [10, 10] }, { len: [48, 54], half: [14, 14] }], split: { at: [0.35, 0.4], lane: [4, 4] }, mounts: [{ kind: 'wing', count: [2, 2], len: [7, 8], reach: [2, 2], span: [0.2, 0.6] }], stern: { kind: 'bank', len: [0, 0], out: [0, 0] } },
    { id: 'carrier.deck', nose: { style: 'cheek', len: [14, 16], front: [4, 4] }, sections: [{ len: [56, 60], half: [13, 13] }], split: { at: [0.45, 0.5], lane: [5, 5] }, mounts: [{ kind: 'wing', count: [2, 2], len: [7, 8], reach: [2, 2], span: [0.15, 0.5] }], stern: { kind: 'flare', len: [12, 14], out: [2, 2], rate: 3 } },
  ],
};
