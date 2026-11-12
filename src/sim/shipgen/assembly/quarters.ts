import type { RoomSpec } from '../plan';
import type { Rng } from '../../rng';
import type { Recipe } from './recipe';

/** How the crew's beds are housed: quarters as planned, cut into one-bed cabins, or as barracks with a few singles. */

/** A quarters block as one-bed cabins (the first takes the block's other pieces). */
export function cabinsOf(r: RoomSpec): RoomSpec[] {
  const beds = r.mods.filter((m) => m === 'module.bed').length;
  if (r.role !== 'quarters' || beds < 2) return [r];
  const others = r.mods.filter((m) => m !== 'module.bed');
  return Array.from({ length: beds }, (_, i): RoomSpec => ({ ...r, mods: ['module.bed', ...(i === 0 ? others : [])], w: 3, h: 6, cabin: true, cabins: false }));
}

/** A quarters room as cabins side by side, one bed each, taking the room's own length (walls between them included). */
export function cabinsWithin(r: RoomSpec): RoomSpec[] {
  const beds = r.mods.filter((m) => m === 'module.bed').length;
  if (r.role !== 'quarters' || beds < 2 || r.cabins === false) return [r]; // a barracks stays one room
  const others = r.mods.filter((m) => m !== 'module.bed');
  const room = Math.max(2 * beds, r.w - (beds - 1)), base = Math.floor(room / beds);
  return Array.from({ length: beds }, (_, i): RoomSpec => ({ ...r, mods: ['module.bed', ...(i === 0 ? others : [])], w: base + (i < room - base * beds ? 1 : 0), cabin: true, cabins: false }));
}

/**
 * Barracks for so many beds, each room holding a number of beds in `size`: double bunks (a bed's footprint, two beds)
 * in two rows, heads to the walls, an aisle between, and a tile along for lockers.
 */
export function barracksOf(rng: Rng, like: RoomSpec, beds: number, size: readonly [number, number]): RoomSpec[] {
  if (beds <= 0) return [];
  // As many rooms as the beds need at a size in the range, the beds shared out evenly: no room of two beds left over.
  const count = Math.max(1, Math.round(beds / rng.int(size[0], size[1])));
  return Array.from({ length: count }, (_, i): RoomSpec => {
    const n = Math.floor(beds / count) + (i < beds % count ? 1 : 0), bunks = Math.ceil(n / 2);
    return { ...like, mods: Array<string>(n).fill('module.bed'), w: Math.max(3, Math.ceil(bunks / 2) + 1), h: 5, cabins: false };
  });
}

/** A cabin for one, two wide. */
export const cabinOf = (like: RoomSpec, extra: readonly string[] = []): RoomSpec => ({ ...like, mods: ['module.bed', ...extra], w: 2, h: 4, cabin: true, cabins: false });

/**
 * The crew's beds, when the recipe houses them its own way: the rooms with barracks in place of quarters, and the
 * single cabins to scatter.
 */
export function house(rng: Rng, recipe: Recipe, all: readonly RoomSpec[]): { rooms: RoomSpec[]; pool: RoomSpec[] } {
  let rooms = [...all];
  const q = recipe.quarters;
  const pool: RoomSpec[] = [];
  if (q) {
    const quarters = rooms.filter((r) => r.role === 'quarters'), first = quarters[0];
    const others = quarters.flatMap((r) => r.mods.filter((m) => m !== 'module.bed'));
    let beds = quarters.reduce((n, r) => n + r.mods.length, 0) - others.length;
    rooms = rooms.filter((r) => r.role !== 'quarters');
    if (first) {
      const singles = q === 'scatter' ? beds : Math.min(beds, q.singles ?? 0);
      for (let i = 0; i < singles; i++) pool.push(cabinOf(first, q === 'scatter' && i === 0 ? others : []));
      beds -= singles;
      // What else the quarters held (life support) goes in the first barracks.
      const made = q === 'scatter' ? [] : barracksOf(rng, first, beds, q.barracks);
      if (made[0]) made[0] = { ...made[0], mods: [...made[0].mods, ...others] };
      rooms = [...rooms, ...made];
    }
  }
  return { rooms, pool };
}
