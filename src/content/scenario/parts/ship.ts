import { newGame, type CrewPick } from '../../../sim';
import { definePart } from '../types';

export interface ShipSpec {
  /** The game seed (a caller's `seed` option wins: the app's `?seed=`). */
  seed?: number;
  /** The player's hull (default `ship.starter`). */
  template?: string;
  /** Populate the start node (stations, rocks, wrecks east of the ship). */
  populate?: boolean;
  /** Crew picks, or 'rolled' for the app's default picks. */
  crew?: readonly CrewPick[] | 'rolled';
  /** Pre-start setup tests already do: skip the goal chain, and clear the galaxy's fleets so nothing wanders into the scene. */
  skipGoals?: boolean;
  clearFleets?: boolean;
}
declare module '../types' { interface ScenarioSpec { ship?: ShipSpec } }

/** The player's ship and the new game around it (the only part that builds the sim; with an existing sim only the flags apply). */
export default definePart<'ship'>({
  key: 'ship',
  create: ({ seed, content }, s) => newGame(seed, content, s?.template ?? 'ship.starter', s?.populate ?? false, s?.crew),
  apply(ctx, s) {
    if (s.skipGoals) ctx.sim.story.goals.skipped = true;
    if (s.clearFleets) ctx.sim.galaxy.fleets = [];
  },
});
