import type { ContentRegistry, ShipTemplate } from '../../sim';
import { content } from '../index';
import { raiderShip } from './raider';
import { starterShip } from './starter';

/** The starter with a second point-defence module in the quarters. */
export const twoPdStarter: ShipTemplate = { ...starterShip, modules: [...starterShip.modules, { def: 'module.pointDefense', x: 18, y: 5, rot: 0 }] };

/** The raider with a missile launcher (and missiles) in place of one burst laser: the only raider that can shoot a shuttle. */
export const missileRaider: ShipTemplate = {
  ...raiderShip,
  modules: [
    ...raiderShip.modules.filter((m) => !(m.def === 'module.burstLaser' && m.x === 12)),
    { def: 'module.missileLauncher', x: 12, y: 10, rot: 0 },
    { def: 'module.storage', x: 3, y: 10, rot: 0, stock: [{ item: 'item.missile', count: 40 }] },
  ],
};

export const missileRaiderId = 'ship.missileRaider';
/** Content with the two-turret starter and the missile raider registered. */
export const shuttleContent: ContentRegistry = {
  ...content, ships: { ...content.ships, 'ship.starter': twoPdStarter, [missileRaiderId]: missileRaider },
};
