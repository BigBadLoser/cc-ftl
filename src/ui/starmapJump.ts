import type { Command } from '../sim';

/** Flip a docked shuttle in or out of the list of those taken along (the confirm step's toggles). */
export const toggleTake = (taking: readonly number[], id: number): number[] => (taking.includes(id) ? taking.filter((t) => t !== id) : [...taking, id]);

/** The `galaxy.jump` for a plotted route: `withDocked` is present only when the player picked docked shuttles to take. */
export function jumpCommand(ship: number, path: readonly string[], taking: readonly number[]): Extract<Command, { type: 'galaxy.jump' }> {
  return { type: 'galaxy.jump', ship, route: path.slice(1), ...(taking.length ? { withDocked: [...taking] } : {}) };
}
