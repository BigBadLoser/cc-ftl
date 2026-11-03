import type { MarketContent } from '../sim';

/**
 * The NPC economy (docs/STATUS.md, living world stage 3; model in `sim/galaxy/market.ts`). A port's market is a trade profile's stock as the baseline
 * (`profiles`: which profile a port kind trades under), and the port produces and consumes goods every turn (`rates`, per turn at size 1, times the
 * port's size). Mining outposts dig ore and metal; farms grow rations; trading stations eat a mix and make some electronics and polymer; depots and dens
 * consume. Miners add ore to their outpost and traders carry goods from where they are cheap to where they are dear (dock.ts).
 */
export const market = {
  profiles: { station: 'trader.station.trading', den: 'trader.station.pirate', depot: 'trader.station.military', outpost: 'trader.station.mining', nest: null },
  farm: { profile: 'trader.station.farming', chance: 0.3 },
  research: 'trader.station.research',
  rates: {
    'trader.station.mining': {
      produce: { 'item.iron_ore': 2, 'item.metal': 1, 'item.ice': 1, 'item.rare_ore': 0.2, 'item.fuel': 0.6 },
      consume: { 'item.ration': 1, 'item.parts': 0.2 },
    },
    'trader.station.farming': {
      produce: { 'item.ration': 3, 'item.ice': 0.5, 'item.fuel': 0.3, 'item.water': 1 },
      consume: { 'item.polymer': 0.3, 'item.parts': 0.2, 'item.metal': 0.3 },
    },
    'trader.station.trading': {
      produce: { 'item.electronics': 0.4, 'item.polymer': 0.5, 'item.fuel': 1 },
      consume: {
        'item.ration': 1.5, 'item.electronics': 0.5, 'item.parts': 0.4, 'item.metal': 0.8, 'item.missile': 0.2,
        // Smelters and habitats (issue #222): ore and life-support goods are bought in, so selling them here pays.
        'item.iron_ore': 2, 'item.rare_ore': 0.3, 'item.water': 0.5, 'item.oxygen': 0.5,
      },
    },
    'trader.station.military': {
      consume: { 'item.ration': 1, 'item.metal': 1, 'item.parts': 0.4, 'item.missile': 0.4, 'item.electronics': 0.3, 'item.oxygen': 0.3 },
    },
    'trader.station.pirate': {
      produce: { 'item.scrap_weapons': 1 },
      consume: { 'item.ration': 1, 'item.ice': 0.3, 'item.parts': 0.2, 'item.electronics': 0.2 },
    },
  },
  goods: [
    'item.scrap_hull', 'item.scrap_weapons', 'item.metal', 'item.electronics', 'item.polymer', 'item.parts', 'item.iron_ore', 'item.rare_ore', 'item.ice', 'item.ration', 'item.missile', 'item.fuel',
    'item.water', 'item.oxygen',
  ],
} satisfies MarketContent;
