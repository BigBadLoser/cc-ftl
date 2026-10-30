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
