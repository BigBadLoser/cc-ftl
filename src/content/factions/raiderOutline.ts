import type { OutlineRecipe, Profile } from '../../sim';

/**
 * Raider clan outline recipes (SHIPGEN_V4, "Ship recipes and layout parts"). PROTOTYPE (#581). Small, fast boarders built
 * for the job, not taken from anyone: drives large for the hull, bunks for a big crew, a shuttle bay for the boarding
 * party, guns forward.
 */
const RAIDER: readonly Profile[] = [
  // A ram: a blunt stepped prow wide at the front, a short body, quarter drives standing well aft.
  { id: 'raider.ram', nose: { style: 'stepped', len: [5, 7], front: [3, 4] }, sections: [{ len: [18, 24], half: [5, 6] }],
    stern: { kind: 'quarters', len: [9, 12], out: [2, 3], aft: [3, 4] } },
  // A claw: a fine bow, a wing pair swept forward near the front, a flared drive.
  { id: 'raider.claw', nose: { style: 'steep', len: [9, 12], front: [1, 1] }, sections: [{ len: [20, 26], half: [4, 5] }],
    mounts: [{ kind: 'wing', count: [1, 1], len: [7, 9], reach: [3, 4], cut: true, span: [0.0, 0.35] }], stern: { kind: 'flare', len: [7, 9], out: [3, 4] } },
  // A saw: a long slim hull, its sides notched into teeth, a tapered tail.
  { id: 'raider.saw', nose: { style: ['steep', 'cheek'], len: [10, 13], front: [1, 2] }, sections: [{ len: [28, 34], half: [4, 5] }],
    mounts: [{ kind: 'embrasure', count: [2, 3], len: [2, 3], depth: [1, 2], tooth: 5, span: [0.1, 0.8] }], stern: [{ kind: 'tail', len: [4, 6], out: [1, 1], rate: 3 }, { kind: 'bank', len: [0, 0], out: [0, 0] }] },
  // A wasp: a slim head, a stepped shoulder into a fat abdomen with swept wings, a flared drive.
  { id: 'raider.wasp', nose: { style: 'round', len: [6, 8], front: [2, 2] },
    sections: [{ len: [12, 16], half: [5, 5] }, { len: [16, 20], half: [7, 7] }],
    stern: { kind: 'flare', len: [6, 8], out: [2, 3] } },
];

export const raiderOutline = {
  raider: { family: 'raider', profiles: RAIDER, maxBeam: 25, bays: 1, crew: { sleep: 'bunks' }, layout: { kind: 'bays', program: { pd: false, least: 64 } } },
} satisfies Record<string, OutlineRecipe>;
