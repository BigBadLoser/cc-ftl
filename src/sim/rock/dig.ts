import type { GridLike } from '../grid';
import { spillItems } from '../items/stacks';
import type { Sim } from '../sim';
import { Struct, writeStruct } from '../structure';
import { TICK_HZ } from '../time';

/**
 * Digging and levelling asteroid rock (folded into `job.build`): a build of Floor on rock mass digs it out, a build of Ground
 * on rock mass levels it. Both are slow on purpose and cost no materials. The rock mass around a dug tile stays, a natural
 * airtight wall. The outer layer (rock mass touching Space or rock ground, or the edge of the ship's bounds) cannot be dug,
 * so a dig never breaches by accident; it can still be levelled.
 */
export const DIG_TICKS = 15 * TICK_HZ;
export const LEVEL_TICKS = 6 * TICK_HZ;
/** A module footprint may clip at most this share of rock mass; its job levels those tiles first, for LEVEL_TICKS / 2 each. */
export const AUTO_LEVEL_MAX = 0.25;
export const AUTO_LEVEL_TICKS = LEVEL_TICKS / 2;

/** True if rock mass at (x, y) is the outer layer: a 4-neighbour is Space, rock ground, or out of bounds. */
export function isOuterRock(grid: GridLike, x: number, y: number): boolean {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    if (!grid.inBounds(x + dx, y + dy)) return true;
    const k = grid.get('struct', x + dx, y + dy);
    if (k === Struct.Space || k === Struct.Ground) return true;
  }
  return false;
}

/** Why `job.build` of `struct` on rock mass at (x, y) is refused, or null; and its work ticks. */
export function rockBuild(grid: GridLike, x: number, y: number, struct: number): { error: string } | { work: number } {
  if (struct === Struct.Ground) return { work: LEVEL_TICKS };
  if (struct !== Struct.Floor) return { error: 'rockMass' }; // dig or level it first
  if (isOuterRock(grid, x, y)) return { error: 'outerLayer' };
  return { work: DIG_TICKS };
}

/**
 * Finish a dig at (x, y): the rock becomes Floor owned by the digging ship, and the vein's ore, if any, drops on the new floor
 * as a loose stack (crew haul it to storage like any other loose stack). Returns the units yielded.
 */
export function finishDig(sim: Sim, grid: GridLike, ship: number, x: number, y: number): number {
  const code = grid.get('ore', x, y);
  const amt = grid.get('oreAmt', x, y);
  if (code) {
    grid.set('ore', x, y, 0);
    grid.set('oreAmt', x, y, 0);
  }
  writeStruct(grid, x, y, Struct.Floor);
  if (ship && grid.get('ship', x, y) !== ship) grid.set('ship', x, y, ship);
  const item = code ? Object.values(sim.content.ores ?? {}).find((o) => o.code === code)?.item : undefined;
  if (!item || amt <= 0) return 0;
  const left = spillItems(sim, ship, x, y, item, amt);
  sim.events.emit({ type: 'rock.dug', ship, x, y, item, count: amt - left });
  return amt - left;
}
