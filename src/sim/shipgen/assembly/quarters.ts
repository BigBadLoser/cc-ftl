import type { RoomSpec } from '../plan';
import type { Rng } from '../../rng';
import type { Recipe } from './recipe';

/** How the crew's beds are housed: quarters as planned, cut into one-bed cabins, or as barracks with a few singles. */

/** A barracks: crew quarters kept as one room of beds (a single cabin is `cabin`, and is not one). */
export const isBarracks = (r: RoomSpec): boolean => r.role === 'quarters' && r.cabins === false && !r.cabin;

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
 * The barracks' sleeper piece and how many sleep in one: a bed today; switching to a bunk (two sleepers in a bed's
 * footprint) halves the pieces a barracks holds and shrinks the rooms, with this line alone.
 */
export const SLEEPER: { readonly def: string; readonly sleepers: number } = { def: 'module.bed', sleepers: 1 };

/** Sleepers a room's planned modules hold: a bed one, a SLEEPER piece its count. */
export const sleepersIn = (mods: readonly string[]): number =>
  mods.reduce((n, m) => n + (m === SLEEPER.def ? SLEEPER.sleepers : m === 'module.bed' ? 1 : 0), 0);

/**
 * Floor for a barracks of `pieces` sleeper pieces, as the furnishing rules (rooms/rules) lay them: in pairs (a locker
 * between) on both long walls, the far wall's pairs and the door wall's either side of the door, five deep (a pair,
 * an aisle, a pair), and a few tiles over for the door's off-centre and the room's life support.
 */
export function barracksSize(pieces: number): { w: number; h: number } {
  const pairs = Math.ceil(pieces / 2), far = Math.ceil(pairs / 2), near = pairs - far;
  return { w: Math.max(3, 4 * far - 1, near > 0 ? 4 * near + 1 : 0) + 3, h: 5 };
}

/**
 * Barracks for so many sleepers, each room holding a number of them in `size`: their pieces (SLEEPER) in pairs, the
 * sleepers shared out so that every room but one holds whole pairs.
 */
export function barracksOf(rng: Rng, like: RoomSpec, beds: number, size: readonly [number, number]): RoomSpec[] {
  if (beds <= 0) return [];
  // As many rooms as the sleepers need at a size in the range, the pairs shared out evenly: no room of one pair left over.
  const count = Math.max(1, Math.round(beds / rng.int(size[0], size[1])));
  const pieces = Math.ceil(beds / SLEEPER.sleepers), pairs = Math.floor(pieces / 2);
  return Array.from({ length: count }, (_, i): RoomSpec => {
    const n = 2 * (Math.floor(pairs / count) + (i < pairs % count ? 1 : 0)) + (i === count - 1 ? pieces % 2 : 0);
    return { ...like, mods: Array<string>(n).fill(SLEEPER.def), ...barracksSize(n), cabins: false };
  }).filter((r) => r.mods.length > 0);
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
    // The crew's quarters, not a cabin that belongs to another department (the chief's, by the bridge).
    const crews = (r: RoomSpec): boolean => r.role === 'quarters' && (r.dept ?? 'habitation') === 'habitation';
    const quarters = rooms.filter(crews), first = quarters[0];
    const others = quarters.flatMap((r) => r.mods.filter((m) => m !== 'module.bed'));
    let beds = quarters.reduce((n, r) => n + r.mods.length, 0) - others.length;
    rooms = rooms.filter((r) => !crews(r));
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
