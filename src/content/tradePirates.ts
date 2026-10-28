import type { TradeDef } from '../sim';

/**
 * Trade stances and trader kinds of the pirate factions beyond the Scrappers (phase 2b), merged into `trade` (content/trade.ts). A ship answers a hail when
 * its faction's `relation` plus the player's standing key reaches 0 (sim/trade/traders.ts `hailVerdict`):
 * - raiders want 4 reputation first (they barely talk), the cartel 1, the zealots 3 (or enough heavily augmented crew, `augmentBonus`: a stub until implants, phase 7);
 * - mercenaries talk to anyone.
 * Prices are provisional.
 */
export const pirateTradeFactions = {
  'faction.raider': { name: 'Raider clan', reputation: 'raiders', relation: -4, sell: 1.3, buy: 0.8 },
  'faction.cartel': { name: 'Cartel', reputation: 'cartel', relation: -1, sell: 1.1, buy: 0.9 },
  'faction.zealot': { name: 'Zealots', reputation: 'zealots', relation: -3, augmentBonus: 1, sell: 1.2, buy: 0.9 },
  'faction.mercenary': { name: 'Mercenaries', reputation: 'mercenaries', relation: 0, sell: 1.2, buy: 1 },
} as const satisfies TradeDef['factions'];

export const pirateTraders = {
  'trader.raider_clan': {
    name: 'Raider clan', match: { faction: 'faction.raider' }, shuttle: false, tagMods: { weapon: { sell: 0.85 } }, credits: [80, 400],
    stock: [{ item: 'item.scrap', min: 10, max: 40 }, { item: 'item.blade', min: 1, max: 4, chance: 0.7 }, { item: 'item.sidearm', min: 0, max: 3, chance: 0.5 }],
  },
  'trader.cartel': {
    name: 'Cartel hauler', match: { faction: 'faction.cartel' }, shuttle: false, credits: [600, 1800],
    stock: [
      { item: 'item.missile', min: 6, max: 20 }, { item: 'item.metal', min: 20, max: 60 }, { item: 'item.electronics', min: 6, max: 20 },
      { item: 'item.parts', min: 4, max: 14 }, { item: 'item.ration', min: 8, max: 30, chance: 0.6 },
    ],
  },
  'trader.zealot': {
    name: 'Zealot', match: { faction: 'faction.zealot' }, shuttle: false, tagMods: { components: { sell: 0.9 } }, credits: [200, 900],
    stock: [{ item: 'item.electronics', min: 4, max: 16 }, { item: 'item.parts', min: 4, max: 16 }, { item: 'item.scrap', min: 5, max: 20, chance: 0.6 }],
  },
  'trader.mercenary': {
    name: 'Mercenary', match: { faction: 'faction.mercenary' }, shuttle: false, credits: [400, 1400],
    stock: [
      { item: 'item.rifle', min: 1, max: 3, chance: 0.6 }, { item: 'item.sidearm', min: 1, max: 4 }, { item: 'item.missile', min: 0, max: 8, chance: 0.5 },
      { item: 'item.ration', min: 6, max: 20 },
    ],
  },
} as const satisfies TradeDef['traders'];
