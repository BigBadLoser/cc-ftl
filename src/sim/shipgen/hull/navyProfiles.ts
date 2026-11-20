import type { Profile } from './silhouette';

/**
 * Navy silhouettes, two or three per type, from the parts settled on the option sheets and the type identities (docs/SHIPGEN_V4.md,
 * "Hull shape decisions"). Mid-depth proportions: a ship's plan will size them. Half-widths are tiles beside the centre
 * row, so a hull is 2 * half + 1 wide. Gun mounts are sized for a gun bay (light guns 2x2, heavy 3x3, plus walls).
 * A part given as a list is a choice per seed: that is how a recipe moves its masses between seeds and keeps its identity.
 */
export const NAVY_PROFILES: Record<string, readonly Profile[]> = {
  // Skirmisher: small and slim, drives large for its size.
  corvette: [
    { id: 'corvette.wedge', nose: { style: ['stepped', 'steep'], len: [8, 11], front: [1, 2] },
      sections: [[{ len: [22, 28], half: [4, 5] }, { len: [14, 18], half: [3, 4] }], [{ len: [6, 8], half: [4, 5] }, { len: [12, 16], half: [5, 5] }]],
      stern: { kind: 'quarters', len: [9, 12], out: [2, 2], aft: [2, 3] } },
    // A dart: a long fine nose and a slim neck, the mass and swept wings at the rear.
    { id: 'corvette.swift', nose: { style: 'steep', len: [12, 16], front: [1, 1] },
      sections: [{ len: [6, 12], half: [3, 3] }, [{ len: [10, 14], half: [5, 5], taper: 1 }, { len: [12, 16], half: [4, 4] }]],
      rearWings: { len: [8, 10], reach: [2, 2], sweep: [1, 2] }, stern: [{ kind: 'bank', len: [0, 0], out: [0, 0] }, { kind: 'tail', len: [4, 5], out: [1, 1], rate: 3 }] },
    { id: 'corvette.flare', nose: { style: ['steep', 'round'], len: [9, 13], front: [1, 2] }, sections: [{ len: [24, 32], half: [4, 6] }],
      mounts: [{ kind: 'wing', count: [1, 1], len: [8, 10], reach: [3, 4], cut: true, span: [0.05, 0.55] }], stern: { kind: 'flare', len: [7, 10], out: [3, 4] } },
  ],
  // Escort: medium and compact, a wing pair for its point defence.
  frigate: [
    { id: 'frigate.screen', nose: { style: ['cheek', 'round'], len: [11, 15], front: [2, 4] }, sections: [{ len: [32, 40], half: [6, 8] }],
      mounts: [{ kind: 'wing', count: [1, 1], len: [11, 15], reach: [4, 5], span: [0.15, 0.65] }], stern: { kind: 'quarters', len: [10, 13], out: [2, 4], aft: [3, 5] } },
    // The belly sits forward or aft per seed.
    { id: 'frigate.belly', nose: { style: ['round', 'cheek'], len: [12, 16], front: [2, 4] },
      sections: [[{ len: [6, 9], half: [5, 6] }, { len: [14, 18], half: [5, 6] }], { len: [16, 22], half: [8, 10] }, [{ len: [6, 8], half: [6, 7] }, { len: [12, 16], half: [6, 7] }]],
      mounts: [{ kind: 'wing', count: [1, 2], len: [9, 11], reach: [3, 4], cut: true, span: [0.3, 0.75] }], stern: [{ kind: 'flare', len: [10, 12], out: [3, 4], rate: 3 }, { kind: 'quarters', len: [9, 11], out: [2, 3], aft: [3, 4] }] },
  ],
  // Striker: long and lean, the guns forward.
  destroyer: [
    { id: 'destroyer.pod', pod: { len: [5, 9], half: [3, 4] },
      sections: [[{ len: [18, 26], half: [6, 7] }, { len: [18, 26], half: [5, 5] }], { len: [22, 30], half: [6, 7] }],
      mounts: [{ kind: 'embrasure', count: [3, 4], len: [4, 5], depth: [1, 1], tooth: 5, span: [0.05, 0.75] }], stern: { kind: 'flare', len: [10, 13], out: [3, 4] } },
    // Distinct masses: a slim gun deck forward, an armoured block amidships, a neck, a drive block.
    { id: 'destroyer.lance', nose: { style: ['stepped', 'steep'], len: [12, 16], front: [1, 2] },
      sections: [[{ len: [8, 12], half: [4, 4] }, { len: [14, 18], half: [4, 5] }], { len: [16, 22], half: [7, 8], taper: 1 }, { len: [6, 10], half: [5, 5], taper: 1 }, { len: [10, 14], half: [7, 8], taper: 1 }],
      mounts: [{ kind: 'embrasure', count: [2, 3], len: [4, 5], depth: [1, 2], tooth: 5, span: [0.15, 0.7] }], stern: [{ kind: 'bank', len: [0, 0], out: [0, 0] }, { kind: 'flare', len: [8, 10], out: [3, 4] }] },
  ],
  // Ship of the line: big and heavy, embrasures down the side and a raked wing, a square drive bank.
  cruiser: [
    { id: 'cruiser.line', nose: { style: ['stepped', 'steep'], len: [16, 22], front: [2, 4] },
      sections: [[{ len: [10, 14], half: [8, 10] }, { len: [20, 26], half: [8, 9] }], { len: [34, 44], half: [11, 13] }, { len: [10, 14], half: [7, 8], taper: 1 }, [{ len: [8, 10], half: [11, 12], taper: 0 }, { len: [8, 10], half: [11, 12], taper: 1 }]],
      mounts: [{ kind: 'embrasure', count: [3, 4], len: [4, 5], depth: [1, 2], tooth: 6, span: [0.25, 0.8] }, { kind: 'wing', count: [1, 1], len: [16, 20], reach: [5, 6], rake: 3, span: [0.7, 1], chance: 0.6 }],
      stern: { kind: 'bank', len: [0, 0], out: [0, 0] } },
    // A broad armoured citadel amidships, hard shoulders fore and aft, a command pod ahead and a narrower drive block behind.
    { id: 'cruiser.citadel', pod: { len: [6, 9], half: [5, 6] },
      sections: [{ len: [6, 10], half: [8, 9] }, { len: [26, 34], half: [14, 16], taper: 1 }, [{ len: [12, 14], half: [9, 10], taper: 1 }, { len: [14, 18], half: [9, 10], taper: 1 }], [{ len: [8, 10], half: [12, 13], taper: 0 }, { len: [8, 10], half: [12, 13], taper: 1 }]],
      mounts: [{ kind: 'embrasure', count: [3, 4], len: [4, 5], depth: [1, 2], tooth: 6, span: [0.1, 0.75] }], stern: { kind: 'bank', len: [0, 0], out: [0, 0] } },
  ],
  // Launcher: broad, built around its hangar.
  carrier: [
    // A launch lane open out of the stern between two decks.
    { id: 'carrier.split', nose: { style: ['round', 'cheek'], len: [13, 17], front: [3, 5] }, sections: [{ len: [56, 70], half: [13, 15] }],
      split: { at: [0.25, 0.5], lane: [3, 6], end: ['square', 'round'] }, stern: [{ kind: 'bank', len: [0, 0], out: [0, 0] }, { kind: 'flare', len: [10, 13], out: [3, 4], rate: 3 }] },
    // A broad hangar block behind a narrow bow, launching from bays open in its flanks.
    { id: 'carrier.deck', nose: { style: ['cheek', 'stepped'], len: [12, 16], front: [3, 4] },
      sections: [[{ len: [10, 14], half: [8, 9] }, { len: [16, 20], half: [7, 8] }], { len: [48, 58], half: [14, 16], taper: 1 }, { len: [8, 12], half: [11, 12], taper: 1 }],
      mounts: [{ kind: 'embrasure', count: [2, 3], len: [7, 9], depth: [4, 5], tooth: 6, span: [0.2, 0.9] }],
      stern: [{ kind: 'bank', len: [0, 0], out: [0, 0] }, { kind: 'flare', len: [8, 10], out: [3, 4], rate: 3 }] },
  ],
};
