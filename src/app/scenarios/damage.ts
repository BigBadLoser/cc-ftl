import { damageScenarioCommands } from '../damageScenario';
import type { Scenario } from './types';

/** `?scenario=damage`: a fire, a hull breach and a damaged reactor (app/damageScenario.ts). Crew answer the fire and the breach on their own. */
export const damage: Scenario = ({ sim, dispatch, setSpeed }) => {
  setSpeed(1);
  // Rooms exist after the first ticks: set the scene then.
  setTimeout(() => { for (const cmd of damageScenarioCommands(sim)) dispatch(cmd); }, 600);
};
