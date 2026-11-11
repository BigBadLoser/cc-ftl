import { DeadC, PositionC } from './crew/components';
import type { ShipGrid } from './shipGrid';
import { ModuleC } from './modules/components';
import { footprintTiles } from './modules/footprint';
import { shipGrid, shipIdOf } from './regions';
import { roomTiles } from './roomIndex';
import type { Sim } from './sim';
import { Struct, STRUCT_MAX_HP } from './structure';
import {
  ROOM_DIRT_PER_BODY, ROOM_DIRT_PER_STACK, ROOM_SPACE_MAX, ROOM_SPACE_MIN, ROOM_TIER_BELOW, ROOM_WEAKEST_SHARE,
} from './tuning';

/**
 * Room quality (docs/DESIGN.md, Crew > Mood > "Room quality and leisure"). The one owner of "how good is this room": a value 0..100 from
 * four inputs, each 0..100, where the weakest pulls the result down hard (`ROOM_WEAKEST_SHARE` of it, the mean takes the rest), mapped to a
 * tier. Mood (crew/mood.ts), the leisure drive and the overlay all ask here; nobody re-derives it.
 *  - space: tiles per user of the room (its beds, consoles, galleys and leisure stands; a room with none is unfurnished and has no space input).
 *  - comfort: beauty from modules and decor. NOT BUILT YET (the next pass): `comfortOf` returns null, so the input is left out.
 *  - cleanliness: loose item stacks and bodies lying in the room.
 *  - condition: damaged walls and modules, and a breach (a room open to space scores 0).
 * An unfurnished room is Decent at best (Pleasant and Impressive need a room that is used and roomy).
 * Cached per ship for the tick (a drawing reader may allow ROOM_QUALITY_EVERY); recomputed when the `room` field changes. Pure read: nothing is saved.
 */

export const ROOM_TIERS = ['grim', 'bare', 'decent', 'pleasant', 'impressive'] as const;
export type RoomTier = (typeof ROOM_TIERS)[number];
/** Display names of the tiers. */
export const ROOM_TIER_LABELS: Readonly<Record<RoomTier, string>> = { grim: 'Grim', bare: 'Bare', decent: 'Decent', pleasant: 'Pleasant', impressive: 'Impressive' };

export interface RoomQuality {
  room: number;
  /** 0..100. */
  value: number;
  /** Index into ROOM_TIERS. */
  tier: number;
  tiles: number;
  /** Users of the room (beds, consoles, galleys, leisure stands); 0 = unfurnished. */
  users: number;
  /** Each input 0..100, or null when it has no data (comfort, an unfurnished room's space). */
  inputs: { space: number | null; comfort: number | null; cleanliness: number; condition: number };
}

/** The tier index (0 grim .. 4 impressive) of a quality value. */
export function tierOfValue(value: number): number {
  const i = ROOM_TIER_BELOW.findIndex((b) => value < b);
  return i < 0 ? ROOM_TIERS.length - 1 : i;
}

interface Cached {
  tick: number;
  rev: number;
  rooms: Map<number, RoomQuality>;
}
const cache = new WeakMap<Sim, Map<number, Cached>>();

/**
 * Quality of every room of a ship, keyed by room id. Sim logic (mood) must see the state of *this* tick, so the default cache lives one tick: a save and
 * load at any point then changes nothing. A reader that only draws (the overlay) passes `maxAge` ticks (ROOM_QUALITY_EVERY) to spare the recompute.
 */
export function shipRoomQuality(sim: Sim, ship: number, maxAge = 0): ReadonlyMap<number, RoomQuality> {
  const grid = shipGrid(sim, ship);
  if (!grid || !grid.has('room')) return new Map();
  let per = cache.get(sim);
  if (!per) cache.set(sim, (per = new Map()));
  const rev = grid.revision('room');
  const hit = per.get(ship);
  if (hit && hit.rev === rev && sim.tick - hit.tick <= maxAge && sim.tick >= hit.tick) return hit.rooms;
  const rooms = compute(sim, ship, grid);
  per.set(ship, { tick: sim.tick, rev, rooms });
  return rooms;
}

/** Quality of the room covering tile (x, y) of a ship, or null for a doorway, a corridor gap outside any room or open space. */
export function roomQualityAt(sim: Sim, ship: number, x: number, y: number): RoomQuality | null {
  const grid = shipGrid(sim, ship);
  const tx = Math.round(x), ty = Math.round(y);
  if (!grid || !grid.has('room') || !grid.inBounds(tx, ty)) return null;
  const room = grid.get('room', tx, ty);
  return room === 0 ? null : shipRoomQuality(sim, ship).get(room) ?? null;
}

/** Quality of the room a positioned entity stands in, or null (see `roomQualityAt`). */
export function roomQualityOf(sim: Sim, id: number): RoomQuality | null {
  const pos = sim.world.get(id, PositionC);
  return pos ? roomQualityAt(sim, shipIdOf(sim, pos), pos.x, pos.y) : null;
}

/** Comfort of a room 0..100 from its modules and decor (the next pass). Null = no data yet, so the input does not count. */
function comfortOf(): number | null {
  return null;
}

/** Tiles per user, 0..100. */
const spaceScore = (perUser: number): number => Math.max(0, Math.min(100, ((perUser - ROOM_SPACE_MIN) / (ROOM_SPACE_MAX - ROOM_SPACE_MIN)) * 100));

function compute(sim: Sim, ship: number, grid: ShipGrid): Map<number, RoomQuality> {
  const tiles = roomTiles(grid);
  const roomAt = (x: number, y: number): number => (grid.inBounds(x, y) ? grid.get('room', x, y) : 0);
  const users = new Map<number, number>();
  const hpShare = new Map<number, number[]>();
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || shipIdOf(sim, m) !== ship) continue;
    const room = roomAt(m.x, m.y) || footprintTiles(def, m.x, m.y, m.rot).map((t) => roomAt(t.x, t.y)).find((r) => r !== 0) || 0;
    if (room === 0) continue;
    const slots = def.leisure ? def.leisure.stand.length : def.bed || def.console || def.workstation || def.galley ? 1 : 0;
    if (slots) users.set(room, (users.get(room) ?? 0) + slots);
    if (def.maxHp > 0) (hpShare.get(room) ?? (hpShare.set(room, []), hpShare.get(room) as number[])).push(Math.max(0, Math.min(1, m.hp / def.maxHp)));
  }
  const bodies = new Map<number, number>();
  for (const id of sim.world.query(DeadC, PositionC)) {
    const p = sim.world.get(id, PositionC);
    if (!p || shipIdOf(sim, p) !== ship) continue;
    const room = roomAt(Math.round(p.x), Math.round(p.y));
    if (room !== 0) bodies.set(room, (bodies.get(room) ?? 0) + 1);
  }
  const hasItems = grid.has('item'), hasHp = grid.has('hp');
  const out = new Map<number, RoomQuality>();
  for (const [room, list] of tiles) {
    let stacks = 0, breached = false;
    const walls = new Map<number, number>();
    for (const i of list) {
      const x = grid.x0 + (i % grid.width), y = grid.y0 + Math.floor(i / grid.width);
      if (hasItems && grid.get('item', x, y) !== 0) stacks++;
      for (const [dx, dy] of SIDES) {
        const nx = x + dx, ny = y + dy;
        if (!grid.inBounds(nx, ny)) continue;
        const s = grid.get('struct', nx, ny);
        if (s === Struct.Space) breached = true;
        else if ((s === Struct.Wall || s === Struct.Door) && hasHp) walls.set(ny * 100000 + nx, grid.get('hp', nx, ny));
      }
    }
    const wallScore = walls.size ? Math.min(100, ([...walls.values()].reduce((a, b) => a + b, 0) / walls.size / STRUCT_MAX_HP) * 100) : 100;
    const mods = hpShare.get(room) ?? [];
    const modScore = mods.length ? (mods.reduce((a, b) => a + b, 0) / mods.length) * 100 : 100;
    const condition = breached ? 0 : Math.min(wallScore, modScore);
    const cleanliness = Math.max(0, 100 - stacks * ROOM_DIRT_PER_STACK - (bodies.get(room) ?? 0) * ROOM_DIRT_PER_BODY);
    const n = users.get(room) ?? 0;
    const space = n > 0 ? spaceScore(list.length / n) : null;
    const comfort = comfortOf();
    const parts = [space, comfort, cleanliness, condition].filter((v): v is number => v !== null);
    const min = Math.min(...parts), mean = parts.reduce((a, b) => a + b, 0) / parts.length;
    let value = Math.round(min * ROOM_WEAKEST_SHARE + mean * (1 - ROOM_WEAKEST_SHARE));
    if (n === 0) value = Math.min(value, ROOM_TIER_BELOW[2] - 1); // unfurnished: Decent at best
    out.set(room, { room, value, tier: tierOfValue(value), tiles: list.length, users: n, inputs: { space, comfort, cleanliness, condition } });
  }
  return out;
}

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
