import type { TradeDef } from '../sim';
import { pirateTraders, pirateTradeFactions } from './tradePirates';

/**
 * Trade content. Prices live on the items (`ItemDef.price`, credits); this file holds the spread, how each faction treats the
 * player, and the trader kinds (ship roles and station kinds) with their wallets, stock and price tilts.
 * Terminology: a node is one playable location, a sector is a group of nodes.
 *
 * Price of one unit = base x spread x faction x trader kind x item tag mods x reputation (see sim/trade/pricing.ts).
 * A trader SELLS at base x 1.25 and BUYS at base x 0.6 before modifiers, so a round trip always loses credits.
 *
 * The faction table is a stand-in for the proper faction system: a ship answers a hail when its faction's `relation` plus the
 * kind's `relation` plus the player's reputation with `reputation` (sim.story.reputation) is at least 0.
 */
export const trade = {
  startCredits: 500,
  spread: { sell: 1.25, buy: 0.6 },
  repStep: 0.03,
  repMax: 0.25,
  exchangeSec: 3,
  factions: {
    'faction.civilian': { name: 'Civilian', reputation: 'traders', relation: 2 },
    // Placeholders until the faction system: the corp (no ships yet), the navy and the pirates (scrappers).
    'faction.corp': { name: 'Corporation', reputation: 'corp', relation: 1, sell: 1.15, buy: 1.1 },
    'faction.navy': { name: 'Navy', reputation: 'navy', relation: 0, sell: 1.1, buy: 0.95 },
    'faction.scrapper': { name: 'Scrappers', reputation: 'pirates', relation: -2, sell: 1.3, buy: 0.8 },
    ...pirateTradeFactions,
    'faction.drones': { name: 'Drones', reputation: 'drones', relation: -9 },
    // Ships spawned from plain templates (no generator faction) trade by their combat side.
    'side.neutral': { name: 'Neutral', reputation: 'traders', relation: 1 },
    'side.hostile': { name: 'Raiders', reputation: 'pirates', relation: -2, sell: 1.3, buy: 0.8 },
    'side.rogue': { name: 'Rogue AI', reputation: 'rogue', relation: -9 },
    // Generated stations (src/content/stations.ts) trade under their kind.
    'station.trading': { name: 'Trade station', reputation: 'traders', relation: 2 },
    'station.mining': { name: 'Mining station', reputation: 'traders', relation: 2 },
    'station.farming': { name: 'Agri station', reputation: 'traders', relation: 2 },
    'station.research': { name: 'Research station', reputation: 'traders', relation: 2 },
    'station.military': { name: 'Navy depot', reputation: 'navy', relation: 0, sell: 1.1, buy: 0.95 },
    'station.pirate': { name: 'Pirate den', reputation: 'pirates', relation: -2, sell: 1.3, buy: 0.8 },
  },
  traders: {
    // --- Civilian roles (the generator's hull families) ---
    'trader.freighter': {
      name: 'Freighter', match: { faction: 'faction.civilian', role: 'freighter' }, shuttle: true, sell: 0.92, buy: 0.95,
      tagMods: { raw: { sell: 0.9 }, refined: { sell: 0.95 } }, credits: [300, 900],
      stock: [
        { item: 'item.metal', min: 20, max: 60 }, { item: 'item.scrap_hull', min: 10, max: 40 }, { item: 'item.polymer', min: 8, max: 30 },
        { item: 'item.electronics', min: 4, max: 14 }, { item: 'item.ration', min: 6, max: 24, chance: 0.8 }, { item: 'item.parts', min: 2, max: 10, chance: 0.5 },
      ],
    },
    'trader.liner': {
      name: 'Liner', match: { faction: 'faction.civilian', role: 'liner' }, shuttle: true, sell: 1.05, buy: 1,
      tagMods: { food: { sell: 0.9, buy: 1.25 }, weapon: { sell: 1.3, buy: 0.5 } }, credits: [500, 1400],
      stock: [
        { item: 'item.ration', min: 15, max: 45 }, { item: 'item.electronics', min: 3, max: 10 }, { item: 'item.ice', min: 5, max: 20, chance: 0.6 },
        { item: 'item.sidearm', min: 1, max: 3, chance: 0.4 },
      ],
    },
    'trader.mining': {
      name: 'Mining ship', match: { faction: 'faction.civilian', role: 'mining' }, shuttle: false, sell: 0.9, buy: 1,
      tagMods: { raw: { sell: 0.8 }, components: { buy: 1.25 } }, credits: [200, 700],
      stock: [
        { item: 'item.ice', min: 20, max: 70 }, { item: 'item.scrap_hull', min: 20, max: 80 }, { item: 'item.metal', min: 15, max: 50 },
        { item: 'item.iron_ore', min: 20, max: 80 }, { item: 'item.rare_ore', min: 2, max: 12, chance: 0.6 },
        { item: 'item.parts', min: 0, max: 6, chance: 0.4 },
      ],
    },
    // Stations by kind. They have no shuttle: the player's shuttle flies every run. Depots sell no hand weapons.
    'trader.station.trading': {
      name: 'Trade station', match: { faction: 'station.trading' }, shuttle: false, credits: [2000, 6000],
      stock: [
        { item: 'item.metal', min: 40, max: 120 }, { item: 'item.electronics', min: 15, max: 40 }, { item: 'item.polymer', min: 15, max: 50 },
        { item: 'item.parts', min: 8, max: 25 }, { item: 'item.ration', min: 30, max: 80 }, { item: 'item.ice', min: 10, max: 40 },
        { item: 'item.missile', min: 4, max: 16, chance: 0.7 }, { item: 'item.sidearm', min: 1, max: 4, chance: 0.6 },
        { item: 'item.rifle', min: 1, max: 2, chance: 0.35 }, { item: 'item.shuttle', min: 1, max: 1, chance: 0.2 },
        { item: 'item.fuel', min: 40, max: 90 },
        // Ore and life-support stores the station's industry and habitat eat (galaxyMarket.ts): small, so it pays more as they run low.
        { item: 'item.iron_ore', min: 10, max: 40 }, { item: 'item.rare_ore', min: 2, max: 8 }, { item: 'item.water', min: 5, max: 20 }, { item: 'item.oxygen', min: 5, max: 20 },
      ],
    },
    'trader.station.mining': {
      // Ore is cheap where it is dug; parts and electronics are dear out on the rocks (issue #222).
      name: 'Mining station', match: { faction: 'station.mining' }, shuttle: false, sell: 0.9, credits: [1200, 3500],
      tagMods: { ore: { sell: 0.8, buy: 0.85 }, components: { buy: 1.3 } },
      stock: [{ item: 'item.metal', min: 80, max: 200 }, { item: 'item.ice', min: 40, max: 120 }, { item: 'item.scrap_hull', min: 20, max: 80 }, { item: 'item.parts', min: 4, max: 12 },
        { item: 'item.iron_ore', min: 60, max: 180 }, { item: 'item.rare_ore', min: 6, max: 24 }, { item: 'item.fuel', min: 20, max: 60 }],
    },
    'trader.station.farming': {
      name: 'Agri station', match: { faction: 'station.farming' }, shuttle: false, credits: [800, 2500],
      stock: [{ item: 'item.ration', min: 60, max: 180 }, { item: 'item.polymer', min: 10, max: 40 }, { item: 'item.ice', min: 10, max: 30 }, { item: 'item.fuel', min: 15, max: 40 }, { item: 'item.water', min: 20, max: 60 }],
    },
    'trader.station.research': {
      name: 'Research station', match: { faction: 'station.research' }, shuttle: false, credits: [1500, 4000],
      stock: [
        { item: 'item.electronics', min: 30, max: 80 }, { item: 'item.parts', min: 10, max: 30 }, { item: 'item.polymer', min: 15, max: 45 },
        { item: 'item.metal', min: 15, max: 50 }, { item: 'item.ration', min: 15, max: 40 }, { item: 'item.fuel', min: 20, max: 50 },
      ],
    },
    'trader.station.military': {
      // Military surplus: older, middle-grade hand weapons (tiers 1-2, never the best) at a modest markup; it still buys.
      name: 'Depot quartermaster', match: { faction: 'station.military' }, shuttle: false, credits: [1500, 4000],
      surplus: { tag: 'weapon', maxTier: 2, min: 2, max: 8, markup: 1.1 },
      stock: [{ item: 'item.missile', min: 10, max: 30 }, { item: 'item.parts', min: 10, max: 30 }, { item: 'item.electronics', min: 10, max: 30 }, { item: 'item.metal', min: 20, max: 60 }, { item: 'item.fuel', min: 20, max: 50 }],
    },
    'trader.station.pirate': {
      name: 'Den fence', match: { faction: 'station.pirate' }, shuttle: false, tagMods: { weapon: { sell: 0.85 }, scrap: { buy: 1.2 } }, credits: [300, 1200],
      stock: [
        { item: 'item.scrap_hull', min: 30, max: 100 }, { item: 'item.parts', min: 5, max: 15 }, { item: 'item.ion_pistol', min: 1, max: 4, chance: 0.7 },
        { item: 'item.blade', min: 2, max: 6 }, { item: 'item.rifle', min: 1, max: 3, chance: 0.5 }, { item: 'item.missile', min: 2, max: 10, chance: 0.5 },
      ],
    },
    'trader.station': {
      name: 'Station', match: { faction: 'faction.civilian', role: 'station' }, shuttle: false, credits: [1500, 4000],
      stock: [
        { item: 'item.metal', min: 30, max: 90 }, { item: 'item.electronics', min: 10, max: 30 }, { item: 'item.polymer', min: 10, max: 40 },
        { item: 'item.parts', min: 5, max: 20 }, { item: 'item.ration', min: 20, max: 60 }, { item: 'item.ice', min: 10, max: 40 },
        { item: 'item.missile', min: 4, max: 16, chance: 0.7 }, { item: 'item.sidearm', min: 1, max: 4, chance: 0.6 },
        { item: 'item.rifle', min: 1, max: 2, chance: 0.35 }, { item: 'item.shuttle', min: 1, max: 1, chance: 0.15 },
        { item: 'item.fuel', min: 30, max: 70 },
      ],
    },
    // --- Placeholders until the faction system: corp, navy, pirates ---
    'trader.corp': {
      name: 'Corporate trader', match: { faction: 'faction.corp' }, shuttle: true, sell: 1.1, credits: [1000, 3000],
      stock: [{ item: 'item.electronics', min: 10, max: 30 }, { item: 'item.parts', min: 5, max: 15 }, { item: 'item.rifle', min: 1, max: 3, chance: 0.5 }],
    },
    'trader.navy': {
      name: 'Navy quartermaster', match: { faction: 'faction.navy' }, shuttle: true, tagMods: { ammo: { buy: 1.3 } }, credits: [800, 2200],
      stock: [
        { item: 'item.missile', min: 6, max: 20 }, { item: 'item.rifle', min: 1, max: 4 }, { item: 'item.sidearm', min: 2, max: 6 },
        { item: 'item.ration', min: 15, max: 40 }, { item: 'item.metal', min: 10, max: 30 },
      ],
    },
    'trader.pirate': {
      name: 'Pirate fence', match: { faction: 'faction.scrapper' }, shuttle: false, tagMods: { weapon: { sell: 0.85 }, scrap: { buy: 1.2 } }, credits: [100, 600],
      stock: [
        { item: 'item.scrap_hull', min: 20, max: 80 }, { item: 'item.parts', min: 3, max: 12 }, { item: 'item.ion_pistol', min: 1, max: 3, chance: 0.6 },
        { item: 'item.blade', min: 1, max: 4, chance: 0.6 }, { item: 'item.missile', min: 2, max: 10, chance: 0.5 },
      ],
    },
    ...pirateTraders,
    // Ships from plain templates (raiders and the like) fall back to their side.
    'trader.raider': {
      name: 'Raider', match: { side: 'hostile' }, shuttle: false, credits: [50, 300],
      stock: [{ item: 'item.scrap_hull', min: 10, max: 40 }, { item: 'item.sidearm', min: 0, max: 2, chance: 0.5 }],
    },
  },
} satisfies TradeDef;
