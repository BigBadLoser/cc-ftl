import type { Part, Profile } from './silhouette';

/**
 * Navy silhouettes, two or three per type, from the parts settled on the option sheets and the type identities (docs/SHIPGEN_V4.md,
 * "Hull shape decisions"). Mid-depth proportions: a ship's plan will size them. Half-widths are tiles beside the centre
 * row, so a hull is 2 * half + 1 wide. Gun mounts are sized for a gun bay (light guns 2x2, heavy 3x3, plus walls).
 * A part given as a list is a choice per seed: that is how a recipe moves its masses between seeds and keeps its identity.
 */
/**
 * A carrier's body behind its bow: long and broad, met at a hard shoulder, then (half the time) the hulls either side of
 * the lane stepped in. The lane opens about half way along, after a stretch at full width (two bays); squared at its head.
 */
const CARRIER_BODY: readonly Part[] = [
  [{ len: [76, 82], half: [15, 16], taper: 1 }, { len: [72, 78], half: [16, 17], taper: 1 }],
  { len: [22, 28], half: [13, 14], chance: 0.5 },
];
const CARRIER_LANE: Profile['split'] = { at: [0.46, 0.5], lane: [4, 8], end: ['square'] };
const CARRIER_STERN: Profile['stern'] = [{ kind: 'flare', len: [8, 10], out: [3, 4] }, { kind: 'bank', len: [0, 0], out: [0, 0] }];

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
      sections: [[{ len: [10, 14], half: [8, 10] }, { len: [20, 26], half: [8, 9] }], { len: [34, 44], half: [11, 13] }, { len: [18, 22], half: [5, 6], taper: 1 }],
      mounts: [{ kind: 'embrasure', count: [3, 4], len: [4, 5], depth: [1, 2], tooth: 6, span: [0.25, 0.8] }, { kind: 'wing', count: [1, 1], len: [16, 20], reach: [5, 6], rake: 3, span: [0.7, 1], chance: 0.6 }],
      stern: { kind: 'flare', len: [8, 12], out: [4, 6] } },
    // A broad armoured citadel amidships, hard shoulders fore and aft, a command pod ahead and a narrower drive block behind.
    { id: 'cruiser.citadel', pod: { len: [6, 9], half: [5, 6] },
      sections: [{ len: [6, 10], half: [8, 9] }, { len: [26, 34], half: [14, 16], taper: 1 }, [{ len: [16, 20], half: [6, 7], taper: 1 }, { len: [20, 24], half: [6, 7], taper: 1 }]],
      mounts: [{ kind: 'embrasure', count: [3, 4], len: [4, 5], depth: [1, 2], tooth: 6, span: [0.1, 0.75] }], stern: { kind: 'flare', len: [8, 12], out: [4, 6] } },
  ],
  // PROTOTYPE (#581): a civilian liner: a broad forward section (command and machinery), a slim passenger deck either
  // side of a bulge amidships (its commons), a flared drive.
  liner: [
    { id: 'liner.deck', nose: { style: 'round', len: [8, 11], front: [3, 4] },
      sections: [{ len: [36, 44], half: [10, 11], taper: 1 }, { len: [18, 24], half: [5, 5] }, { len: [16, 20], half: [8, 9], taper: 1 }, { len: [16, 22], half: [5, 5] }],
      stern: { kind: 'flare', len: [7, 9], out: [3, 4] } },
  ],
  // Launcher: longer than a cruiser, built round a launch lane open out of the stern (its floor about a cruiser's, the lane
  // taking the rest). The bow picked per seed: a neck with hard shoulders, two steps, or a bulb on a neck.
  carrier: [
    { id: 'carrier.neck', nose: { style: 'steep', len: [10, 13], front: [2, 3] }, sections: [{ len: [18, 24], half: [8, 9] }, ...CARRIER_BODY], split: CARRIER_LANE, stern: CARRIER_STERN },
    { id: 'carrier.steps', nose: { style: 'steep', len: [10, 13], front: [2, 3] },
      sections: [{ len: [10, 14], half: [8, 9] }, { len: [10, 14], half: [12, 13], taper: 1 }, ...CARRIER_BODY], split: CARRIER_LANE, stern: CARRIER_STERN },
    { id: 'carrier.bulb', nose: { style: 'round', len: [7, 9], front: [3, 4] },
      sections: [{ len: [8, 10], half: [9, 10] }, { len: [8, 12], half: [6, 7], taper: 1 }, ...CARRIER_BODY], split: CARRIER_LANE, stern: CARRIER_STERN },
  ],
};
