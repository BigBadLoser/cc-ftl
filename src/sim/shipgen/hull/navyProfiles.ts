import type { Profile } from './silhouette';

/**
 * Navy silhouettes, two or three per type, from the parts settled on the option sheets and the type identities (docs/SHIPGEN_V4.md,
 * "Hull shape decisions"). Mid-depth proportions: a ship's plan will size them. Half-widths are tiles beside the centre
 * row, so a hull is 2 * half + 1 wide. Gun mounts are sized for a gun bay (light guns 2x2, heavy 3x3, plus walls).
 */
export const NAVY_PROFILES: Record<string, readonly Profile[]> = {
  // Skirmisher: small and slim, drives large for its size.
  corvette: [
    { id: 'corvette.wedge', nose: { style: ['stepped', 'steep'], len: [8, 11], front: [1, 2] }, sections: [{ len: [24, 30], half: [4, 5] }],
      stern: { kind: 'quarters', len: [11, 14], out: [3, 4], aft: [3, 5] } },
    { id: 'corvette.swift', nose: { style: 'round', len: [7, 9], front: [1, 2] }, sections: [{ len: [20, 24], half: [4, 5] }],
      rearWings: { len: [8, 10], reach: [2, 2], sweep: [0, 1] }, stern: { kind: 'tail', len: [4, 6], out: [1, 1], rate: 3 } },
    { id: 'corvette.flare', nose: { style: ['steep', 'round'], len: [9, 13], front: [1, 2] }, sections: [{ len: [24, 32], half: [4, 6] }],
      mounts: [{ kind: 'wing', count: [1, 1], len: [8, 10], reach: [3, 4], cut: true, span: [0.1, 0.45] }], stern: { kind: 'flare', len: [8, 12], out: [3, 4] } },
  ],
  // Escort: medium and compact, a wing pair for its point defence.
  frigate: [
    { id: 'frigate.screen', nose: { style: ['cheek', 'round'], len: [11, 15], front: [2, 4] }, sections: [{ len: [32, 40], half: [6, 8] }],
      mounts: [{ kind: 'wing', count: [1, 1], len: [11, 15], reach: [4, 5], span: [0.2, 0.6] }], stern: { kind: 'quarters', len: [10, 13], out: [2, 4], aft: [3, 5] } },
    { id: 'frigate.belly', nose: { style: ['round', 'cheek'], len: [12, 16], front: [2, 4] },
      sections: [{ len: [10, 14], half: [5, 6] }, { len: [16, 22], half: [8, 10] }, { len: [8, 12], half: [6, 7] }],
      mounts: [{ kind: 'wing', count: [1, 2], len: [9, 11], reach: [3, 4], cut: true, span: [0.3, 0.75] }], stern: [{ kind: 'flare', len: [10, 12], out: [2, 3], rate: 3 }, { kind: 'quarters', len: [9, 11], out: [2, 3], aft: [3, 4] }] },
  ],
  // Striker: long and lean, the guns forward in embrasures.
  destroyer: [
    { id: 'destroyer.pod', pod: { len: [5, 9], half: [3, 4] }, sections: [{ len: [42, 54], half: [6, 7] }],
      mounts: [{ kind: 'embrasure', count: [3, 4], len: [4, 5], depth: [1, 1], tooth: 5, span: [0.05, 0.75] }], stern: { kind: 'pylons', len: [11, 15], out: [0, 0], aft: [2, 4] } },
    { id: 'destroyer.lance', nose: { style: ['stepped', 'steep'], len: [16, 22], front: [1, 2] }, sections: [{ len: [40, 50], half: [6, 7] }],
      mounts: [{ kind: 'embrasure', count: [3, 4], len: [4, 5], depth: [1, 1], tooth: 5, span: [0.05, 0.75] }], stern: [{ kind: 'flare', len: [10, 14], out: [2, 3] }, { kind: 'tail', len: [6, 9], out: [2, 2] }] },
  ],
  // Ship of the line: big and heavy, embrasures down the side and a raked wing, a square drive bank.
  cruiser: [
    { id: 'cruiser.line', nose: { style: ['stepped', 'steep'], len: [16, 22], front: [2, 4] }, sections: [{ len: [14, 20], half: [8, 10] }, { len: [38, 48], half: [11, 13] }],
      mounts: [{ kind: 'embrasure', count: [3, 4], len: [4, 5], depth: [1, 2], tooth: 6, span: [0.3, 0.75] }, { kind: 'wing', count: [1, 1], len: [16, 20], reach: [5, 6], rake: 3, span: [0.7, 1], chance: 0.6 }],
      stern: [{ kind: 'bank', len: [0, 0], out: [0, 0] }, { kind: 'quarters', len: [10, 13], out: [3, 4], aft: [3, 5] }] },
    { id: 'cruiser.citadel', pod: { len: [8, 11], half: [5, 6] }, sections: [{ len: [10, 14], half: [10, 11] }, { len: [36, 46], half: [11, 13] }],
      mounts: [{ kind: 'embrasure', count: [3, 5], len: [4, 5], depth: [1, 2], tooth: 6, span: [0.2, 0.9] }], stern: [{ kind: 'quarters', len: [11, 14], out: [3, 4], aft: [3, 5] }, { kind: 'flare', len: [12, 15], out: [2, 3], rate: 3 }] },
  ],
  // Launcher: broad, a launch lane open out of the stern between two decks.
  carrier: [
    { id: 'carrier.split', nose: { style: ['round', 'cheek'], len: [13, 17], front: [3, 5] }, sections: [{ len: [56, 70], half: [13, 15] }],
      split: { at: [0.3, 0.45], lane: [3, 5], end: ['square', 'round'] }, stern: [{ kind: 'bank', len: [0, 0], out: [0, 0] }, { kind: 'flare', len: [10, 13], out: [2, 2], rate: 3 }] },
    { id: 'carrier.deck', nose: { style: ['cheek', 'stepped'], len: [13, 17], front: [3, 5] }, sections: [{ len: [52, 62], half: [12, 14] }],
      split: { at: [0.42, 0.55], lane: [4, 6], end: ['square', 'round'] }, mounts: [{ kind: 'wing', count: [1, 1], len: [12, 16], reach: [3, 4], span: [0.1, 0.4], chance: 0.6 }],
      stern: [{ kind: 'flare', len: [12, 14], out: [2, 2], rate: 3 }, { kind: 'bank', len: [0, 0], out: [0, 0] }] },
  ],
};
