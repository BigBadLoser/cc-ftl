import type { StationDef, StationRoomDef, StationSize, StationTier } from '../sim';
import { stationRecipes as R } from './stationRecipes';

/**
 * Station kinds for the station assembly (src/sim/shipgen/stationBuild.ts). Three size tiers each: a frontier outpost,
 * a station, and a system hub much bigger than any ship. Most are armed to the teeth and carry many NPCs, security
 * among them (armed from their armoury lockers by `role.security`'s loadout); pirate dens are weaker on purpose.
 */

type Per = Readonly<Record<StationSize, number>>;
const per = (outpost: number, station: number, hub: number): Per => ({ outpost, station, hub });

interface TierNums { bays?: Per; pods?: Per; guns: Per; heavyPct: number; shields: Per; pd: Per; crates: Per; docks: Per }
function tiers(n: TierNums): Record<StationSize, StationTier> {
  const one = (s: StationSize): StationTier => ({
    guns: n.guns[s], heavyPct: n.heavyPct, shields: n.shields[s], pointDefense: n.pd[s],
    crates: n.crates[s], docks: n.docks[s], ...(n.bays ? { bays: n.bays[s] } : {}), ...(n.pods ? { pods: n.pods[s] } : {}),
  });
  return { outpost: one('outpost'), station: one('station'), hub: one('hub') };
}

const room = (role: StationRoomDef['role'], mods: string[], w: number, h: number, count: Per, items?: StationRoomDef['items']): StationRoomDef =>
  ({ role, mods, w, h, count, ...(items ? { items } : {}) });
const n = (k: number, id: string): string[] => Array<string>(k).fill(id);

/** Weapon lockers: rifles and sidearms for the security crew. */
const ARMS = [{ item: 'item.rifle', min: 1, max: 2 }, { item: 'item.sidearm', min: 0, max: 1 }];
const armoury = (count: Per, lockers = 4): StationRoomDef => room('armoury', n(lockers, 'module.storage_locker'), lockers + 2, 3, count, ARMS);

/** A trader's stall: racks of goods and a counter. Placeholder fittings until a stall has modules of its own. */
const stall = (count: Per): StationRoomDef => ({ ...room('cargo', ['module.storage_rack', 'module.storage_rack', 'module.console'], 5, 4, count), dept: 'market' });

/** A breaker shop: the scrapper, scrap cages beside it and a pallet for what comes out. */
const breaker = (count: Per): StationRoomDef => room('industry', ['module.scrapper', 'module.storage_scrap', 'module.storage_scrap', 'module.storage_pallet'], 8, 5, count);

const CIVIL_CREW = {
  required: ['role.engineer', 'role.gunner'],
  pool: [{ value: 'role.engineer', weight: 3 }, { value: 'role.medic', weight: 1 }, { value: 'role.gunner', weight: 1 }, { value: 'role.pilot', weight: 1 }, { value: 'role.scientist', weight: 1 }],
  species: ['species.human'],
};
const LIGHT = [{ value: 'module.burstLaser', weight: 3 }, { value: 'module.ionCannon', weight: 1 }];
const HEAVY = [{ value: 'module.massDriver', weight: 2 }, { value: 'module.missileLauncher', weight: 1 }];
const SMALL_SHIELD = [{ value: 'module.shieldGen', weight: 1 }];

export const stations = {
  // Trade: big holds round a market core, many docking arms.
  'station.trading': {
    name: 'Trade station', kind: 'trading', side: 'neutral', motif: 'motif.civilian', security: 0.3, space: [1.1, 1.6], crew: CIVIL_CREW,
    // The bazaar ring and the crescent, each a family; the seed picks one.
    assembly: [R.bazaar, R.crescent],
    // Neither suits a rock: an asteroid trading post is a prefab base, modules on the ground round landing pads.
    outpostAssembly: [R.prefab],
    weapons: { light: LIGHT, heavy: HEAVY }, shields: SMALL_SHIELD,
    stock: [{ item: 'item.metal', min: 2, max: 8 }, { item: 'item.electronics', min: 1, max: 4 }, { item: 'item.polymer', min: 0, max: 4 }, { item: 'item.ration', min: 0, max: 4 }],
    // Airlocks: a harbour the length of one face of the ring.
    tiers: tiers({ guns: per(2, 6, 12), heavyPct: 25, shields: per(1, 2, 3), pd: per(1, 2, 3), crates: per(12, 30, 60), docks: per(3, 3, 6) }),
    // Holds, the armoury and a market: traders' stalls round a court.
    rooms: [room('cargo', n(4, 'module.storage'), 8, 5, per(1, 2, 4)), armoury(per(1, 1, 2)), stall(per(4, 8, 12))],
    atrium: { role: 'plaza' },
  },
  // Research: consoles and fabricator benches round a quiet ring, stores of parts and electronics; lightly armed, calm space.
  'station.research': {
    name: 'Research station', kind: 'research', side: 'neutral', motif: 'motif.civilian', security: 0.2, space: [1, 1.5], crew: CIVIL_CREW,
    // The compound's half rings (arcs), the labs down the spine; to be reviewed against the crescent.
    assembly: [[R.compound[1], R.compound[2]]],
    weapons: { light: LIGHT, heavy: HEAVY }, shields: SMALL_SHIELD,
    stock: [{ item: 'item.electronics', min: 3, max: 8 }, { item: 'item.parts', min: 1, max: 4 }, { item: 'item.polymer', min: 0, max: 4 }],
    tiers: tiers({ guns: per(1, 3, 6), heavyPct: 10, shields: per(1, 1, 2), pd: per(1, 1, 2), crates: per(8, 18, 36), docks: per(2, 3, 4) }),
    // Laboratories; its fabricators stand in the workshop every station has.
    rooms: [
      room('industry', ['module.research', 'module.research', 'module.console', 'module.console', 'module.storage_locker', 'module.storage_locker'], 9, 5, per(1, 2, 4)),
      room('cargo', n(3, 'module.storage'), 7, 4, per(1, 1, 2), [{ item: 'item.electronics', min: 6, max: 20 }, { item: 'item.parts', min: 2, max: 8 }]),
      armoury(per(1, 1, 1), 3),
    ],
    atrium: { role: 'garden' },
  },
  // Mining: refineries on ore-processing floors, the pod deck and big ore stores, docks for the mining ships.
  'station.mining': {
    name: 'Mining station', kind: 'mining', side: 'neutral', motif: 'motif.civilian', barracks: { beds: [6, 8], cabins: 4 }, security: 0.25, space: [0.8, 1.2], crew: CIVIL_CREW,
    // The spine, one straight street only.
    assembly: [[R.spine[0]]],
    // An asteroid mine: a prefab base, a refinery wing.
    outpostAssembly: [R.mineWing],
    weapons: { light: LIGHT, heavy: HEAVY }, shields: SMALL_SHIELD,
    stock: [{ item: 'item.metal', min: 4, max: 12 }, { item: 'item.ice', min: 2, max: 8 }, { item: 'item.scrap_hull', min: 0, max: 6 }, { item: 'item.iron_ore', min: 4, max: 14 }, { item: 'item.rare_ore', min: 0, max: 4 }],
    tiers: tiers({ pods: per(2, 4, 6), guns: per(2, 5, 10), heavyPct: 20, shields: per(1, 2, 3), pd: per(1, 2, 3), crates: per(10, 24, 48), docks: per(3, 4, 6) }),
    rooms: [
      room('industry', n(2, 'module.refinery'), 10, 7, per(1, 2, 4), [{ item: 'item.iron_ore', min: 300, max: 3000 }, { item: 'item.ice', min: 150, max: 1500 }, { item: 'item.rare_ore', min: 150, max: 1500 }, { item: 'item.energy_crystal', min: 100, max: 600 }]),
      room('cargo', n(4, 'module.storage'), 8, 5, per(1, 2, 3), [{ item: 'item.metal', min: 4, max: 12 }, { item: 'item.ice', min: 2, max: 8 }, { item: 'item.iron_ore', min: 6, max: 20 }, { item: 'item.rare_ore', min: 0, max: 5 }]),
      armoury(per(1, 1, 1)),
      breaker(per(0, 1, 1)),
    ],
    atrium: { role: 'plaza' },
  },
  // Farming: greenhouses, extra crew quarters and messes round a plaza, produce stores; lightly guarded.
  'station.farming': {
    name: 'Agri station', kind: 'farming', side: 'neutral', motif: 'motif.civilian', security: 0.2, space: [1, 1.4], crew: CIVIL_CREW,
    assembly: [R.agri],
    // An asteroid farm: a prefab base, a farm hall with greenhouse ribs or a greenhouse cluster (the seed picks).
    outpostAssembly: [R.farmRows, R.farmCluster],
    weapons: { light: LIGHT, heavy: HEAVY }, shields: SMALL_SHIELD,
    stock: [{ item: 'item.ration', min: 4, max: 12 }, { item: 'item.polymer', min: 0, max: 4 }],
    tiers: tiers({ guns: per(2, 4, 8), heavyPct: 15, shields: per(0, 1, 2), pd: per(1, 1, 2), crates: per(12, 24, 40), docks: per(2, 2, 3) }),
    // Greenhouses (long, narrow farms: hydroponics in two rows down their length) and extra common rooms.
    rooms: [
      room('farm', n(6, 'module.hydroponics'), 5, 9, per(2, 4, 8)),
      // The produce store: cold stores of what the greenhouses grow, beside the cargo.
      room('cargo', n(4, 'module.storage_cold'), 7, 3, per(1, 2, 3), [{ item: 'item.ration', min: 6, max: 16 }]),
      room('support', ['module.lifeSupport'], 6, 3, per(1, 2, 4)),
      armoury(per(1, 1, 1)),
    ],
    atrium: { role: 'plaza' },
  },
  // Military depot: heavy guns, shield generators, armouries and barracks, few docks.
  'station.military': {
    name: 'Navy depot', kind: 'military', side: 'hostile', motif: 'motif.navy', barracks: { beds: [6, 8] }, security: 0.55, space: [0.6, 0.9],
    // The star fort, and the compound's ring with barracks.
    assembly: [R.fort, [R.compound[3]]],
    crew: { required: ['role.engineer', 'role.gunner', 'role.gunner'], pool: [{ value: 'role.gunner', weight: 3 }, { value: 'role.engineer', weight: 2 }, { value: 'role.medic', weight: 1 }], species: ['species.human'] },
    weapons: { light: LIGHT, heavy: HEAVY }, shields: [{ value: 'module.shieldGen', weight: 1 }],
    stock: [{ item: 'item.metal', min: 2, max: 6 }, { item: 'item.missile', min: 2, max: 6 }, { item: 'item.electronics', min: 0, max: 3 }],
    tiers: tiers({ bays: per(0, 1, 2), guns: per(4, 12, 24), heavyPct: 50, shields: per(2, 4, 6), pd: per(2, 4, 6), crates: per(6, 14, 28), docks: per(2, 3, 3) }),
    // Armouries, and drone bays (two drones a bay) in rooms of two: the depot's own patrol. Defence, not works.
    rooms: [armoury(per(1, 2, 4), 6), { ...room('hangar', n(2, 'module.droneBay'), 6, 4, per(1, 2, 3)), dept: 'defence' }],
    atrium: { role: 'drill' },
  },
  // Pirate den: scrappy welded modules, light defences (conquerable on purpose), loot stores.
  'station.pirate': {
    name: 'Pirate den', kind: 'pirate', side: 'hostile', motif: 'motif.scrapper', security: 0.15, space: [0.5, 1.1],
    assembly: [R.tree],
    crew: { required: ['role.engineer'], pool: [{ value: 'role.gunner', weight: 2 }, { value: 'role.engineer', weight: 2 }, { value: 'role.pilot', weight: 1 }, { value: 'role.medic', weight: 1 }], species: ['species.human'] },
    weapons: { light: [{ value: 'module.burstLaser', weight: 2 }, { value: 'module.incendiaryLauncher', weight: 1 }], heavy: [{ value: 'module.massDriver', weight: 1 }] },
    shields: [{ value: 'module.shieldGen', weight: 1 }],
    stock: [{ item: 'item.scrap_hull', min: 2, max: 8 }, { item: 'item.metal', min: 0, max: 4 }, { item: 'item.electronics', min: 0, max: 3 }],
    tiers: tiers({
      guns: per(1, 3, 6), heavyPct: 15, shields: per(0, 1, 1), pd: per(0, 1, 1), crates: per(8, 16, 30), docks: per(2, 3, 3),
    }),
    rooms: [
      room('cargo', n(3, 'module.storage'), 6, 4, per(1, 2, 3), [{ item: 'item.electronics', min: 1, max: 4 }, { item: 'item.rifle', min: 0, max: 1 }, { item: 'item.parts', min: 0, max: 3 }]),
      armoury(per(1, 1, 1), 3),
      breaker(per(1, 1, 2)),
    ],
  },
} satisfies Record<string, StationDef>;
