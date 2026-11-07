import type { Sim } from '../sim';
import { storySpec } from './spec';
import type { SceneShipRecipe } from './types';

/**
 * `debug.sceneArrivals` (the `?scenario=freighter` start): the open signal's scene is rolled again with its late-or-not ships fixed, whatever the seed
 * and the danger tier say: 'none' leaves them out, 'here' puts them in the pocket from the start, 'coming' has them jump in on their clock.
 */
export function setArrivals(sim: Sim, mode: 'none' | 'here' | 'coming'): void {
  const spec = sim.galaxy.signal;
  const recipe = spec?.event ? sim.content.events?.[spec.event]?.scene : undefined;
  if (!spec?.event || !recipe) return;
  const fix = (r: SceneShipRecipe): SceneShipRecipe => {
    if (!r.arrive) return r;
    const rest = { ...r };
    delete rest.danger;
    return { ...rest, chance: mode === 'none' ? 0 : 1, arrive: { ...r.arrive, chance: mode === 'coming' ? 1 : 0 } };
  };
  const aid = spec.ships.some((s) => s.aid);
  sim.galaxy.signal = storySpec(sim, spec.event, { ...recipe, ships: (recipe.ships ?? []).map(fix) });
  if (aid) for (const s of sim.galaxy.signal.ships) if (s.stance === 'helpless') s.aid = { state: 'agreed' };
}
