import data from '../data/generated/panels.json';
import type { panels, Feeds } from '../../scripts/panel-recipes';
import type { UiApi } from '../../../src/ui/api';

// Panel data recorded from real headless games (scripts/panel-recipes.ts), typed by the recipes' return types.
export type Panels = { [K in keyof typeof panels]: ReturnType<(typeof panels)[K]> };
export const panel = data as unknown as Panels;

/**
 * A stand-in for the game's UI api: each recorded feed is a store holding its recorded value, and everything else (dispatch,
 * selection, saves) is a function that does nothing, so a real panel renders the recorded scene and its buttons are inert.
 */
export function apiOf(feeds: Partial<Feeds> & Record<string, unknown> = {}): UiApi {
  const store = (v: unknown) => ({ subscribe: (run: (x: unknown) => void) => { run(v); return () => {}; } });
  return new Proxy({}, {
    get: (_, key) => (typeof key === 'string' && key in feeds ? store(feeds[key]) : () => undefined),
  }) as UiApi;
}

/** For panels whose buttons only dispatch. */
export const inertApi = apiOf();
