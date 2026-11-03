import type { GalaxyContent, GalaxyFactionDef, StructureDef } from '../sim';
import { factionFleets, fleetContent } from './galaxyFleets';
import { market } from './galaxyMarket';
import { relations } from './galaxyRelations';

/**
 * Galaxy factions: who holds space, how they feel about you and each other, and which ship generator styles
 * (content/factions, `faction.*`) build their ships. This is the one faction table: each def names the reputation key
 * (`sim.story.reputation`) it is tracked under, one per faction (so the three corporations and any pirate faction each have their own
 * standing). Who is at war with whom, and who shares standing, is the pairwise table in galaxyRelations.ts. `specialities` weight what the
 * faction's stations stock (DESIGN.md "Faction specialities"). Trade's prices and hailing read the station's or ship's owner key.
 * Generator mapping: navy and the corporations fly navy (corporate) hulls, haulers and traders the civilian kit,
 * the scrapper clans and the raider, cartel, zealot and mercenary factions are the pirates (each with its own generator style), the drones are the rogue AI.
 */
const factions = {
  navy: {
    name: 'Concord Navy', kind: 'government', reputation: 'navy', home: true,
    ships: [{ value: 'faction.navy', weight: 1 }],
    territory: { weight: 2.2, danger: { max: 4 }, reach: 820 },
    stations: [{ value: 'structure.station_military', weight: 3 }, { value: 'structure.station_trade', weight: 1 }],
    baseStanding: 1,
    // Weapons and shields; the best of them are for friends (Mk II from a neutral standing, Mk III from friendly).
    specialities: { blueprints: ['defence'], stock: { weapon: 1.5, ammo: 1.5 }, gate: { defence: { 2: 0, 3: 3 } } },
    fleet: factionFleets.navy,
    traffic: { weight: 1, danger: { max: 5 } },
  },
  meridian: {
    name: 'Meridian Combine', kind: 'corporation', reputation: 'meridian',
    ships: [{ value: 'faction.navy', weight: 2 }, { value: 'faction.civilian', weight: 1 }],
    territory: { weight: 1.6, danger: { min: 1, max: 7 } },
    stations: [{ value: 'structure.station_trade', weight: 3 }, { value: 'structure.station_research', weight: 1 }],
    baseStanding: 0,
    // Storage, cargo, vehicles and fuel, and fuel for less.
    specialities: { blueprints: ['storage'], stock: { cargo: 1.5, vehicle: 1.5, fuel: 1.3 }, prices: { fuel: 0.85 } },
    fleet: factionFleets.meridian,
    traffic: { weight: 0.8, danger: { max: 7 } },
  },
  helix: {
    name: 'Helix Biosystems', kind: 'corporation', reputation: 'helix',
    ships: [{ value: 'faction.navy', weight: 1 }, { value: 'faction.civilian', weight: 1 }],
    territory: { weight: 1.1, danger: { min: 2, max: 8 } },
    stations: [{ value: 'structure.station_research', weight: 3 }, { value: 'structure.station_trade', weight: 1 }],
    baseStanding: 0,
    // Medical, life support and farming.
    specialities: { blueprints: ['life'], stock: { food: 1.4, water: 1.3 } },
    fleet: factionFleets.helix,
    traffic: { weight: 0.5, danger: { min: 1 } },
  },
  vantor: {
    name: 'Vantor Heavy Industries', kind: 'corporation', reputation: 'vantor',
    ships: [{ value: 'faction.civilian', weight: 2 }, { value: 'faction.navy', weight: 1 }],
    territory: { weight: 1.2, danger: { min: 1, max: 9 } },
    stations: [{ value: 'structure.station_trade', weight: 2 }, { value: 'structure.station_military', weight: 1 }],
    baseStanding: 0,
    // Power, engines and industry, and the best shipyards.
    // TODO(#125): the shipyard service reads `shipyard` (bigger caps, cheaper per tile); the numbers are provisional.
    specialities: { blueprints: ['power', 'systems', 'production'], stock: { refined: 1.4, components: 1.4 }, shipyard: { capMult: 1.5, tilePrice: 0.85 } },
    fleet: factionFleets.vantor,
    traffic: { weight: 0.6, danger: { min: 1 } },
  },
  traders: {
    name: 'Free Traders', kind: 'civilian', reputation: 'traders',
    ships: [{ value: 'faction.civilian', weight: 1 }],
    baseStanding: 2,
    fleet: factionFleets.traders,
    traffic: { weight: 2, danger: { max: 7 } },
  },
  pirates: {
    name: 'Scrapper Clans', kind: 'pirates', reputation: 'pirates',
    ships: [{ value: 'faction.scrapper', weight: 1 }],
    territory: { weight: 1.4, danger: { min: 3 }, reach: 680 },
    stations: [{ value: 'structure.station_trade', weight: 1 }],
    baseStanding: -5,
    fleet: factionFleets.pirates,
    traffic: { weight: 1.6, danger: { min: 1 } },
  },
  // --- Phase 2b pirate factions (DESIGN.md "Pirate factions and the black market"). Their dens use the pirate den placeholder (station generation is the shipgen
  // session's); their ships are the scrapper hulls told apart by loadout (content/factions/pirates.ts). Numbers are provisional. ---
  raiders: {
    name: 'Raider Clans', kind: 'pirates', reputation: 'raiders',
    ships: [{ value: 'faction.raider', weight: 1 }],
    territory: { weight: 0.7, danger: { min: 3 }, reach: 620, shares: 'pirates' },
    stations: [{ value: 'structure.station_trade', weight: 1 }],
    baseStanding: -5,
    fleet: factionFleets.raiders,
    traffic: { weight: 1.2, danger: { min: 2 } },
  },
  cartel: {
    name: 'The Cartel', kind: 'pirates', reputation: 'cartel', guardsRoutes: true,
    ships: [{ value: 'faction.cartel', weight: 1 }],
    territory: { weight: 0.7, danger: { min: 3 }, reach: 700, shares: 'pirates' },
    stations: [{ value: 'structure.station_trade', weight: 1 }],
    // Just under the hostile line (HOSTILE_BELOW): one favour makes them neutral.
    baseStanding: -2.5,
    fleet: factionFleets.cartel,
    traffic: { weight: 0.8, danger: { min: 1 } },
  },
  zealots: {
    name: 'Zealots of the Signal', kind: 'pirates', reputation: 'zealots', combatFaction: 'rogue',
    ships: [{ value: 'faction.zealot', weight: 1 }],
    // Niche: their space only grows beside the machines'. A fifth of machine seeds give them one neighbouring cell (a chance, not a weight).
    territory: { weight: 0.2, danger: { min: 4 }, reach: 560, near: 'rogue', max: 1 },
    stations: [{ value: 'structure.station_trade', weight: 1 }],
    baseStanding: -4,
    fleet: factionFleets.zealots,
    traffic: { weight: 0.3, danger: { min: 4 } },
  },
  mercenaries: {
    name: 'Free Lances', kind: 'pirates', reputation: 'mercenaries',
    ships: [{ value: 'faction.mercenary', weight: 1 }],
    territory: { weight: 0.15, danger: { min: 3 }, reach: 520, shares: 'pirates' },
    stations: [{ value: 'structure.station_trade', weight: 1 }],
    baseStanding: 0,
    fleet: factionFleets.mercenaries,
    traffic: { weight: 0.5, danger: { min: 2 } },
  },
  rogue: {
    name: 'Rogue AI', kind: 'rogue', reputation: 'drones', combatFaction: 'rogue', alwaysHostile: true,
    ships: [{ value: 'faction.drones', weight: 1 }],
    territory: { weight: 1, danger: { min: 5 }, reach: 640 },
    baseStanding: -10,
    fleet: factionFleets.rogue,
    traffic: { weight: 0.9, danger: { min: 4 } },
  },
} satisfies Record<string, GalaxyFactionDef>;

/** Fixed structures a node can hold. Descriptors only until node grids can place them (sector refactor). */
const structures = {
  'structure.asteroids': { name: 'Asteroid field', kind: 'asteroids', badge: 'A', resources: ['item.metal', 'item.ice'], chance: 0.3 },
  'structure.station_trade': { name: 'Trade station', kind: 'station', station: 'trade', badge: 'T', resources: ['item.fuel'], services: ['fuel', 'trade', 'repair', 'recruit'] },
  'structure.station_military': { name: 'Military station', kind: 'station', station: 'military', badge: 'M', resources: [], services: ['fuel', 'repair', 'blueprints'] },
  'structure.station_research': { name: 'Research station', kind: 'station', station: 'research', badge: 'R', resources: ['item.electronics'], services: ['trade', 'blueprints'], chance: 0.1, perDanger: -0.01 },
  'structure.derelict': { name: 'Old derelict', kind: 'derelict', badge: 'D', resources: ['item.scrap_hull', 'item.scrap_tech', 'item.scrap_energy', 'item.parts'], chance: 0.05, perDanger: 0.012 },
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
  suffix: ['Reach', 'Expanse', 'Drift', 'Verge', 'Hollow', 'Spur', 'Gate', 'Shoals', 'March', 'Deep', 'Rim', 'Belt'],
};

export const galaxy = { factions, relations, structures, names, fleet: fleetContent, market } satisfies GalaxyContent;
