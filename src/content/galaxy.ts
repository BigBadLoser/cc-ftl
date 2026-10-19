import type { GalaxyContent, GalaxyFactionDef, StructureDef } from '../sim';

/**
 * Galaxy factions: who holds space, how they feel about you and each other, and which ship generator styles
 * (content/factions, `faction.*`) build their ships. The id is the `sim.story.reputation` key events use.
 * Generator mapping: navy and the corporations fly navy (corporate) hulls, haulers and traders the civilian kit,
 * the scrapper clans are the pirates, the drones are the rogue AI.
 */
const factions = {
  navy: {
    name: 'Concord Navy', kind: 'government', color: '#5b8def', home: true,
    ships: [{ value: 'faction.navy', weight: 1 }],
    territory: { weight: 2.2, danger: { max: 4 }, reach: 820 },
    stations: [{ value: 'structure.station_military', weight: 3 }, { value: 'structure.station_trade', weight: 1 }],
    baseStanding: 1,
    relations: { pirates: -0.6, rogue: -0.5, meridian: 0.3, helix: 0.2, vantor: 0.2 },
    traffic: { weight: 1, danger: { max: 5 } },
  },
  meridian: {
    name: 'Meridian Combine', kind: 'corporation', color: '#f0b429',
    ships: [{ value: 'faction.navy', weight: 2 }, { value: 'faction.civilian', weight: 1 }],
    territory: { weight: 1.6, danger: { min: 1, max: 7 } },
    stations: [{ value: 'structure.station_trade', weight: 3 }, { value: 'structure.station_research', weight: 1 }],
    baseStanding: 0,
    relations: { navy: 0.3, helix: -0.4, vantor: -0.2, pirates: -0.4 },
    traffic: { weight: 0.8, danger: { max: 7 } },
  },
  helix: {
    name: 'Helix Biosystems', kind: 'corporation', color: '#2dd4bf',
    ships: [{ value: 'faction.navy', weight: 1 }, { value: 'faction.civilian', weight: 1 }],
    territory: { weight: 1.1, danger: { min: 2, max: 8 } },
    stations: [{ value: 'structure.station_research', weight: 3 }, { value: 'structure.station_trade', weight: 1 }],
    baseStanding: 0,
    relations: { meridian: -0.4, navy: 0.2, rogue: -0.3 },
    traffic: { weight: 0.5, danger: { min: 1 } },
  },
  vantor: {
    name: 'Vantor Heavy Industries', kind: 'corporation', color: '#fb7a3c',
    ships: [{ value: 'faction.civilian', weight: 2 }, { value: 'faction.navy', weight: 1 }],
    territory: { weight: 1.2, danger: { min: 1, max: 9 } },
    stations: [{ value: 'structure.station_trade', weight: 2 }, { value: 'structure.station_military', weight: 1 }],
    baseStanding: 0,
    relations: { meridian: -0.2, traders: 0.2, pirates: -0.3 },
    traffic: { weight: 0.6, danger: { min: 1 } },
  },
  traders: {
    name: 'Free Traders', kind: 'civilian', color: '#4ade80',
    ships: [{ value: 'faction.civilian', weight: 1 }],
    baseStanding: 2,
    relations: { pirates: -0.3, vantor: 0.2 },
    traffic: { weight: 2, danger: { max: 7 } },
  },
  pirates: {
    name: 'Scrapper Clans', kind: 'pirates', color: '#ef4444',
    ships: [{ value: 'faction.scrapper', weight: 1 }],
    territory: { weight: 1.4, danger: { min: 3 }, reach: 680 },
    stations: [{ value: 'structure.station_trade', weight: 1 }],
    baseStanding: -5,
    relations: { navy: -0.5, traders: -0.3 },
    traffic: { weight: 1.6, danger: { min: 1 } },
  },
  rogue: {
    name: 'Rogue AI', kind: 'rogue', color: '#e879f9', combatFaction: 'rogue', alwaysHostile: true,
    ships: [{ value: 'faction.drones', weight: 1 }],
    territory: { weight: 1, danger: { min: 5 }, reach: 640 },
    baseStanding: -10,
    traffic: { weight: 0.9, danger: { min: 4 } },
  },
} satisfies Record<string, GalaxyFactionDef>;

/** Fixed structures a node can hold. Descriptors only until node grids can place them (sector refactor). */
const structures = {
  'structure.asteroids': { name: 'Asteroid field', kind: 'asteroids', badge: 'A', resources: ['item.metal', 'item.ice'], chance: 0.3 },
  'structure.station_trade': { name: 'Trade station', kind: 'station', station: 'trade', badge: 'T', resources: ['item.fuel'], services: ['fuel', 'trade', 'repair'] },
  'structure.station_military': { name: 'Military station', kind: 'station', station: 'military', badge: 'M', resources: [], services: ['fuel', 'repair', 'recruit'] },
  'structure.station_research': { name: 'Research station', kind: 'station', station: 'research', badge: 'R', resources: ['item.electronics'], services: ['trade'] },
  'structure.derelict': { name: 'Old derelict', kind: 'derelict', badge: 'D', resources: ['item.scrap', 'item.parts', 'item.electronics'], chance: 0.05, perDanger: 0.012 },
} satisfies Record<string, StructureDef>;

const names = {
  prefix: [
    'Kessa', 'Orrin', 'Vale', 'Tamsin', 'Corva', 'Ithra', 'Maro', 'Selk', 'Dunmar', 'Avern', 'Hollis', 'Tycho', 'Brann',
    'Ostra', 'Quill', 'Rhee', 'Sabel', 'Teneb', 'Ulric', 'Vesta', 'Wren', 'Yorik', 'Zane', 'Amari', 'Calder', 'Daska',
    'Emberg', 'Farro', 'Garn', 'Halcy', 'Isen', 'Jarro', 'Kord', 'Lumen', 'Mirel', 'Nadir', 'Oskar', 'Pell', 'Ravel', 'Sorrow',
    'Acheron', 'Bastia', 'Cygna', 'Dorado', 'Elara', 'Fenix', 'Gorran', 'Hesper', 'Ilium', 'Joval', 'Kepler', 'Lyra', 'Morrow',
    'Nereid', 'Orpha', 'Pyxis', 'Rigel', 'Sarn', 'Thule', 'Umbra', 'Vigil', 'Wolfe', 'Xantho', 'Ysolde', 'Zephra', 'Arden',
    'Belcar', 'Cirrus', 'Draven', 'Eskar', 'Fallow', 'Grist', 'Harrow', 'Iolo', 'Kestrel', 'Lantern', 'Mosk', 'Novak',
  ],
  suffix: ['Reach', 'Expanse', 'Drift', 'Verge', 'Hollow', 'Spur', 'Gate', 'Shoals', 'March', 'Deep', 'Cluster', 'Belt'],
};

export const galaxy = { factions, structures, names } satisfies GalaxyContent;
