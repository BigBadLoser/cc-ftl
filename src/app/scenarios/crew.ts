import { bondScenario } from '../bondScenario';
import { breakScenario } from '../breakScenario';
import { inspectorScenario } from '../inspectorScenario';
import type { Scenario } from './types';

/** `?scenario=inspector`: a crew member with traits, XP, a rifle and a mixed mood, selected (app/inspectorScenario.ts). */
export const inspector: Scenario = ({ sim, dispatch, setSpeed, selectCrew }) => {
  const set = inspectorScenario(sim);
  for (const cmd of set.commands) dispatch(cmd);
  if (set.crew !== null) setTimeout(() => selectCrew(set.crew, true), 300);
  setSpeed(1);
};

/** `?scenario=breaks`: four crew members break at once (app/breakScenario.ts); the panicking one is selected. */
export const breaks: Scenario = ({ sim, dispatch, setSpeed, selectCrew }) => {
  const set = breakScenario(sim);
  setTimeout(() => { for (const cmd of set.commands) dispatch(cmd); }, 600);
  if (set.crew !== null) setTimeout(() => selectCrew(set.crew, true), 900);
  setSpeed(1);
};

/** `?scenario=bonds`: the first crew member has two friends and a rival (app/bondScenario.ts); they are selected. */
export const bonds: Scenario = ({ sim, dispatch, setSpeed, selectCrew }) => {
  const set = bondScenario(sim);
  setTimeout(() => { for (const cmd of set.commands) dispatch(cmd); }, 600);
  if (set.crew !== null) setTimeout(() => selectCrew(set.crew, true), 900);
  setSpeed(1);
};
