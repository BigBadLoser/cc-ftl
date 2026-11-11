import { localBuilder } from './blocks';
import type { Builder, Rect } from './builder';
import type { RoomSpec } from './plan';
import type { Rng } from '../rng';
import { free } from './stationRings';

/**
 * The deck-first station builder: circulation is laid out before anything else — a hall run (or two crossing at a
 * concourse) — and every room is then placed as frontage on a hall, sharing its wall and doored to it. This is the
 * wheel's order generalised to straight runs, so a room can only ever be reached through the deck's own circulation,
 * and the leftover space is the concourse in the middle rather than whatever the blocks happened to leave.
 *
 * Slice 1 of the rebuild (`docs/STATIONGEN2.md`): registered as `stationDeck`, in no kind's grammar list yet.
 */

export type DeckShape = 'cross' | 'spine';

/** Hall interior width: three tiles, the same as a spoke, so a hall reads as circulation and not as a room. */
const HALL = 3;
/** The junction concourse between the runs, interior side (grows with the deck, within limits). */
const JUNC = [5, 7, 9] as const;
const MIN_RUN = 14;

/** A room's footprint along a hall, including the wall it shares with it. */
const need = (r: RoomSpec): number => Math.max(r.w, r.h) + 2;

interface Run {
  /** Hall rect, walls included. */
  r: Rect;
  /** Which way it leaves the junction, and which way it grows. */
  dir: 'e' | 'w' | 'n' | 's';
}

/** The hall runs of a deck, leaving the junction on the given sides, `len` long (walls included). */
function runsOf(shape: DeckShape, core: Rect, len: number): Run[] {
  const midY = core.y + 1 + ((core.h - 2 - HALL) >> 1);
  const midX = core.x + 1 + ((core.w - 2 - HALL) >> 1);
  const sides: ('e' | 'w' | 'n' | 's')[] = shape === 'cross' ? ['e', 'w', 'n', 's'] : ['e', 'w'];
  return sides.map((dir) => {
    const r =
      dir === 'e' ? { x: core.x + core.w - 1, y: midY, w: len, h: HALL + 2 }
      : dir === 'w' ? { x: core.x - len + 1, y: midY, w: len, h: HALL + 2 }
      : dir === 's' ? { x: midX, y: core.y + core.h - 1, w: HALL + 2, h: len }
      : { x: midX, y: core.y - len + 1, w: HALL + 2, h: len };
    return { r, dir };
  });
}

/** The rect a room takes on the north (side -1) or south (side 1) flank of a horizontal run, `at` along it. */
const alongX = (run: Rect, side: -1 | 1, spec: RoomSpec, at: number): Rect => ({
  x: at,
  y: side < 0 ? run.y - spec.h - 1 : run.y + run.h - 1,
  w: spec.w + 2,
  h: spec.h + 2,
});

/** The rect a room takes on the west (side -1) or east (side 1) flank of a vertical run, `at` down it. */
const alongY = (run: Rect, side: -1 | 1, spec: RoomSpec, at: number): Rect => ({
  x: side < 0 ? run.x - spec.w - 1 : run.x + run.w - 1,
  y: at,
  w: spec.w + 2,
  h: spec.h + 2,
});

/**
 * Rooms as frontage on one side of a run, from the far end back towards the junction: each takes the wall it shares with
 * the hall, so it opens onto the deck's circulation. Rooms that do not fit stay in the queue for the next flank.
 */
function frontage(b: Builder, run: Rect, dir: 'e' | 'w' | 'n' | 's', side: -1 | 1, queue: RoomSpec[]): void {
  const horiz = dir === 'e' || dir === 'w';
  const start = horiz ? run.x + 1 : run.y + 1;
  const end = horiz ? run.x + run.w - 2 : run.y + run.h - 2;
  let at = start;
  for (let i = 0; i < queue.length && at <= end; ) {
    const spec = queue[i] as RoomSpec;
    const span = horiz ? spec.w + 2 : spec.h + 2;
    const rect = horiz ? alongX(run, side, spec, at) : alongY(run, side, spec, at);
    const fits = at + span - 1 <= end && free(b, rect);
    if (!fits) { if (at + span - 1 > end) break; i++; continue; }
    const part = b.place(rect, spec.role, spec);
    if (!part) { i++; continue; }
    // Frontage means a door onto the hall: a room that cannot be doored is taken back out rather than left sealed.
    if (!b.door(run, part)) {
      // Take the room back out, the wall it shares with the hall left alone.
      const keepRow = horiz ? (side < 0 ? rect.y + rect.h - 1 : rect.y) : -1;
      const keepCol = horiz ? -1 : side < 0 ? rect.x + rect.w - 1 : rect.x;
      for (let y = rect.y; y < rect.y + rect.h; y++) {
        for (let x = rect.x; x < rect.x + rect.w; x++) if (y !== keepRow && x !== keepCol) b.cv.put(x, y, '.');
      }
      b.parts.pop();
      i++;
      continue;
    }
    queue.splice(i, 1);
    at += span;
  }
}

/** A station deck: the concourse, the halls off it, the rooms on their frontage and the docks on the hall ends. */
export function deckStation(rng: Rng, hub: RoomSpec, rooms: RoomSpec[], shape: DeckShape): Builder | null {
  const b = localBuilder(rng);
  // Docks are rooms on frontage like any other: on a flank they sit against the deck's outer wall, where an airlock goes.
  const queue = [hub, ...rooms.filter((r) => r.role !== 'dock'), ...rooms.filter((r) => r.role === 'dock')];
  const flanks = (shape === 'cross' ? 4 : 2) * 2;
  const j = JUNC[Math.min(JUNC.length - 1, Math.max(0, Math.floor(queue.length / 22)))] as number;
  const len = Math.max(MIN_RUN, Math.ceil((queue.reduce((s, r) => s + need(r), 0) * 1.35) / flanks) + j + 3);
  const js = j >> 1;
  const core = b.place({ x: -js - 1, y: -js - 1, w: j + 2, h: j + 2 }, 'plaza', { role: 'plaza', mods: [], w: j, h: j });
  if (!core) return null;
  for (const { r, dir } of runsOf(shape, core, len)) {
    const hall = b.place(r, 'hall');
    if (!hall) return null;
    b.door(core, hall);
    for (const side of [-1, 1] as const) frontage(b, r, dir, side, queue);
  }
  return queue.length === 0 ? b : null;
}
