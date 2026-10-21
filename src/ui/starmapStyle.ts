/** Colours shared by the starmap levels. */

/** Structure badge colours: trader, mission, repair, abandoned, derelict. */
export const BADGE: Record<string, string> = { T: '#4ade80', M: '#60a5fa', R: '#c4b5fd', A: '#a3a3a3', D: '#fb923c' };
/** Danger tier label colours: calm cyan through amber to red. */
export const DANGER = ['#67e8f9', '#86efac', '#bef264', '#fde047', '#fbbf24', '#fb923c', '#f87171', '#ef4444', '#dc2626', '#e879f9'];
export const dangerColor = (d: number) => DANGER[Math.max(0, Math.min(DANGER.length - 1, d))]!;
