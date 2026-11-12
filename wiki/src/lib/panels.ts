import data from '../data/generated/panels.json';
import type { panels } from '../../scripts/panel-recipes';
import type { UiApi } from '../../../src/ui/api';

// Panel data from real headless games (scripts/panel-recipes.ts), typed by the game's own snapshot functions.
export type Panels = { [K in keyof typeof panels]: ReturnType<(typeof panels)[K]> };
export const panel = data as unknown as Panels;

// Panels with buttons get an api that only takes clicks: in the wiki they do nothing.
export const inertApi = { dispatch: () => {}, selectModule: () => {} } as unknown as UiApi;
