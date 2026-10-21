import type { StationDef, StationGrammar, StationRoomDef, StationSize, StationTier, Weighted } from '../sim';

/**
 * Station kinds for the station generator (src/sim/shipgen/stationGen.ts). Three size tiers each: a frontier outpost,
 * a station, and a system hub much bigger than any ship. Most are armed to the teeth and carry many NPCs, security
 * among them (armed from their armoury lockers by `role.security`'s loadout); pirate dens are weaker on purpose.
 */

type Per = Readonly<Record<StationSize, number>>;
const per = (outpost: number, station: number, hub: number): Per => ({ outpost, station, hub });

/** Crew at each size before the kind's factor. */
const CREW = per(8, 20, 44);

const g = (...xs: [StationGrammar, number][]): Weighted<StationGrammar>[] => xs.map(([value, weight]) => ({ value, weight }));
const CIVIL_SHAPES: Record<StationSize, Weighted<StationGrammar>[]> = {
  outpost: g(['stationRing', 2], ['stationLattice', 2]),
  station: g(['stationRing', 2], ['stationLattice', 2], ['stationHub', 1]),
  hub: g(['stationHub', 1]),
};

interface TierNums { cages?: Per; crew: number; guns: Per; heavyPct: number; shields: Per; pd: Per; crates: Per; docks: Per; shapes?: Record<StationSize, Weighted<StationGrammar>[]> }
function tiers(n: TierNums): Record<StationSize, StationTier> {
  const one = (s: StationSize): StationTier => ({
    crew: Math.round(CREW[s] * n.crew), guns: n.guns[s], heavyPct: n.heavyPct, shields: n.shields[s], pointDefense: n.pd[s],
    crates: n.crates[s], docks: n.docks[s], grammars: (n.shapes ?? CIVIL_SHAPES)[s], ...(n.cages ? { cages: n.cages[s] } : {}),
  });
  return { outpost: one('outpost'), station: one('station'), hub: one('hub') };
}

const room = (role: StationRoomDef['role'], mods: string[], w: number, h: number, count: Per, items?: StationRoomDef['items']): StationRoomDef =>
  ({ role, mods, w, h, count, ...(items ? { items } : {}) });
const n = (k: number, id: string): string[] => Array<string>(k).fill(id);

/** Weapon lockers: rifles and sidearms for the security crew. */
const ARMS = [{ item: 'item.rifle', min: 1, max: 2 }, { item: 'item.sidearm', min: 0, max: 1 }];
const armoury = (count: Per, lockers = 4): StationRoomDef => room('armoury', n(lockers, 'module.storage_locker'), lockers + 2, 3, count, ARMS);

const CIVIL_CREW = {
  required: ['role.engineer', 'role.gunner'],
  pool: [{ value: 'role.engineer', weight: 3 }, { value: 'role.medic', weight: 1 }, { value: 'role.gunner', weight: 1 }, { value: 'role.pilot', weight: 1 }],
  species: ['species.human'],
};
const FAIRING = { slope: 3, max: 2, jitter: 0, label: 'fairing' };
const LIGHT = [{ value: 'module.burstLaser', weight: 3 }, { value: 'module.ionCannon', weight: 1 }];
const HEAVY = [{ value: 'module.massDriver', weight: 2 }, { value: 'module.missileLauncher', weight: 1 }];
const SMALL_SHIELD = [{ value: 'module.shieldGenSmall', weight: 2 }, { value: 'module.shieldGen', weight: 1 }];

export const stations = {
  // Trade: big holds round a market core, many docking arms.
  'station.trading': {
    name: 'Trade station', kind: 'trading', side: 'neutral', motif: 'motif.civilian', security: 0.3, crew: CIVIL_CREW,
    weapons: { light: LIGHT, heavy: HEAVY }, shields: SMALL_SHIELD, transition: FAIRING,
    stock: [{ item: 'item.metal', min: 2, max: 8 }, { item: 'item.electronics', min: 1, max: 4 }, { item: 'item.polymer', min: 0, max: 4 }, { item: 'item.ration', min: 0, max: 4 }],
    tiers: tiers({ crew: 1, guns: per(2, 6, 12), heavyPct: 25, shields: per(1, 2, 3), pd: per(1, 2, 3), crates: per(12, 30, 60), docks: per(3, 5, 8) }),
    rooms: [room('cargo', n(4, 'module.storage'), 8, 5, per(1, 2, 4)), armoury(per(1, 1, 2))],
  },
  // Mining: refineries on ore-processing floors, ore cages and big ore stores, docks for the mining ships.
  'station.mining': {
    name: 'Mining station', kind: 'mining', side: 'neutral', motif: 'motif.civilian', security: 0.25, crew: CIVIL_CREW,
    weapons: { light: LIGHT, heavy: HEAVY }, shields: SMALL_SHIELD, transition: FAIRING,
    stock: [{ item: 'item.metal', min: 4, max: 12 }, { item: 'item.ice', min: 2, max: 8 }, { item: 'item.scrap', min: 0, max: 6 }],
    tiers: tiers({ cages: per(1, 1, 2), crew: 1, guns: per(2, 5, 10), heavyPct: 20, shields: per(1, 2, 3), pd: per(1, 2, 3), crates: per(10, 24, 48), docks: per(3, 4, 6) }),
    rooms: [
      room('industry', n(2, 'module.refinery'), 7, 4, per(1, 2, 4)),
      room('cargo', n(4, 'module.storage'), 8, 5, per(1, 2, 3), [{ item: 'item.metal', min: 4, max: 12 }, { item: 'item.ice', min: 2, max: 8 }]),
      armoury(per(1, 1, 1)),
    ],
  },
  // Farming: hydroponics bays, extra crew quarters and messes; lightly guarded.
  'station.farming': {
    name: 'Agri station', kind: 'farming', side: 'neutral', motif: 'motif.civilian', security: 0.2, crew: CIVIL_CREW,
    weapons: { light: LIGHT, heavy: HEAVY }, shields: SMALL_SHIELD, transition: FAIRING,
    stock: [{ item: 'item.ration', min: 4, max: 12 }, { item: 'item.polymer', min: 0, max: 4 }],
    tiers: tiers({ crew: 1.1, guns: per(2, 4, 8), heavyPct: 15, shields: per(0, 1, 2), pd: per(1, 1, 2), crates: per(6, 14, 28), docks: per(2, 2, 3) }),
    rooms: [
      room('farm', ['module.lifeSupport', ...n(6, 'module.hydroponics')], 8, 4, per(2, 4, 8)),
      room('support', ['module.lifeSupport'], 6, 3, per(0, 1, 2)),
      armoury(per(1, 1, 1)),
    ],
  },
  // Military depot: heavy guns, shield generators, armouries and barracks, few docks.
  'station.military': {
    name: 'Navy depot', kind: 'military', side: 'hostile', motif: 'motif.navy', security: 0.55,
    crew: { required: ['role.engineer', 'role.gunner', 'role.gunner'], pool: [{ value: 'role.gunner', weight: 3 }, { value: 'role.engineer', weight: 2 }, { value: 'role.medic', weight: 1 }], species: ['species.human'] },
    weapons: { light: LIGHT, heavy: HEAVY }, shields: [{ value: 'module.shieldGen', weight: 1 }],
    transition: { slope: 2, max: 4, jitter: 0, label: 'taper' },
    stock: [{ item: 'item.metal', min: 2, max: 6 }, { item: 'item.missile', min: 2, max: 6 }, { item: 'item.electronics', min: 0, max: 3 }],
    tiers: tiers({ crew: 1.2, guns: per(4, 12, 24), heavyPct: 50, shields: per(2, 4, 6), pd: per(2, 4, 6), crates: per(6, 14, 28), docks: per(2, 2, 2) }),
    rooms: [armoury(per(1, 2, 4), 6)],
  },
  // Pirate den: scrappy welded modules, light defences (conquerable on purpose), loot stores.
  'station.pirate': {
    name: 'Pirate den', kind: 'pirate', side: 'hostile', motif: 'motif.scrapper', security: 0.15,
    crew: { required: ['role.engineer'], pool: [{ value: 'role.gunner', weight: 2 }, { value: 'role.engineer', weight: 2 }, { value: 'role.pilot', weight: 1 }, { value: 'role.medic', weight: 1 }], species: ['species.human'] },
    weapons: { light: [{ value: 'module.burstLaser', weight: 2 }, { value: 'module.incendiaryLauncher', weight: 1 }], heavy: [{ value: 'module.massDriver', weight: 1 }] },
    shields: [{ value: 'module.shieldGenSmall', weight: 1 }],
    transition: { slope: 1, max: 3, jitter: 0.5, label: 'adapter plating' },
    stock: [{ item: 'item.scrap', min: 2, max: 8 }, { item: 'item.metal', min: 0, max: 4 }, { item: 'item.electronics', min: 0, max: 3 }],
    tiers: tiers({
      crew: 0.8, guns: per(1, 3, 6), heavyPct: 15, shields: per(0, 1, 1), pd: per(0, 1, 1), crates: per(8, 16, 30), docks: per(2, 3, 3),
      shapes: { outpost: g(['stationWelded', 2], ['stationLattice', 1]), station: g(['stationWelded', 1]), hub: g(['stationWelded', 1]) },
    }),
    rooms: [
      room('cargo', n(3, 'module.storage'), 6, 4, per(1, 2, 3), [{ item: 'item.electronics', min: 1, max: 4 }, { item: 'item.rifle', min: 0, max: 1 }, { item: 'item.parts', min: 0, max: 3 }]),
      armoury(per(1, 1, 1), 3),
    ],
  },
} satisfies Record<string, StationDef>;
