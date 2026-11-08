import type { Scenario } from './types';

/**
 * `?scenario=handover`: a trade station beside the ship and a delivery for it with its crate on deck, so the station shuttle comes for it. `?scenario=bounty` /
 * `?scenario=survey`: a finished bounty / survey to hand in, and you at the nearest military / research station (drops in by itself). See galaxy/jobsDebug.ts.
 */
const jobScenario = (name: 'handover' | 'bounty' | 'survey' | 'tracker'): Scenario => ({ sim, dispatch, setSpeed, spawnStation }) => {
  if (name === 'handover' || name === 'tracker') spawnStation('station.trading', 'outpost'); // a fresh game has no station ship at the start node: the shuttle needs one
  dispatch({ type: 'debug.jobScenario', name });
  dispatch({ type: 'debug.setCredits', value: 500 });
  setSpeed(1);
  const spots = [[100, 60], [20, 50], [60, 120], [150, 40], [30, 130], [170, 110], [10, 10]] as const;
  const deploy = (i: number): void => {
    if (name === 'handover' || name === 'tracker' || sim.sector.state === 'active' || i >= 60) return;
    if (sim.sector.state === 'deploying') dispatch({ type: 'sector.deploy', x: spots[i % spots.length]![0], y: spots[i % spots.length]![1] });
    setTimeout(() => deploy(i + 1), 150);
  };
  deploy(0);
};
export const handover = jobScenario('handover');
export const bounty = jobScenario('bounty');
export const survey = jobScenario('survey');
/** `?scenario=tracker`: the jobs tracker full (a delivery here, the station's offers taken, one due in 2 turns, one crate gone) for screenshots. */
export const tracker = jobScenario('tracker');
