import { shipIdOf } from '../regions';
import { CrewC, DeadC, PositionC } from '../crew/components';
import type { GridLike } from '../grid';
import { AirlockC } from '../modules/airlock';
import { regions } from '../regions';
import type { Sim } from '../sim';
import { DoorJam, Struct } from '../structure';
import { DOOR_CLOSE_PER_TICK } from '../tuning';

/**
 * Per region, what the last pass knew: the door tiles of `struct` at `structRev`, and the `door` revision right after its
 * writes. A cache keyed on the grid view, not sim state.
 */
interface DoorCache {
  structRev: number;
  /** Ascending indices of the Door tiles. */
  doors: Int32Array;
  /** 1 on Door tiles. */
  isDoor: Uint8Array;
  doorRev: number;
}

const caches = new WeakMap<GridLike, DoorCache>();

/**
 * Doors open fully while a living crew member is in the doorway or stepping into it, then close
 * at DOOR_CLOSE_PER_TICK (the auto-close timer). Gas flow scales with openness, so a door that is
 * still swinging shut still leaks. Non-door tiles are kept at 0 (a door that was deconstructed). A jammed door (`jam`)
 * stays fully open or shut until crew force it.
 *
 * A pass leaves every non-door tile at 0, so while neither `struct` nor `door` has been written since, only the door
 * tiles can change: the pass visits just those (in the same ascending order). Otherwise it sweeps every tile.
 */
export function doorsSystem(sim: Sim): void {
  const usedBy = crewTiles(sim);
  for (const { grid } of regions(sim)) {
    if (!grid.has('door') || !grid.has('struct')) continue;
    const { width, x0, y0 } = grid;
    const structRev = grid.revision('struct');
    let c = caches.get(grid);
    const clean = !!c && c.structRev === structRev && c.doorRev === grid.revision('door');
    if (!c || c.structRev !== structRev) c = doorTiles(grid, structRev);
    const hasModule = grid.has('module');
    const hasJam = grid.has('jam');
    // Crew tiles as indices into this region's window (computed as before, so a tile off the window aliases the same way).
    const used = new Set<number>();
    for (const p of usedBy.get(grid.id) ?? []) {
      used.add((p.y - y0) * width + (p.x - x0));
      used.add((p.toY - y0) * width + (p.toX - x0));
    }
    const step = (i: number, cur: number): void => {
      const x = i % width;
      const tx = x0 + x, ty = y0 + (i - x) / width;
      let next = cur;
      if (c.isDoor[i] === 0) next = 0;
      else {
        if (hasModule && isAirlockDoor(sim, grid.get('module', tx, ty))) return; // the airlock system owns these
        const jam = hasJam ? grid.get('jam', tx, ty) : DoorJam.None;
        if (jam === DoorJam.Open) next = 255;
        else if (jam === DoorJam.Shut) next = 0;
        else if (used.has(i)) next = 255;
        else if (cur > 0) next = Math.max(0, cur - DOOR_CLOSE_PER_TICK);
      }
      if (next !== cur) grid.set('door', tx, ty, next);
    };
    if (clean) {
      for (const i of c.doors) {
        const x = i % width;
        step(i, grid.get('door', x0 + x, y0 + (i - x) / width));
      }
    } else {
      const door = grid.load('door');
      for (let i = 0; i < door.length; i++) if (c.isDoor[i] === 1 || door[i] !== 0) step(i, door[i] as number);
    }
    c.doorRev = grid.revision('door');
    caches.set(grid, c);
  }
}

/** Living crew positions by the ship they stand on, in query order (one pass for every region). */
function crewTiles(sim: Sim): Map<number, { x: number; y: number; toX: number; toY: number }[]> {
  const out = new Map<number, { x: number; y: number; toX: number; toY: number }[]>();
  for (const id of sim.world.query(CrewC, PositionC)) {
    const p = sim.world.get(id, PositionC);
    if (!p || sim.world.has(id, DeadC)) continue;
    const ship = shipIdOf(sim, p);
    let list = out.get(ship);
    if (!list) out.set(ship, (list = []));
    list.push(p);
  }
  return out;
}

function doorTiles(grid: GridLike, structRev: number): DoorCache {
  const struct = grid.load('struct');
  const isDoor = new Uint8Array(struct.length);
  const doors: number[] = [];
  for (let i = 0; i < struct.length; i++) {
    if (struct[i] !== Struct.Door) continue;
    isDoor[i] = 1;
    doors.push(i);
  }
  return { structRev, doors: Int32Array.from(doors), isDoor, doorRev: -1 };
}

function isAirlockDoor(sim: Sim, id: number): boolean {
  return id !== 0 && sim.world.has(id, AirlockC);
}
