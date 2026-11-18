import { SECTOR_HEIGHT, SECTOR_WIDTH } from '../tuning';

/**
 * A node's bounds, at least the minimum node size (`SECTOR_WIDTH` x `SECTOR_HEIGHT`): what a restored node (a save, an archive) gets, so one
 * saved before the floor was raised has room for today's ships. A node that grew past the floor (a station, a yard) keeps its size.
 */
export const nodeSize = (s: { width: number; height: number }): { width: number; height: number } => ({
  width: Math.max(s.width, SECTOR_WIDTH),
  height: Math.max(s.height, SECTOR_HEIGHT),
});
