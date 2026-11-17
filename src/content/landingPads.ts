import type { ModuleDef } from '../sim';

/**
 * The landing pad (#509): nine by nine tiles of levelled rock a surface base keeps its shuttle on, where visiting shuttles land, and from
 * where crew walk (in suits, over the open ground) to the airlock beside it. A vehicle bay with no pit (`vehicleBay.pad`, sim/modules/landingPad.ts).
 * Its cable port is the middle of its +x side at rotation 0, turned with the rotation like a turret mount's (sim/modules/groundMount.ts); the generator turns it to face its cable. Crew board at the edge tile nearest its airlock (`padBoardTile`), so it has no `access`. Not for the player to build (no blueprint,
 * left out of the build catalog); the prefab generator stands one on each pad box it reserves.
 */
export const landingPads: Record<string, ModuleDef> = {
  'module.landing_pad': {
    name: 'Landing pad',
    scrap: 'hull',
    description: 'Levelled ground a shuttle lands on. Crew suit up at the airlock beside it and walk across.',
    asset: 'module.landing_pad', footprint: [9, 9], solid: false,
    power: -1, powerPriority: 4, flammability: 0, maxHp: 400, buildWork: 600, vehicleBay: { class: 'shuttle', pad: true }, groundMount: true,
    cost: [{ item: 'item.metal', count: 40 }],
  },
};
