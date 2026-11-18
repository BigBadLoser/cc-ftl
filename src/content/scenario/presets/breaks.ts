import { pickCrew } from '../lib/crewPick';
import { definePreset } from '../types';

/**
 * `?scenario=breaks`: look at mental breaks (issue #175). The first four organic crew members each start a break at once, with a minute on the clock: a panic
 * over a fire (an urgent alert, the crew member flees and cowers), a tantrum, a despair and a work refusal (log lines, and the inspector's Conditions line). The
 * tantrum also dips the mood of the crew around it. The panicking one is selected.
 */
export default definePreset({
  doc: 'Four crew members break at once; the panicking one is selected.',
  spec: () => ({
    node: { warm: 10 },
    crew: [
      { who: 0, fireNear: true, break: { kind: 'panic', context: 'fire', sec: 60 } },
      { who: 1, break: { kind: 'tantrum', context: 'lowMood', sec: 60 } },
      { who: 2, break: { kind: 'despair', context: 'lowMood', sec: 60 } },
      { who: 3, break: { kind: 'refusal', context: 'lowMood', sec: 60 } },
    ],
    ui: { speed: 1, select: (sim) => pickCrew(sim, 0) },
  }),
});
