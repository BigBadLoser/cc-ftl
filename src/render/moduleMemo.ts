import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import { ContainerC } from '../sim/containers/components';
import { PlotC } from '../sim/farm/components';
import { ModuleC, type Module } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { cropStage } from './cropStage';
import { stasisInputs } from './stasisArt';
import { animFrame, FLICKER_DARK_MS, FLICKER_LIT_MS, storageState } from './moduleArt';

/**
 * What lets the module view skip a module whose art cannot have changed since the last frame (#389). Resolving every
 * module's layer chains every frame was most of `moduleView.update`. A module's chains read:
 * - its own fields (def, tile, rotation, hp, power) and whether it shows active (`sameInputs`);
 * - a few components of its own: storage fill, a container's clamp, a bed's crop and stage (`worldInputs`; keep this in step
 *   with what `moduleLayers` reads from the world);
 * - the view: roof, wall level, livery, ruin, hull paint, loaded sheets, the hull's structure (the host generation);
 * - the render clock, only through the 4 fps animation frame, the damaged-flicker phase and the ruin blip (`artClock`), and
 *   only when the last chains were animated or blipping.
 * The bays, the docking airlock and the robot bay run animators of their own, so they never skip.
 */

/** The render clock as module art reads it: equal values give the same chains (moduleArt `stateArt`, moduleView `ruinLook`). */
export function artClock(now: number): number {
  const frame = animFrame(now, Number.POSITIVE_INFINITY);
  const lit = Math.max(0, now) % (FLICKER_LIT_MS + FLICKER_DARK_MS) < FLICKER_LIT_MS ? 1 : 0;
  // The ruin blip steps every 170 ms (offset by whole numbers per module, so the step is the same for all).
  const blip = Math.floor(now / 170);
  return (frame * 2 + lit) * 1e7 + blip;
}

/** True for modules whose art follows an animator of the view (never cached). */
export const animated = (def: ModuleDef): boolean => !!(def.robotBay || def.vehicleBay || def.airlock?.layout);

/** One module's inputs when its art was last resolved, and what its tint needs from that pass. */
export interface ModuleMemo {
  def: string;
  x: number;
  y: number;
  rot: number;
  hp: number;
  powered: boolean;
  enabled: boolean;
  active: boolean;
  extra: string;
  host: number;
  /** The art clock it depends on; null = none, NaN = never the same (animated). */
  clock: number | null;
  tiles: readonly { x: number; y: number }[];
  /** Wreck darkening of the tint (1 = none). */
  dark: number;
}

/** The module's own components its chains read, as one string ('' for most modules). */
export function worldInputs(world: World, id: number, def: ModuleDef, now = 0): string {
  let out = '';
  if (def.storage) out += storageState(world, id, def);
  if (def.stasisWheel) out += `|${stasisInputs(world, id, now)}`;
  if (def.container) out += `|${world.get(id, ContainerC)?.clamp ?? ''}`;
  if (def.plot) {
    const p = world.get(id, PlotC);
    if (p?.planted) out += `|${p.planted}|${cropStage(p.need ? p.grown / p.need : 0, p.ready)}`;
  }
  return out;
}

let memoOn = true;
/** Debug (render diffs, staleness checks): false resolves every module's art every frame, as before. */
export function setModuleMemo(on: boolean): void {
  memoOn = on;
}

/** True if the module's art would resolve to what it did when `memo` was taken. */
export function sameInputs(memo: ModuleMemo, m: Module, def: ModuleDef, active: boolean, extra: string, host: number, clock: number): boolean {
  return memoOn && memo.def === m.def && memo.x === m.x && memo.y === m.y && memo.rot === m.rot && memo.hp === m.hp && memo.powered === m.powered
    && memo.enabled === m.enabled && memo.active === active && memo.extra === extra && memo.host === host
    && (memo.clock === null || memo.clock === clock) && !animated(def);
}

/** The modules on one ship's grid, recomputed only when the world's module set or the grid's rectangle changes. */
export function createModuleIndex(world: World): (grid: Grid) => readonly number[] {
  let all: readonly number[] | null = null;
  let rect = '';
  let own: number[] = [];
  return (grid) => {
    const q = world.query(ModuleC);
    const r = `${grid.x0},${grid.y0},${grid.width},${grid.height}`;
    if (q === all && r === rect) return own;
    all = q;
    rect = r;
    own = q.filter((id) => {
      const m = world.get(id, ModuleC);
      return !!m && grid.inBounds(m.x, m.y);
    });
    return own;
  };
}
