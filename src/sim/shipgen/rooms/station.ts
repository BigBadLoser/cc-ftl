import type { RoomRecipe, Vignette } from './types';

/**
 * Station rooms. Farms: rows of hydroponics beds with walkways between them. Industry: refineries on the walls, ore
 * pallets and containers packed round one walkway. Armoury: weapon lockers (stocked with hand weapons) and racks.
 */
export const farm = {
  fill: 0.6,
  arrangements: [
    {
      name: 'grow rows', weight: 2, walkway: 'long', steps: [
        { mod: 'module.lifeSupport', count: 'spec', wall: 'end' },
        { mod: 'module.hydroponics', count: 'spec', row: true, rots: [0] },
        { mod: 'module.hydroponics', count: 'fill', row: true, rots: [0] },
      ],
    },
    {
      name: 'grow beds', weight: 1, steps: [
        { mod: 'module.lifeSupport', count: 'spec', wall: 'any' },
        { mod: 'module.hydroponics', count: 'spec', wall: 'any', row: true },
        { mod: ['module.hydroponics', 'module.storage_locker'], count: 'fill', wall: 'any', row: true },
      ],
    },
  ],
} as const satisfies RoomRecipe;

export const industry = {
  fill: 0.7,
  arrangements: [
    {
      name: 'refinery floor', weight: 2, walkway: 'long', steps: [
        { mod: 'module.refinery', count: 'spec', wall: 'long', row: true, with: { mod: 'module.storage_ore', n: 2, big: 'module.storage_ore_large' } },
        { mod: 'module.storage_pallet', count: 'fill', pack: true },
      ],
    },
    {
      name: 'ore hall', weight: 1, walkway: 'cross', steps: [
        { mod: 'module.refinery', count: 'spec', wall: 'any', with: { mod: 'module.storage_ore', n: 1, big: 'module.storage_ore_large' } },
        { mod: 'module.cargo_container', count: 'fill', pack: true, wall: 'long' },
        { mod: 'module.storage_pallet', count: 'fill', pack: true },
      ],
    },
  ],
} as const satisfies RoomRecipe;

export const armoury = {
  fill: 0.6,
  arrangements: [
    {
      name: 'locker room', weight: 1, walkway: 'long', steps: [
        { mod: 'module.storage_locker', count: 'spec', wall: 'long', row: true },
        { mod: 'module.storage_rack', count: 'fill', wall: 'any', row: true },
      ],
    },
  ],
} as const satisfies RoomRecipe;

// Court vignettes (rooms/vignettes.ts): laid out at rotation 0 (a mess table runs east-west, fronts face south).
const chairs = (xs: readonly number[], y: number) => xs.map((x) => ({ mod: 'module.chair', x, y }));
/** A table for four. */
const bistro: Vignette = { name: 'bistro', mods: [{ mod: 'module.mess_table', x: 0, y: 0 }, ...chairs([0, 1], -1), ...chairs([0, 1], 1)] };
/** Two tables end to end, a long bench of eight. */
const longTable: Vignette = {
  name: 'long table', mods: [{ mod: 'module.mess_table', x: 0, y: 0 }, { mod: 'module.mess_table', x: 2, y: 0 }, ...chairs([0, 1, 2, 3], -1), ...chairs([0, 1, 2, 3], 1)],
};
/** A food stand: a galley counter with two tables in front of it. */
const foodStand: Vignette = {
  name: 'food stand', mods: [
    { mod: 'module.galley', x: 1, y: 0 },
    { mod: 'module.mess_table', x: -1, y: 2 }, ...chairs([-1, 0], 3),
    { mod: 'module.mess_table', x: 3, y: 2 }, ...chairs([3, 4], 3),
  ],
};
/** A market stall: a container (opened from the south) with pallets beside it and a locker. */
const stall: Vignette = {
  name: 'stall', mods: [{ mod: 'module.cargo_container', x: 0, y: 0 }, { mod: 'module.storage_pallet', x: 4, y: 0 }, { mod: 'module.storage_locker', x: -2, y: 1 }],
};
/** A pallet stall: two pallets and a crate. */
const pallets: Vignette = {
  name: 'pallets', mods: [{ mod: 'module.storage_pallet', x: 0, y: 0 }, { mod: 'module.storage_pallet', x: 3, y: 0 }, { mod: 'module.storage', x: 6, y: 1 }],
};
/** A lounge: two tables end-on with seats down both sides. */
const lounge: Vignette = {
  name: 'lounge', mods: [
    { mod: 'module.mess_table', x: 0, y: 0, rot: 1 }, { mod: 'module.mess_table', x: 4, y: 0, rot: 1 },
    ...chairs([1, 3], 0), ...chairs([1, 3], 1), ...chairs([-1, 5], 0),
  ],
};
/** An info kiosk: a console (crew stand at its front tile) and a locker beside it. */
const kiosk: Vignette = { name: 'kiosk', mods: [{ mod: 'module.console', x: 0, y: 0 }, { mod: 'module.storage_locker', x: 1, y: 0 }] };
/** A research bench out on the deck: a station and a console side by side, worked from the front. */
const labBench: Vignette = { name: 'lab bench', mods: [{ mod: 'module.research', x: 0, y: 0 }, { mod: 'module.console', x: 1, y: 0 }] };
/** A rack island: two racks back to back, a locker at the end. */
const rackIsland: Vignette = {
  name: 'rack island', mods: [{ mod: 'module.storage_rack', x: 0, y: 0 }, { mod: 'module.storage_rack', x: 0, y: -1, rot: 2 }, { mod: 'module.storage_locker', x: 2, y: 0 }],
};
/** A briefing corner: a console and a row of seats facing it. */
const briefing: Vignette = { name: 'briefing', mods: [{ mod: 'module.console', x: 0, y: 0 }, ...chairs([-1, 0, 1], 2), ...chairs([-1, 0, 1], 3)] };

/** A grove: a tree bed with a bench on two sides and a potted shrub. */
const grove: Vignette = {
  name: 'grove', mods: [
    { mod: 'module.planter_large', x: 0, y: 0 }, { mod: 'module.bench', x: 0, y: 3 }, { mod: 'module.bench', x: 0, y: -2 },
    { mod: 'module.planter', x: 3, y: 1 },
  ],
};
/** A bench between two potted shrubs. */
const benchPots: Vignette = {
  name: 'bench and pots', mods: [{ mod: 'module.planter', x: -1, y: 0 }, { mod: 'module.bench', x: 0, y: 0 }, { mod: 'module.planter', x: 2, y: 0 }],
};
/** An arboretum: four tree beds round a brass inlay, benches between the beds on two sides. */
const arboretum: Vignette = {
  name: 'arboretum', mods: [
    { mod: 'module.planter_large', x: 0, y: 0 }, { mod: 'module.planter_large', x: 5, y: 0 },
    { mod: 'module.planter_large', x: 0, y: 5 }, { mod: 'module.planter_large', x: 5, y: 5 },
    { mod: 'module.bench', x: 2, y: 0 }, { mod: 'module.bench', x: 3, y: 6 }, { mod: 'module.deck_inlay', x: 3, y: 3 },
    { mod: 'module.planter', x: 0, y: 3 }, { mod: 'module.planter', x: 6, y: 3 },
  ],
};

/** Landmarks, set at the middle of a big court (rooms/vignettes.ts). A bazaar: four stalls round a table. */
const bazaar: Vignette = {
  name: 'bazaar', mods: [
    { mod: 'module.cargo_container', x: 0, y: 0 }, { mod: 'module.cargo_container', x: 6, y: 0 },
    { mod: 'module.cargo_container', x: 0, y: 5, rot: 2 }, { mod: 'module.cargo_container', x: 6, y: 5, rot: 2 },
    { mod: 'module.mess_table', x: 3, y: 3 }, ...chairs([3, 4], 2), ...chairs([3, 4], 4),
    { mod: 'module.planter', x: -2, y: 3 }, { mod: 'module.planter', x: 10, y: 3 }, { mod: 'module.deck_inlay', x: 4, y: 0 },
  ],
};
/** A parade: three racks in a row, a briefing console with seats in front of it. */
const parade: Vignette = {
  name: 'parade', mods: [
    { mod: 'module.storage_rack', x: 0, y: 0 }, { mod: 'module.storage_rack', x: 3, y: 0 }, { mod: 'module.storage_rack', x: 6, y: 0 },
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((x) => ({ mod: 'module.deck_hazard', x, y: 2 })),
    { mod: 'module.console', x: 4, y: 3 }, ...chairs([2, 3, 4, 5, 6], 5), ...chairs([2, 3, 4, 5, 6], 6),
  ],
};
/** A lab cluster: two benches of research stations and consoles back to back, a locker at each end. */
const labCluster: Vignette = {
  name: 'lab cluster', mods: [
    { mod: 'module.research', x: 0, y: 0 }, { mod: 'module.console', x: 1, y: 0 }, { mod: 'module.research', x: 2, y: 0 },
    { mod: 'module.console', x: 0, y: -1, rot: 2 }, { mod: 'module.research', x: 1, y: -1, rot: 2 }, { mod: 'module.console', x: 2, y: -1, rot: 2 },
    { mod: 'module.storage_locker', x: 4, y: 0 }, { mod: 'module.storage_locker', x: -2, y: -1, rot: 2 },
  ],
};

/** Concourse (trading courtyards): market stalls and tables in groups round open floor, not a lattice of one table. */
export const plaza = {
  fill: 0.12,
  arrangements: [
    {
      name: 'market', weight: 2, walkway: 'long',
      vignettes: { pieces: [stall, stall, stall, pallets, pallets, bistro, foodStand, kiosk, grove, benchPots], gap: 8, upTo: 0.12, centre: bazaar },
      steps: [
        { mod: 'module.hydroponics', count: 4, wall: 'any' },
      ],
    },
    {
      name: 'food court', weight: 1,
      vignettes: { pieces: [foodStand, foodStand, longTable, bistro, lounge, stall, pallets, kiosk, grove, benchPots], gap: 7, upTo: 0.12, centre: bazaar },
      steps: [
        { mod: 'module.storage_locker', count: 4, wall: 'any' },
      ],
    },
  ],
} as const satisfies RoomRecipe;

/** Garden deck (research courtyards): tree beds and groves round an arboretum, lab benches and lounges among them. */
export const garden = {
  fill: 0.18,
  arrangements: [
    {
      name: 'garden', weight: 1,
      vignettes: { pieces: [grove, grove, benchPots, labBench, labCluster, kiosk, lounge], gap: 8, upTo: 0.12, centre: arboretum },
      steps: [
        { mod: 'module.hydroponics', count: 'fill', upTo: 0.16, clear: 1, grid: [3, 3], rots: [0] },
      ],
    },
  ],
} as const satisfies RoomRecipe;

/** Drill hall (military courtyards): open floor, racks and lockers on the walls, a few rack islands and briefing corners. */
export const drill = {
  fill: 0.06,
  arrangements: [
    {
      name: 'drill hall', weight: 1,
      vignettes: { pieces: [rackIsland, briefing], gap: 10, upTo: 0.04, centre: parade },
      steps: [
        { mod: 'module.storage_rack', count: 'fill', wall: 'any', row: true },
        { mod: 'module.storage_locker', count: 6, wall: 'any', row: true },
      ],
    },
  ],
} as const satisfies RoomRecipe;

/**
 * Station hangar decks (and station hangars): the shuttle bays out on the open floor, toward the middle and spaced on a
 * lattice so crew can walk round each pit; racks and lockers along the walls.
 */
export const hangarDeck = {
  fill: 0.2,
  arrangements: [
    {
      name: 'deck', weight: 1, steps: [
        { mod: 'module.vehicle_bay', count: 'spec', centre: 'xy', clear: 2, grid: [7, 8] },
        { mod: 'module.deck_hazard', count: 10, near: 'module.vehicle_bay', row: true },
        { mod: 'module.storage_rack', count: 'fill', wall: 'long', row: true },
        { mod: 'module.storage_locker', count: 'fill', wall: 'any', row: true },
      ],
    },
  ],
} as const satisfies RoomRecipe;
