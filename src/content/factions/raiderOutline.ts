import type { BladeSpec, OutlineRecipe, Profile } from '../../sim';

/**
 * Raider clan outline recipes (SHIPGEN_V4, "Ship recipes and layout parts"). PROTOTYPE (#581). Small, fast boarders built
 * for the job, not taken from anyone: drives large for the hull, bunks for a big crew, a shuttle bay for the boarding
 * party, guns forward.
 */
const RAIDER: readonly Profile[] = [
  // A wide body under its blades (raider_kit_v18): a long taper to a narrow prow, or a blunt ram, a flat drive bank.
  { id: 'raider.taper', nose: { style: 'steep', len: [8, 11], front: [2, 3] }, sections: [{ len: [16, 22], half: [7, 8] }], stern: { kind: 'bank', len: [3, 4], out: [0, 0] } },
  { id: 'raider.ram', nose: { style: 'stepped', len: [4, 6], front: [4, 5] }, sections: [{ len: [18, 24], half: [7, 8] }], stern: { kind: 'bank', len: [3, 4], out: [0, 0] } },
];

/** The blade palette, one draw a ship (bladeShapes.ts). */
const BLADES: BladeSpec = {
  fore: ['claw', 'claw2', 'slab2', 'spikes2', 'kink', null],
  aft: ['slab', 'slab2', 'slab3', 'spikes2', 'spikes3', 'kink'],
  horn: 0.4,
  lead: ['aft', 'aft', 'fore'],
};

export const raiderOutline = {
  raider: { family: 'raider', profiles: RAIDER, maxBeam: 29, bays: 1, blades: BLADES, crew: { sleep: 'bunks' }, layout: { kind: 'bays', program: { pd: false, least: 64 } } },
} satisfies Record<string, OutlineRecipe>;
