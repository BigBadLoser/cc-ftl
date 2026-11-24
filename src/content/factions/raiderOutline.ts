import type { BladeSpec, OutlineRecipe, Profile } from '../../sim';

/**
 * Raider clan outline recipes (SHIPGEN_V4, "Ship recipes and layout parts"). PROTOTYPE (#581). Small, fast boarders built
 * for the job, not taken from anyone: drives large for the hull, bunks for a big crew, a shuttle bay for the boarding
 * party, guns forward.
 */
const RAIDER: readonly Profile[] = [
  // A wide blunt body: its nose and blades are drawn onto it once its rooms are cut (BLADES).
  { id: 'raider.body', nose: { style: 'stepped', len: [3, 4], front: [5, 6] }, sections: [{ len: [18, 24], half: [7, 8] }], stern: { kind: 'bank', len: [3, 4], out: [0, 0] } },
];

/** The blade palette, one draw a ship (bladeShapes.ts). */
const BLADES: BladeSpec = {
  fore: ['claw', 'claw2', 'slab2', 'spikes2', 'kink', null],
  aft: ['slab', 'slab2', 'slab3', 'spikes2', 'spikes3', 'kink'],
  horn: 0.4,
  lead: ['aft', 'aft', 'fore'],
  noses: ['taper', 'point', 'spike', 'ram', 'round'],
};

export const raiderOutline = {
  raider: { family: 'raider', profiles: RAIDER, maxBeam: 29, bays: 1, blades: BLADES, crew: { sleep: 'bunks' }, layout: { kind: 'bays', blades: true, program: { pd: false, least: 64 } } },
} satisfies Record<string, OutlineRecipe>;
