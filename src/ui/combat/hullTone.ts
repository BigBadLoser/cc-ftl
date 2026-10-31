/** Hull health bands for the combat view (one place): green from 60% up, amber from 30% to 60%, red below 30%. */
export const HULL_GREEN_AT = 60;
export const HULL_AMBER_AT = 30;
export type HullTone = 'green' | 'amber' | 'red';
export const hullTone = (pct: number): HullTone => (pct >= HULL_GREEN_AT ? 'green' : pct >= HULL_AMBER_AT ? 'amber' : 'red');
