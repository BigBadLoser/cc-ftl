import type { ModuleDef } from '../sim';

/**
 * The landing pad (#509): nine by nine tiles of levelled rock a surface base keeps its shuttle on, where visiting shuttles land, and from
 * where crew walk (in suits, over the open ground) to the airlock beside it. A vehicle bay with no pit (`vehicleBay.pad`, sim/modules/landingPad.ts).
 * Crew board and leave at the middle of its east side at rotation 0 (the side that faces its airlock). Not for the player to build (no blueprint,
 * left out of the build catalog); the prefab generator stands one on each pad box it reserves.
 */
export const landingPads: Record<string, ModuleDef> = {
  'module.landing_pad': {
    name: 'Landing pad',
    description: 'Levelled ground a shuttle lands on. Crew suit up at the airlock beside it and walk across.',
    asset: 'module.landing_pad', footprint: [9, 9], solid: false, access: [8, 4],
    power: 0, flammability: 0, maxHp: 400, buildWork: 600, vehicleBay: { class: 'shuttle', pad: true },
    cost: [{ item: 'item.metal', count: 40 }],
  },
};
