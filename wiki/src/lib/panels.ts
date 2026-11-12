import data from '../data/generated/panels.json';
import type { panels, Feeds } from '../../scripts/panel-recipes';
import sprites from '../data/generated/sprites.json';
import type { UiApi, UiIcon } from '../../../src/ui/api';

// Panel data recorded from real headless games (scripts/panel-recipes.ts), typed by the recipes' return types.
export type Panels = { [K in keyof typeof panels]: ReturnType<(typeof panels)[K]> };
export const panel = data as unknown as Panels;

/**
 * The game's item icons from the wiki's extracted sprites (scripts/extract-sprites.ts): each is a whole 72 px image, drawn like a floor-stack
 * frame (scaled to fit its box).
 */
const itemIcons: Record<string, UiIcon> = Object.fromEntries(
  Object.entries(sprites as Record<string, string>).map(([id, src]) => [id, { src, x: 0, y: 0, w: 72, h: 72, sheetW: 72, sheetH: 72 }]),
);

/**
 * A stand-in for the game's UI api: each recorded feed is a store holding its recorded value, and everything else (dispatch,
 * selection, saves) is a function that does nothing, so a real panel renders the recorded scene and its buttons are inert.
 * Item icons are always there.
 */
export function apiOf(feeds: Partial<Feeds> & Record<string, unknown> = {}): UiApi {
  const store = (v: unknown) => ({ subscribe: (run: (x: unknown) => void) => { run(v); return () => {}; } });
  return new Proxy({}, {
    get: (_, key) => (typeof key === 'string' && key in feeds ? store(feeds[key]) : key === 'itemIcons' ? store(itemIcons) : () => undefined),
  }) as UiApi;
}

/** For panels whose buttons only dispatch. */
export const inertApi = apiOf();
