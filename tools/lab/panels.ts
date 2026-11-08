import type { LabPanel } from './panel';
import { shieldPanel } from './shield';
import { spritesPanel } from './sprites';
import { dronesPanel } from './drones';
import { droneLaunchPanel } from './droneLaunch';
import { marksPanel } from './marks';
import { shotsPanel } from './shots';
import { upgradesPanel } from './upgrades';
import { podsPanel } from './pods';

/** Every lab page. A new visual gets a panel here (a file of its own in tools/lab/), so it can be seen and shot on its own. */
export const PANELS: readonly LabPanel[] = [spritesPanel, shieldPanel, dronesPanel, droneLaunchPanel, marksPanel, shotsPanel, upgradesPanel, podsPanel];
