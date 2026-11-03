import type { LabPanel } from './panel';
import { spritesPanel } from './sprites';

/** Every lab page. A new visual gets a panel here (a file of its own in tools/lab/), so it can be seen and shot on its own. */
export const PANELS: readonly LabPanel[] = [spritesPanel];
