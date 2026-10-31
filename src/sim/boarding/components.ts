import { defineComponent } from '../ecs';

/**
 * On a player shuttle docked at a hostile ship: the boarding party it was told to bring home (`crew.recall`). 'boarding': the party
 * walks to the shuttle; 'undocking': the bay is down, so it casts off before docking at a home airlock; 'flying': on its way
 * (home bay or home airlock); 'landing': home, the party steps out. Plain data, so a save in the middle resumes the recall.
 */
export interface Recall {
  /** The hostile ship the party is on (the one the shuttle is docked to). */
  ship: number;
  /** The party: crew ordered to the shuttle (a member that fell out is removed). */
  crew: number[];
  state: 'boarding' | 'undocking' | 'flying' | 'landing';
  /** Tick the current state began. */
  since: number;
  /** The flight was re-issued once after stalling. */
  retried?: true;
}
export const RecallC = defineComponent<Recall>('recall');

/**
 * On a player boarder ordered to wreck a module (`crew.sabotage`): the order itself, kept while a fight pauses the sabotage job.
 * The job is dropped when the boarder turns to fight; once no hostile is in sight and they are still able and aboard the order
 * resumes (boarding/resume.ts). It is removed when the order ends for good (destroyed, downed, cancelled, moved, undrafted).
 */
export interface SabotageOrder {
  module: number;
}
export const SabotageOrderC = defineComponent<SabotageOrder>('sabotageOrder');

/**
 * On a player shuttle sent to board an enemy ship (`boarding.launch`): the party and the airlock it will dock at. 'pilot': the
 * pilot walks to the bay; 'loading': the passengers walk to it; 'flying': the shuttle is on its way; once docked the passengers step
 * out and the order ends. Plain data, so a save in the middle resumes the launch.
 */
export interface BoardLaunch {
  crew: number[];
  airlock: number;
  state: 'pilot' | 'loading' | 'flying';
  /** Tick the current state began (the walk to the bay gives up after LAUNCH_WALK_TICKS). */
  since: number;
}
export const BoardLaunchC = defineComponent<BoardLaunch>('boardLaunch');
