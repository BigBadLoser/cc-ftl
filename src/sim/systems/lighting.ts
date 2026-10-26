import type { Grid } from '../grid';
import { ModuleC } from '../modules/components';
import { regions, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { ShipC } from '../combat/components';
import { LIGHT_FALLOFF, WRECK_LIGHT_SCALE } from '../tuning';

/** A lit light module: its sector tile and its def's light. */
interface Lamp {
  x: number;
  y: number;
  level: number;
  radius: number;
}

/**
 * What a region's last solve read, so a tick whose inputs all match can be skipped (the output would be the same field,
 * which the grid still holds). A cache keyed on the grid view, not sim state.
 */
interface LightCache {
  /** The light from the lamps alone (before door spill), and what it was computed from: lamps, scale, `room` revision. */
  base: Uint8Array;
  lamps: number[];
  scale: number;
  roomRev: number;
  /** Door tiles (from `struct` at `structRev`) and which of them were open (`door` != 0) at the last solve. */
  structRev: number;
  doors: Int32Array;
  open: Uint8Array;
  /** The `light` revision right after the last solve's writes: unchanged means the field still holds its result. */
  lightRev: number;
}

const caches = new WeakMap<Grid, LightCache>();

/**
 * The light field is recomputed from powered light modules. A light only reaches
 * tiles of its own room within its radius (walls and closed doors stop it); level falls off
 * linearly with distance. Door tiles (room 0) take the brightest light of their neighbours.
 * A region whose lamps, scale, rooms, structure, set of open doors and light field are all as at its last solve is
 * skipped: the solve is a pure function of them, and the field still holds its output.
 */
export function lightingSystem(sim: Sim): void {
  const lampsByShip = litLamps(sim);
  for (const { grid } of regions(sim)) {
    if (!grid.has('light') || !grid.has('room')) continue;
    const lamps = lampsByShip.get(grid.id) ?? [];
    const scale = sim.world.get(grid.id, ShipC)?.state === 'wreck' ? WRECK_LIGHT_SCALE : 1;
    const lampKey = lamps.flatMap((l) => [l.x, l.y, l.level, l.radius]);
    const roomRev = grid.revision('room');
    const structRev = grid.revision('struct');
    const c = caches.get(grid);
    const baseHit = !!c && c.scale === scale && c.roomRev === roomRev && sameNumbers(c.lamps, lampKey);
    const doors = c && c.structRev === structRev ? c.doors : doorTiles(grid);
    const open = openDoors(grid, doors);
    if (baseHit && c.structRev === structRev && sameBytes(c.open, open) && c.lightRev === grid.revision('light')) continue;
    const base = baseHit ? c.base : lampLight(grid, lamps, scale);
    const next = base.slice();
    spillThroughDoors(grid, next, doors, open);
    const { width } = grid;
    const light = grid.load('light');
    for (let i = 0; i < next.length; i++) {
      if (light[i] !== next[i]) {
        const x = i % width;
        grid.set('light', grid.x0 + x, grid.y0 + (i - x) / width, next[i] as number);
      }
    }
    caches.set(grid, { base, lamps: lampKey, scale, roomRev, structRev, doors, open, lightRev: grid.revision('light') });
  }
}

/** Powered, intact light modules by the ship they stand on, in module query order (one pass for every region). */
function litLamps(sim: Sim): Map<number, Lamp[]> {
  const out = new Map<number, Lamp[]>();
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const light = m && sim.content.modules[m.def]?.light;
    if (!m || !light || !m.powered || m.hp <= 0) continue;
    const ship = shipIdOf(sim, m);
    let list = out.get(ship);
    if (!list) out.set(ship, (list = []));
    list.push({ x: m.x, y: m.y, level: light.level, radius: light.radius });
  }
  return out;
}

/** The light of the lamps alone over the grid's window: each lights its own room within its radius, brightest wins. */
function lampLight(grid: Grid, lamps: readonly Lamp[], scale: number): Uint8Array {
  const { width, height } = grid;
  const next = new Uint8Array(width * height);
  const room = grid.load('room');
  for (const light of lamps) {
    // Index the loaded window from its top-left: (mx, my) is the module's tile relative to (x0, y0).
    const mx = light.x - grid.x0, my = light.y - grid.y0;
    const home = room[my * width + mx] as number;
    if (home === 0) continue;
    const r = Math.ceil(light.radius);
    for (let y = Math.max(0, my - r); y <= Math.min(height - 1, my + r); y++) {
      for (let x = Math.max(0, mx - r); x <= Math.min(width - 1, mx + r); x++) {
        const i = y * width + x;
        if (room[i] !== home) continue;
        const d = Math.hypot(x - mx, y - my);
        if (d > light.radius) continue;
        const v = Math.round(light.level * scale * (1 - (LIGHT_FALLOFF * d) / light.radius));
        if (v > (next[i] as number)) next[i] = v;
      }
    }
  }
  return next;
}

/** Ascending indices of the grid's door tiles. */
function doorTiles(grid: Grid): Int32Array {
  const struct = grid.load('struct');
  const out: number[] = [];
  for (let i = 0; i < struct.length; i++) if (struct[i] === Struct.Door) out.push(i);
  return Int32Array.from(out);
}

/** 1 for each door tile (same order as `doors`) whose door is open at all. */
function openDoors(grid: Grid, doors: Int32Array): Uint8Array {
  const out = new Uint8Array(doors.length);
  const { width, x0, y0 } = grid;
  for (let k = 0; k < doors.length; k++) {
    const i = doors[k] as number;
    const x = i % width;
    out[k] = grid.get('door', x0 + x, y0 + (i - x) / width) !== 0 ? 1 : 0;
  }
  return out;
}

/** Open doorways borrow the brightest adjacent room tile, so crew crossing a door are not blacked out. */
function spillThroughDoors(grid: Grid, next: Uint8Array, doors: Int32Array, open: Uint8Array): void {
  const { width, height } = grid;
  for (let k = 0; k < doors.length; k++) {
    if (open[k] === 0) continue;
    const i = doors[k] as number;
    const x = i % width;
    const y = (i - x) / width;
    let best = 0;
    if (x > 0) best = Math.max(best, next[i - 1] as number);
    if (x < width - 1) best = Math.max(best, next[i + 1] as number);
    if (y > 0) best = Math.max(best, next[i - width] as number);
    if (y < height - 1) best = Math.max(best, next[i + width] as number);
    next[i] = best;
  }
}

function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
