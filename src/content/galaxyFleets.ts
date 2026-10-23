import type { FactionFleetDef, FleetContent, FleetGroupDef } from '../sim';
import { corpNames, droneFirst, droneSecond, navyNames, pirateFirst, pirateSecond, traderFirst, traderSecond } from './shipNames';

/**
 * Fleets of the galaxy factions (the living world, docs/STATUS.md). Where ships come from:
 * - **Ports** (derived from structures, `sim/galaxy/ports.ts`): stations, pirate dens, navy depots, mining outposts in a faction's territory and
 *   drone nests (derelicts in rogue space). `ports` below says how many groups a port of each size (1 to 3) fields and how slowly it rebuilds a loss.
 * - **Groups**: each faction has a `FleetGroupDef` per role it fields. A group's size is a budget (`sizeCost`: small 2, medium 3, heavy 4): the budget is
 *   drawn, then ships are drawn while their cost fits, up to `maxShips`. Navy patrols: budget 4 = two small ships, one medium or one heavy; pirates:
 *   mostly budget 2 (one small ship), a fifth of the time 4 (two small ones); traders, civilians and miners are `maxShips: 1`, always a single ship.
 * - **Ship classes**: `classes` gives each generator hull family (`content/factions`) a size class and the roles it can serve, so "a heavy navy ship" is a
 *   cruiser or a carrier. A class is only used at a depth where the family has weight (cruisers appear from danger 4).
 */
const fleet: FleetContent = {
  sizeCost: { small: 2, medium: 3, heavy: 4 },
  classes: {
    'faction.navy': {
      corvette: { size: 'small', roles: ['patrol'] }, frigate: { size: 'medium', roles: ['patrol'] },
      cruiser: { size: 'heavy', roles: ['patrol'] }, carrier: { size: 'heavy', roles: ['patrol'] },
    },
    'faction.civilian': {
      mining: { size: 'small', roles: ['miner'] }, freighter: { size: 'medium', roles: ['trader'] }, liner: { size: 'heavy', roles: ['trader'] },
    },
    'faction.scrapper': {
      raider: { size: 'small', roles: ['pirate'] }, hauler: { size: 'medium', roles: ['pirate'] }, gunrunner: { size: 'medium', roles: ['pirate'] },
    },
    'faction.drones': {
      picket: { size: 'small', roles: ['raider'] }, lancer: { size: 'medium', roles: ['raider'] }, swarm: { size: 'heavy', roles: ['raider'] },
    },
  },
  ports: {
    station: { name: 'Station', groups: [1, 2, 3], rebuildTurns: 12 },
    depot: { name: 'Navy depot', groups: [1, 2, 3], rebuildTurns: 12 },
    den: { name: 'Pirate den', groups: [1, 2, 3], rebuildTurns: 16 },
    outpost: { name: 'Mining outpost', groups: [1, 1, 2], rebuildTurns: 14 },
    nest: { name: 'Drone nest', groups: [1, 2, 2], rebuildTurns: 20 },
  },
};

const single = (weight: number, sizes: FleetGroupDef['sizes'], budget: FleetGroupDef['budget']): FleetGroupDef => ({ weight, budget, sizes, maxShips: 1 });
const traders = (weight: number): FleetGroupDef => single(weight, [{ value: 'medium', weight: 3 }, { value: 'heavy', weight: 1 }], [{ value: 3, weight: 2 }, { value: 4, weight: 1 }]);
const miners = (weight: number): FleetGroupDef => single(weight, [{ value: 'small', weight: 1 }], [{ value: 2, weight: 1 }]);
const patrol = (weight: number, budget: FleetGroupDef['budget']): FleetGroupDef => ({
  weight, budget, maxShips: 2, sizes: [{ value: 'small', weight: 3 }, { value: 'medium', weight: 2 }, { value: 'heavy', weight: 2 }],
});

const raiders = (budget: FleetGroupDef['budget'], sizes: FleetGroupDef['sizes']): FleetGroupDef => ({ weight: 1, maxShips: 2, budget, sizes });

const corp = (prefix: string): FactionFleetDef => ({
  groups: { trader: traders(5), miner: miners(1), patrol: patrol(1, [{ value: 2, weight: 2 }, { value: 4, weight: 1 }]) },
  names: { prefix, first: corpNames },
});

/** Fleet definitions by galaxy faction id (`GalaxyFactionDef.fleet`). */
export const factionFleets = {
  navy: { groups: { patrol: patrol(1, [{ value: 4, weight: 3 }, { value: 2, weight: 1 }]) }, names: { prefix: 'CNS', first: navyNames } },
  meridian: corp('MCV'),
  helix: corp('HBV'),
  vantor: corp('VHI'),
  traders: { groups: { trader: traders(4), miner: miners(1) }, names: { first: traderFirst, second: traderSecond } },
  pirates: {
    groups: { pirate: raiders([{ value: 2, weight: 7 }, { value: 3, weight: 1 }, { value: 4, weight: 2 }], [{ value: 'small', weight: 6 }, { value: 'medium', weight: 1 }]) },
    names: { first: pirateFirst, second: pirateSecond },
  },
  rogue: {
    groups: { raider: raiders([{ value: 2, weight: 6 }, { value: 4, weight: 2 }], [{ value: 'small', weight: 4 }, { value: 'medium', weight: 2 }, { value: 'heavy', weight: 1 }]) },
    names: { prefix: 'Unit', first: droneFirst, second: droneSecond },
  },
} satisfies Record<string, FactionFleetDef>;

export const fleetContent = fleet;
