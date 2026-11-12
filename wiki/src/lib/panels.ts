import type { panels, Feeds } from '../../scripts/panel-recipes';
import previews from '../data/generated/previews.json';
import sprites from '../data/generated/sprites.json';
import type { UiApi, UiIcon, UiThumb } from '../../../src/ui/api';

// Panel data recorded from real headless games (scripts/panel-recipes.ts), typed by the recipes' return types.
export type Panels = { [K in keyof typeof panels]: ReturnType<(typeof panels)[K]> };
/**
 * A recipe's recorded data, typed by its return type. A page imports just its own file (`../data/generated/panels/<name>.json`) so it ships
 * only what it shows: `const trade = panelOf('trade', tradeJson)`. A missing file fails the build.
 */
export const panelOf = <K extends keyof Panels>(_name: K, data: unknown): Panels[K] => data as Panels[K];

/**
 * The game's item icons from the wiki's extracted sprites (scripts/extract-sprites.ts): each is a whole 72 px image, drawn like a floor-stack
 * frame (scaled to fit its box).
 */
const itemIcons: Record<string, UiIcon> = Object.fromEntries(
  Object.entries(sprites as Record<string, string>).map(([id, src]) => [id, { src, x: 0, y: 0, w: 72, h: 72, sheetW: 72, sheetH: 72 }]),
);

/** A module's placement preview from the wiki's own build-time renders (scripts/render-module-previews.ts), as the build menu's thumb. */
const thumbOf = (def: string): UiThumb | null => {
  const url = (previews as Record<string, { url: string } | undefined>)[def]?.url;
  return url ? { url, w: 1, h: 1, ax: 0, ay: 0 } : null;
};

/**
 * A stand-in for the game's UI api: each recorded feed is a store holding its recorded value, and everything else (dispatch,
 * selection, saves) is a function that does nothing, so a real panel renders the recorded scene and its buttons are inert.
 * Item icons are always there.
 */
export function apiOf(feeds: Partial<Feeds> & Record<string, unknown> = {}): UiApi {
  const store = (v: unknown) => ({ subscribe: (run: (x: unknown) => void) => { run(v); return () => {}; } });
  return new Proxy({}, {
    get: (_, key) => {
      if (typeof key !== 'string') return undefined;
      if (key === 'structCosts' && key in feeds) return feeds[key]; // a plain record, not a feed
      if (key in feeds) return store(feeds[key]);
      if (key === 'itemIcons') return store(itemIcons);
      if (key === 'moduleThumb') return thumbOf;
      return () => undefined;
    },
  }) as UiApi;
}

/** For panels whose buttons only dispatch. */
export const inertApi = apiOf();
