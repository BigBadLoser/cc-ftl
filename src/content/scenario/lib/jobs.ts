import { definePreset, type Preset } from '../types';
import { deployShip } from './trip';

/**
 * `?scenario=handover`: a trade station beside the ship and a delivery for it with its crate on deck, so the station shuttle comes for it. `?scenario=bounty` /
 * `?scenario=survey`: a finished bounty / survey to hand in, and you at the nearest military / research station (dropped in by the build). `?scenario=tracker`:
 * the jobs tracker full (a delivery here, the station's offers taken, one due in 2 turns, one crate gone) for screenshots. See galaxy/jobsDebug.ts.
 */
export function jobPreset(name: 'handover' | 'bounty' | 'survey' | 'tracker', doc: string): Preset {
  const here = name === 'handover' || name === 'tracker';
  return definePreset({
    doc,
    spec: () => ({
      // A fresh game has no station ship at the start node: the shuttle needs one.
      ...(here ? { node: { stations: [{ kind: 'station.trading', size: 'outpost' as const, frame: true }] } } : {}),
      items: { credits: 500 },
      steps: [{
        cmds: [{ type: 'debug.jobScenario', name }],
        run: (ctx) => {
          if (!here && ctx.sim.sector.state === 'deploying') deployShip(ctx, [[100, 60], [20, 50], [60, 120], [150, 40], [30, 130], [170, 110], [10, 10]]);
        },
      }],
      ui: { speed: 1 },
    }),
  });
}
