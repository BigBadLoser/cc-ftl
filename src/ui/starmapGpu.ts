/**
 * The starmap's GPU view, as the screen sees it. The map content (nebula, areas, lanes, nodes, icons, labels) is drawn by Pixi
 * (`render/starmap`, built in `app` and handed over through the UiApi); the screen keeps the camera and the panels and tells the view
 * what changed. Nothing here draws.
 */
import type { UiStarArt, UiStarmap, UiStarNode, UiStarRoute } from './starmapApi';

/** What the map shows: the data and the screen state the levels colour themselves by. */
export interface StarmapGpuScene {
  map: UiStarmap;
  /** The sprites (null until loaded: sprites are left out meanwhile). */
  art: UiStarArt | null;
  level: 1 | 2 | 3;
  current: UiStarNode | null;
  selected: string | null;
  hover: string | null;
  picked: string | null;
  route: UiStarRoute | null;
  /** The plotted route as "x,y x,y ..." points. */
  routePts: string;
  routeSectors: ReadonlySet<string>;
  /** Screen px at the right edge that the side drawer covers. */
  inset: number;
}

/** The ship's glide along a lane while a jump animates (map units): its position and the lane's ends. */
export interface StarmapGlide {
  x: number;
  y: number;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
}

/** One hop's slide takes this long, whatever the sim's pace (the ship's and the fleets'). */
export const GLIDE_MS = 700;
/** The slide's easing (in-out quad): `t` 0..1 along a lane to the share of the lane covered. */
export const easeGlide = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** The fleets' slide (see `fleetSlide`): restarts when the turn changes (not on the first turn seen), runs one GLIDE_MS tween. Returns the eased share to draw, or null when idle. */
export function createFleetSlide(): (dt: number, turn: number | undefined) => number | null {
  let t = 1;
  let seen = -1;
  return (dt, turn) => {
    if (turn !== undefined && turn !== seen) {
      if (seen >= 0) t = 0;
      seen = turn;
    }
    if (t >= 1) return null;
    t = Math.min(1, t + dt / GLIDE_MS);
    return easeGlide(t);
  };
}

export interface StarmapGpu {
  /** New data or screen state. */
  scene(s: StarmapGpuScene): void;
  /** The view centre (map units), scale (screen px per map unit) and the view's size in CSS px. */
  camera(cx: number, cy: number, s: number, w: number, h: number): void;
  glide(g: StarmapGlide | null): void;
  /** How far the fleets that jumped this turn have slid from where they were to where they are (0..1, eased; 1 = arrived). */
  fleetSlide(t: number): void;
  /** The tooltip of what is under a point of the view (a fleet, a job mark), if any. */
  tip(x: number, y: number): string | null;
  destroy(): void;
}

/** Make the view inside `host` (it adds its canvas as the first child). */
export type CreateStarmapGpu = (host: HTMLElement) => StarmapGpu;

/** Map scale steps per octave: the map zoom sits on this grid, so the pixel grid is rebuilt at a few dozen distinct scales at most. */
export const SCALE_STEPS = 16;
/** Snap a map scale to the grid of sixteenths of an octave. */
export const snapScale = (s: number): number => 2 ** (Math.round(Math.log2(s) * SCALE_STEPS) / SCALE_STEPS);

/**
 * The zoom target after a zoom input: every input (wheel, trackpad, pinch, buttons) multiplies this unsnapped scale and only the scale
 * that is drawn is snapped, so many small steps add up to the same zoom as one big step instead of each being rounded away.
 */
export const zoomTarget = (target: number, factor: number, min: number, max: number): number => Math.min(max, Math.max(min, target * factor));

/** A wheel event's zoom factor: the mouse wheel's notch (deltaY about 100) is one 1.18 step; a trackpad's small fractional deltas zoom proportionally. */
export function wheelFactor(deltaY: number, deltaMode = 0): number {
  const px = deltaMode === 1 ? deltaY * 33 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return Math.exp(-Math.max(-150, Math.min(150, px)) * (Math.log(1.18) / 100));
}
