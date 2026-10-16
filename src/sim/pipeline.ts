import type { Sim } from './sim';
import { roomsSystem } from './systems/rooms';

/** One step of the tick. Reads and writes world components and grid fields only. */
export type System = (sim: Sim) => void;

/**
 * The ordered tick pipeline. RULE: systems never import or call each other. They interact only
 * through components and grid fields, so the order of this list is the only coupling between
 * them. Add a system by writing it in its own file and listing it here.
 */
export const pipeline: readonly System[] = [roomsSystem];
