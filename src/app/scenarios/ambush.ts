import { startAmbushScenario } from '../ambushScenario';
import type { Scenario } from './types';

/** `?scenario=ambush[&trap|&honest][&signal][&tell=name][&event=<id>]`: the pirate ambush from its signal, or dropped out beside the skiff (app/ambushScenario.ts). */
export const ambush: Scenario = ({ sim, params, dispatch, setSpeed }) =>
  startAmbushScenario(sim, dispatch, () => setSpeed(1), {
    trap: params.has('trap') ? true : params.has('honest') ? false : null, signal: params.has('signal'),
    ...(params.get('tell') === 'name' ? { tell: 'name' as const } : {}), ...(params.get('event') ? { event: `event.${params.get('event')}` } : {}),
  });
