import { BAY_FRAME_MS } from './vehicleBayArt';

/**
 * A shuttle docking at an airlock (shuttleView, airlockArt): it arrives alongside, slides in parallel to the hull for DOCK_SLIDE_MS
 * (the wings fold half way), the docking tube extends over TUBE_STEPS frames to the collar, then the collar clamps
 * (DOCK_CLAMP_DELAY_MS after the sim's dock). Undocking runs backwards: the collar unclamps (UNDOCK_SEQ, 3 frames), the tube
 * retracts, the shuttle slides out and leaves.
 */
export const DOCK_SLIDE_MS = 1400;
export const TUBE_STEPS = 3;
export const COLLAR_STEPS = 3;
export const DOCK_CLAMP_DELAY_MS = DOCK_SLIDE_MS + TUBE_STEPS * BAY_FRAME_MS;
/** Undocking: when the shuttle starts to slide out (collar unclamps, then the tube retracts first), and when it is done. */
export const UNDOCK_SLIDE_AT_MS = (COLLAR_STEPS + TUBE_STEPS) * BAY_FRAME_MS;
export const UNDOCK_DONE_MS = UNDOCK_SLIDE_AT_MS + DOCK_SLIDE_MS;

const ease = (k: number): number => {
  const c = Math.max(0, Math.min(1, k));
  return c * c * (3 - 2 * c);
};

export interface DockProgress {
  /** 0 in flight .. 1 lying along the hull. */
  slide: number;
  /** Tube extension frame: 0 retracted (nothing drawn), 1..TUBE_STEPS (the last one is mated). */
  tube: number;
}

/** Progress `since` ms after the sim docked the shuttle. */
export function dockProgress(since: number): DockProgress {
  const slide = ease(since / DOCK_SLIDE_MS);
  const tube = since < DOCK_SLIDE_MS ? 0 : Math.min(TUBE_STEPS, Math.floor((since - DOCK_SLIDE_MS) / BAY_FRAME_MS) + 1);
  return { slide, tube };
}

/** Progress `since` ms after the sim undocked it (null once it has left). */
export function undockProgress(since: number): DockProgress | null {
  if (since >= UNDOCK_DONE_MS) return null;
  const rel = since - COLLAR_STEPS * BAY_FRAME_MS; // the collar unclamps first with the tube still mated
  const tube = rel < 0 ? TUBE_STEPS : Math.max(0, TUBE_STEPS - 1 - Math.floor(rel / BAY_FRAME_MS));
  return { slide: 1 - ease((since - UNDOCK_SLIDE_AT_MS) / DOCK_SLIDE_MS), tube };
}
