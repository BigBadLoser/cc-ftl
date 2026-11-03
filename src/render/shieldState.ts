/**
 * What a ship's shield dome is playing, from its layer count frame to frame (render-side: the sim has no event for a
 * layer returning, so the renderer diffs `shield.layers`). Times are animation-clock ms.
 */
export interface DomeState {
  /** Layers shown (the last count seen). */
  layers: number;
  /** When the last layer was lost to a hit or a drain (the outer row breaks); -Infinity: never. */
  breakAt: number;
  /** When the last layer returned (a new row sweeps on). */
  regenAt: number;
  /** When a vent or a lockout dropped the shields (the whole dome sputters out), and how many rows it had. */
  downAt: number;
  downRows: number;
}

/** Seconds each dome effect lasts. */
export const DOME_SEC = { break: 1.0, regen: 1.0, down: 1.2, hit: 0.7, pierce: 0.8 } as const;
/** The dome effects step at this rate (pixel-art animation, not smooth). */
export const DOME_FPS = 12;

export function newDome(layers: number): DomeState {
  return { layers, breakAt: -Infinity, regenAt: -Infinity, downAt: -Infinity, downRows: 0 };
}

/** Take in the ship's layer count now; `down` is true while a vent or an overheat lockout holds the shields down. */
export function stepDome(s: DomeState, layers: number, down: boolean, now: number): void {
  if (layers < s.layers) {
    if (layers === 0 && down) {
      s.downAt = now;
      s.downRows = s.layers;
    } else {
      s.breakAt = now;
    }
  } else if (layers > s.layers) {
    s.regenAt = now;
    s.downAt = -Infinity;
  }
  s.layers = layers;
}

/** Progress 0..1 of an effect started at `at` lasting `sec`, stepped to DOME_FPS; -1 when it is not playing. */
export function domeAge(at: number, sec: number, now: number): number {
  const e = (now - at) / 1000;
  if (!(e >= 0) || e >= sec) return -1;
  return Math.floor(e * DOME_FPS) / DOME_FPS / sec;
}

/** True while the dome has anything to draw: layers up, or a break or a collapse still playing out. */
export function domeVisible(s: DomeState, now: number): boolean {
  return s.layers > 0 || domeAge(s.downAt, DOME_SEC.down, now) >= 0 || domeAge(s.breakAt, DOME_SEC.break, now) >= 0;
}
