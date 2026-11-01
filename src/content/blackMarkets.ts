import type { BlackMarketDef } from '../sim';

/**
 * Black-market service sets (DESIGN.md "Black markets"). A set is attached to a station (`attachServices`), whatever it was built as. The lesser set is
 * wired to a quarter of pirate-held and lawless stations (every set has a truce); the other three are the named markets (cartel, zealot machine bazaar, mercenary hiring hall): ready to attach
 * (and tested on a test station) but the galaxy does not spawn them yet. Prices are provisional: `sell`/`buy` multiply the station's own, `contrabandBuy` is
 * the share of base value paid for contraband (a legitimate trader pays nothing), the fence pays 50 to 60% of base value for anything. Crew take no wages.
 * The owners are the pirate factions of phase 2b; the zealot bazaar trades under `faction.zealot` (its prices and its hail rule, trade/augmentation.ts).
 */
const SHADY_ROLES = ['role.gunner', 'role.security', 'role.pilot', 'role.engineer', 'role.medic'] as const;

export const blackMarkets = {
  'bm.lesser': {
    name: 'Back-room dealer', tier: 'lesser', sell: 1.15, buy: 0.9, contrabandBuy: 0.7, truce: true,
    stock: [
      { item: 'item.stolen_goods', min: 2, max: 8, chance: 0.7 }, { item: 'item.looted_goods', min: 2, max: 6, chance: 0.5 }, { item: 'item.disruptor', min: 1, max: 2, chance: 0.35 },
    ],
    shadyCrew: { slots: 1, roles: ['role.gunner', 'role.security'], bonus: 1, costMult: 1.5, extra: 60 },
  },
  'bm.cartel': {
    name: 'Cartel market', tier: 'named', owner: 'cartel', sell: 1.1, contrabandBuy: 0.9, fence: { min: 0.5, max: 0.6 }, truce: true,
    stock: [
      { item: 'item.stolen_goods', min: 10, max: 30 }, { item: 'item.looted_goods', min: 8, max: 24 }, { item: 'item.disruptor', min: 2, max: 6 },
      { item: 'item.missile', min: 6, max: 14, chance: 0.6 }, { item: 'item.parts', min: 4, max: 12, chance: 0.6 },
    ],
  },
  'bm.zealot': {
    name: 'Machine bazaar', tier: 'named', owner: 'zealots', contrabandBuy: 0.65, truce: true, tradeFaction: 'faction.zealot',
    stock: [
      { item: 'item.ai_core', min: 1, max: 3 }, { item: 'item.robot_parts', min: 6, max: 18 }, { item: 'item.drone_tech', min: 2, max: 6 }, { item: 'item.stolen_goods', min: 1, max: 4, chance: 0.4 },
    ],
  },
  'bm.mercenary': {
    name: 'Hiring hall', tier: 'named', owner: 'mercenaries', sell: 1.1, contrabandBuy: 0.65, truce: true,
    stock: [
      { item: 'item.rifle', min: 1, max: 3 }, { item: 'item.sidearm', min: 2, max: 5 }, { item: 'item.missile', min: 4, max: 10, chance: 0.7 }, { item: 'item.disruptor', min: 1, max: 2, chance: 0.4 },
    ],
    shadyCrew: { slots: 4, roles: SHADY_ROLES, bonus: 2, costMult: 2.2, extra: 120 },
  },
} satisfies Record<string, BlackMarketDef>;
