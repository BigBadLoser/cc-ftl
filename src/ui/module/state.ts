import type { UiModule } from '../api';

/** The module's running state in one word. */
export const moduleState = (x: UiModule): string => (!x.enabled ? 'Disabled' : x.hp <= 0 ? 'Destroyed' : x.powered ? 'Running' : 'No power');
