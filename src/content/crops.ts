import type { CropDef } from '../sim';

/**
 * Hydroponics crops (DESIGN.md "New modules"): picked per bed, planted by a crew member (the water is delivered to the bed), grown while the bed is
 * powered, harvested as an item. Times are game seconds of powered growing; the numbers are a first pass, tuned against the food the crew eat
 * (a crew member eats about one 70-point meal every 10 minutes, so one bed of greens or beans feeds three to five crew).
 */
export const crops = {
  'crop.greens': { name: 'Greens', item: 'item.greens', yield: 6, growSec: 240, water: 1, stockCap: 30, blurb: 'Fast, small yield. Cooked into meals.' },
  'crop.beans': { name: 'Protein beans', item: 'item.beans', yield: 18, growSec: 600, water: 2, stockCap: 60, blurb: 'Slow, big yield. Cooked into meals.' },
  'crop.herbs': { name: 'Medicinal herbs', item: 'item.herbs', yield: 4, growSec: 360, water: 1, stockCap: 12, blurb: 'The med bed heals faster while herbs are in stock, one per treatment.' },
  'crop.grain': { name: 'Grain', item: 'item.grain', yield: 10, growSec: 360, water: 1, stockCap: 40, blurb: 'A trade good for now.' },
} satisfies Record<string, CropDef>;
