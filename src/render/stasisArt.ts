import type { World } from '../sim/ecs';
import type { Module } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { moduleLayers, type ModuleLayer, type ModuleLook } from './moduleArt';

/**
 * The stasis wheel's layers (#116; sprites from tools/blender/sprites/slab_game.py, lab panel `stasis`). The base
 * `<asset>.r<n>` is the wheel with every socket empty; each full slot adds its slab, `<asset>.slot<i>.r<n>`, drawn
 * over it back to front. Slot i stands at angle 45 + 36 i deg in the wheel's own frame (slot 0 at the hatch corner),
 * and rotation r turns that frame 90 deg per step the way the sprite pipeline's modkit does, so a slot's depth is how
 * far round it sits from the corner facing the camera.
 */

export const STASIS_SLOTS = 10;
/** The hover cart's ring loop (`slab.cart.r<n>[.fN]`): its own pace, not ANIM_FPS (at 4 fps the rings flickered). */
export const CART_FRAMES = 12;
export const CART_FPS = 8;

/** The cart's frame id for rotation `rot` at time `now` (ms), each cart on its own offset. */
export function cartFrame(rot: number, now: number, offset = 0): string {
  const f = Math.floor((Math.max(0, now) * CART_FPS) / 1000 + offset) % CART_FRAMES;
  return f ? `slab.cart.r${rot}.f${f}` : `slab.cart.r${rot}`;
}

const DZ = 0.001;                                   // per slab, over the wheel's key (all under FRONT_DZ)

/** Slots back to front for rotation `rot`: the order full slots are drawn in (fixed: the wheel rests in whole steps). */
export function slotOrder(rot: number): number[] {
  const depth = (i: number): number => Math.cos(((45 + 36 * i + 90 * rot - 45) * Math.PI) / 180);
  return Array.from({ length: STASIS_SLOTS }, (_, i) => i).sort((a, b) => depth(a) - depth(b));
}

export function stasisLayers(
  world: World, id: number, m: Module, def: ModuleDef, active: boolean, full: readonly boolean[], look?: ModuleLook,
): ModuleLayer[] {
  const main = moduleLayers(world, id, m, def, active, true, null, look)[0] as ModuleLayer;
  if (look?.hp !== undefined && look.hp <= 0) return [main];
  const out: ModuleLayer[] = [main];
  slotOrder(m.rot).forEach((i, k) => {
    if (!full[i]) return;
    const sid = `${def.asset}.slot${i}.r${m.rot}`;
    out.push({ chain: [sid], key: `${def.asset}.slot${i}`, tiles: 'all', dz: DZ * (k + 1), optional: true });
  });
  return out;
}
