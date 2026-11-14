/**
 * The stasis wheel's loading animation (#116; patches from tools/blender/sprites/slab_loadanim.py, lab panel `stasisload`).
 * A stow at the hatch (sim stasis/jobs.ts, STOW_WORK) plays 63 ticks over the job's progress 0..1, so it pauses with the game and runs
 * at game speed. Each hatch tick is a PATCH, `stasisload.<name>.r<rot>`: the pixels of the wheel that differ from the shut, empty
 * wheel, anchored on its origin and drawn over the wheel (and its other slabs) under the rim lamps. The cart in the patches ha0-hl9
 * is the crew member's own: the game hides its cart sprite while the animation runs (stowingNow). The slab ends in slot 0, so it
 * plays only when slot 0 is free (the slab then shows as the slot's own layer from the star steps on).
 */

const range = (n: number, f: (i: number) => string): string[] => Array.from({ length: n }, (_, i) => f(i));
const two = (i: number): string => String(i).padStart(2, '0');

/** The hatch patches in order: leaves part and the cradle rises (hd), folds flat (hc), the cart glides in (ha), the slab lowers onto the cradle (hh), the cart leaves (hl), the cradle tips and the slab is run in (hc09+), the leaves shut (he). */
export const HATCH_FRAMES: readonly string[] = [
  ...range(5, (i) => `hd${i}`), ...range(4, (i) => `hc${two(i)}`), ...range(10, (i) => `ha${i}`), ...range(7, (i) => `hh${i}`),
  ...range(10, (i) => `hl${i}`), ...range(17, (i) => `hc${two(i + 9)}`), ...range(2, (i) => `he${i}`),
];
/** The Geneva star's steps, then a short hold, once the slab is home. */
export const STAR_FRAMES = 6;
export const HOLD_FRAMES = 2;
export const LOAD_TICKS = HATCH_FRAMES.length + STAR_FRAMES + HOLD_FRAMES;
/** Ticks per second the animation was designed at (the lab strip); the sim's STOW_SECONDS sets the real pace. */
export const LOAD_FPS = 8;
/** The tick the shuttle takes the new slab in toward slot 0 (hc18): an empty slab standing there is out of its way by then. */
export const RUN_IN_TICK = HATCH_FRAMES.indexOf('hc18');
/** The ticks showing the crew member's cart (ha0 to hl9). */
export const CART_TICKS: readonly [number, number] = [HATCH_FRAMES.indexOf('ha0'), HATCH_FRAMES.indexOf('hl9')];

/** What one tick of the animation draws over the wheel. */
export interface LoadPlan {
  tick: number;
  /** The patch's name (`stasisload.<patch>.r<rot>`), none while the wheel itself shows all (the hold). */
  patch: string | null;
  /** Slot 0's slab and its lamp (cyan: a prisoner held) are drawn as the wheel's own layers: the slab is home. */
  home: boolean;
}

/** The animation's tick for a stow's progress 0..1. */
export const loadTick = (progress: number): number => Math.max(0, Math.min(LOAD_TICKS - 1, Math.floor(progress * LOAD_TICKS)));

export function loadPlan(tick: number): LoadPlan {
  const t = Math.max(0, Math.min(LOAD_TICKS - 1, Math.floor(tick)));
  const n = HATCH_FRAMES.length;
  return { tick: t, patch: t < n ? (HATCH_FRAMES[t] as string) : t < n + STAR_FRAMES ? `s${t - n}` : null, home: t >= n };
}

/** True while the plan's patches draw the crew member's cart. */
export const planHasCart = (tick: number): boolean => tick >= CART_TICKS[0] && tick <= CART_TICKS[1];

/** The patch sprite's id at rotation `rot`. */
export const patchId = (patch: string, rot: number): string => `stasisload.${patch}.r${rot}`;
