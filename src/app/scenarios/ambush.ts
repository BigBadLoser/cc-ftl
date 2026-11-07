import { startAmbushScenario } from '../ambushScenario';
import type { Scenario } from './types';

/** `?scenario=ambush[&trap|&honest][&signal][&tell=name][&event=<id>]`: the pirate ambush from its signal, or dropped out beside the skiff (app/ambushScenario.ts). */
export const ambush: Scenario = ({ sim, params, dispatch, setSpeed }) =>
  startAmbushScenario(sim, dispatch, () => setSpeed(1), {
    trap: params.has('trap') ? true : params.has('honest') ? false : null, signal: params.has('signal'),
    ...(params.get('tell') === 'name' ? { tell: 'name' as const } : {}), ...(params.get('event') ? { event: `event.${params.get('event')}` } : {}),
  });

/** `?scenario=freighter[&signal][&help][&raiders=none|here|coming]`: the distress freighter, through the same scene start as the ambush. */
export const freighter: Scenario = ({ sim, params, dispatch, setSpeed }) => {
  const raiders = params.get('raiders');
  startAmbushScenario(sim, dispatch, () => setSpeed(1), {
    trap: null, signal: params.has('signal'), event: 'event.distress_call', help: params.has('help'),
    ...(raiders === 'none' || raiders === 'here' || raiders === 'coming' ? { raiders } : {}),
  });
};
