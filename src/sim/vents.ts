import type { GridLike } from './grid';
import { airlockDoorAt } from './modules/airlock';
import type { Grid } from './grid';
import type { Sim } from './sim';
import { Struct } from './structure';

/**
 * Whether the door at (x, y) can have a vent: a door tile that is not one of an airlock's doors (the airlock system owns those).
 * The one owner of that answer: the `door.vent` command, the vents system and the inspector snapshot all ask it.
 */
export function ventableDoor(sim: Sim, grid: GridLike, x: number, y: number): boolean {
  if (!grid.inBounds(x, y) || !grid.has('vent') || grid.get('struct', x, y) !== Struct.Door) return false;
  return airlockDoorAt(sim, grid as Grid, x, y) === null;
}
