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

/** The blade combinations of the approved mock sheet (raider_kit_v18), one a ship, and the noses (bladeShapes.ts). */
const BLADES: BladeSpec = {
  combos: [
    { fore: null, aft: 'slab2', lead: 'aft', horn: false },
    { fore: 'claw', aft: 'slab', lead: 'aft', horn: false },
    { fore: 'slab2', aft: null, lead: 'fore', horn: false },
    { fore: null, aft: 'spikes2', lead: 'aft', horn: false },
    { fore: 'claw', aft: 'slab2', lead: 'aft', horn: true },
    { fore: 'claw2', aft: 'spikes3', lead: 'aft', horn: false },
    { fore: 'kink', aft: 'slab', lead: 'fore', horn: false },
    { fore: 'spikes2', aft: 'slabPlain', lead: 'fore', horn: true },
    { fore: 'claw', aft: 'slab3', lead: 'aft', horn: true },
    { fore: 'claw2', aft: 'spikes3', lead: 'aft', horn: true },
    { fore: 'slab3', aft: 'kink', lead: 'fore', horn: false },
  ],
  noses: ['taper', 'point', 'spike', 'ram', 'round'],
  guns: true,
};

export const raiderOutline = {
  raider: { family: 'raider', profiles: RAIDER, maxBeam: 29, bays: 1, blades: BLADES, crew: { sleep: 'bunks' }, layout: { kind: 'bays', blades: true, program: { pd: false, least: 64 } } },
} satisfies Record<string, OutlineRecipe>;
