import { defineComponent } from '../ecs';

/**
 * On a player boarder ordered to wreck a module (`crew.sabotage`): the order itself, kept while a fight pauses the sabotage job.
 * The job is dropped when the boarder turns to fight; once no hostile is in sight and they are still able and aboard the order
 * resumes (boarding/resume.ts). It is removed when the order ends for good (destroyed, downed, cancelled, moved, undrafted).
 */
export interface SabotageOrder {
  module: number;
}
export const SabotageOrderC = defineComponent<SabotageOrder>('sabotageOrder');
