import type { TradeDef } from '../sim';

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
    'faction.drones': { name: 'Drones', reputation: 'drones', relation: -9 },
    // Ships spawned from plain templates (no generator faction) trade by their combat side.
    'side.neutral': { name: 'Neutral', reputation: 'traders', relation: 1 },
    'side.hostile': { name: 'Raiders', reputation: 'pirates', relation: -2, sell: 1.3, buy: 0.8 },
    'side.rogue': { name: 'Rogue AI', reputation: 'rogue', relation: -9 },
  },
  traders: {
    // --- Civilian roles (the generator's hull families) ---
    'trader.freighter': {
      name: 'Freighter', match: { faction: 'faction.civilian', role: 'freighter' }, shuttle: true, sell: 0.92, buy: 0.95,
      tagMods: { raw: { sell: 0.9 }, refined: { sell: 0.95 } }, credits: [300, 900],
      stock: [
        { item: 'item.metal', min: 20, max: 60 }, { item: 'item.scrap', min: 10, max: 40 }, { item: 'item.polymer', min: 8, max: 30 },
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
        { item: 'item.ice', min: 20, max: 70 }, { item: 'item.scrap', min: 20, max: 80 }, { item: 'item.metal', min: 15, max: 50 },
        { item: 'item.parts', min: 0, max: 6, chance: 0.4 },
      ],
    },
    'trader.station': {
      name: 'Station', match: { faction: 'faction.civilian', role: 'station' }, shuttle: false, credits: [1500, 4000],
      stock: [
        { item: 'item.metal', min: 30, max: 90 }, { item: 'item.electronics', min: 10, max: 30 }, { item: 'item.polymer', min: 10, max: 40 },
        { item: 'item.parts', min: 5, max: 20 }, { item: 'item.ration', min: 20, max: 60 }, { item: 'item.ice', min: 10, max: 40 },
        { item: 'item.missile', min: 4, max: 16, chance: 0.7 }, { item: 'item.sidearm', min: 1, max: 4, chance: 0.6 },
        { item: 'item.rifle', min: 1, max: 2, chance: 0.35 }, { item: 'item.shuttle', min: 1, max: 1, chance: 0.15 },
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
      name: 'Pirate fence', match: { faction: 'faction.scrapper' }, shuttle: false, tagMods: { weapon: { sell: 0.85 }, salvage: { buy: 1.2 } }, credits: [100, 600],
      stock: [
        { item: 'item.scrap', min: 20, max: 80 }, { item: 'item.parts', min: 3, max: 12 }, { item: 'item.ion_pistol', min: 1, max: 3, chance: 0.6 },
        { item: 'item.blade', min: 1, max: 4, chance: 0.6 }, { item: 'item.missile', min: 2, max: 10, chance: 0.5 },
      ],
    },
    // Ships from plain templates (raiders and the like) fall back to their side.
    'trader.raider': {
      name: 'Raider', match: { side: 'hostile' }, shuttle: false, credits: [50, 300],
      stock: [{ item: 'item.scrap', min: 10, max: 40 }, { item: 'item.sidearm', min: 0, max: 2, chance: 0.5 }],
    },
  },
} satisfies TradeDef;
