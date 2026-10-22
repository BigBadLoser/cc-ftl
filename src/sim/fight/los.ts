import { ModuleC } from '../modules/components';
import { openTilesOf } from '../modules/footprint';
import type { Grid } from '../grid';
import type { Sim } from '../sim';
import { Struct, isSolidRock } from '../structure';
import { DOOR_SIGHT_OPEN } from '../tuning';

export interface Cell {
  x: number;
  y: number;
}
export type Cover = 'none' | 'partial' | 'full';

/** Bresenham cells strictly between a and b, in order from a. */
export function rayCells(a: Cell, b: Cell): Cell[] {
  const out: Cell[] = [];
  if (a.x === b.x && a.y === b.y) return out;
  const dx = Math.abs(b.x - a.x);
  const dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx + dy;
  let x = a.x;
  let y = a.y;
  for (;;) {
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
    if (x === b.x && y === b.y) break;
    out.push({ x, y });
    if (out.length > 1000) break;
  }
  return out;
}

type Block = 'none' | 'wall' | 'module';

/** What a tile does to sight: walls and closed doors stop it; solid module tiles (not their open chair tiles) too. */
function blockOf(sim: Sim, grid: Grid, x: number, y: number): Block {
  if (!grid.inBounds(x, y)) return 'wall';
  const kind = grid.get('struct', x, y);
  if (kind === Struct.Wall || isSolidRock(kind)) return 'wall';
  if (kind === Struct.Door && grid.get('door', x, y) < DOOR_SIGHT_OPEN) return 'wall';
  const id = grid.has('module') ? grid.get('module', x, y) : 0;
  if (id === 0) return 'none';
  const m = sim.world.get(id, ModuleC);
  const def = m && sim.content.modules[m.def];
  if (!m || !def?.solid) return 'none';
  return openTilesOf(def, m.x, m.y, m.rot).some((t) => t.x === x && t.y === y) ? 'none' : 'module';
}

function moduleCover(sim: Sim, grid: Grid, x: number, y: number): Cover {
  const m = sim.world.get(grid.get('module', x, y), ModuleC);
  return (m && sim.content.modules[m.def]?.cover) ?? 'partial';
}

/**
 * Line of sight from tile `a` to tile `b` over wall, door and solid-module tiles, and the cover the target has.
 * Everything between them blocks except the tile next to the target on the attacker's side, which is its cover:
 * a solid module there gives its `cover` ('partial' by default), a doorway partial; a wall or closed door there
 * blocks. Also partial: a wall flanking the target on the attacker's side. No cover against point-blank fire.
 */
export function sightLine(sim: Sim, grid: Grid, a: Cell, b: Cell): { visible: boolean; cover: Cover } {
  const cells = rayCells(a, b);
  const last = cells.length - 1;
  for (let i = 0; i < last; i++) {
    const c = cells[i] as Cell;
    if (blockOf(sim, grid, c.x, c.y) !== 'none') return { visible: false, cover: 'none' };
  }
  if (last < 0) return { visible: true, cover: 'none' };
  const near = cells[last] as Cell;
  const block = blockOf(sim, grid, near.x, near.y);
  if (block === 'wall') return { visible: false, cover: 'none' };
  if (block === 'module') return { visible: true, cover: moduleCover(sim, grid, near.x, near.y) };
  if (grid.get('struct', near.x, near.y) === Struct.Door) return { visible: true, cover: 'partial' };
  const sx = Math.sign(a.x - b.x);
  const sy = Math.sign(a.y - b.y);
  const flank = (sx !== 0 && blockOf(sim, grid, b.x + sx, b.y) === 'wall') || (sy !== 0 && blockOf(sim, grid, b.x, b.y + sy) === 'wall');
  return { visible: true, cover: flank ? 'partial' : 'none' };
}
