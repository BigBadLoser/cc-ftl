import type { Sim } from './sim';
import { decideSystem } from './systems/decide';
import { draftedSystem } from './systems/drafted';
import { movementSystem } from './systems/movement';
import { needsSystem } from './systems/needs';
import { roomsSystem } from './systems/rooms';
import { workSystem } from './systems/work';

/** One step of the tick. Reads and writes world components and grid fields only. */
export type System = (sim: Sim) => void;

/**
 * The ordered tick pipeline. RULE: systems never import or call each other. They interact only
 * through components and grid fields, so the order of this list is the only coupling between
 * them. Add a system by writing it in its own file and listing it here.
 */
export const pipeline: readonly System[] = [
  // Rooms first: later systems (wander) read fresh room ids after last tick's builds.
  roomsSystem,
  // Needs before decisions, so a crew member who just got tired sleeps this tick.
  needsSystem,
  // Decide before drafted/movement: new paths are walked the same tick.
  decideSystem,
  draftedSystem,
  // Movement before work: arriving crew start working next tick (tile state is settled).
  movementSystem,
  // Work last: completed jobs change the grid, which rooms picks up next tick.
  workSystem,
];
