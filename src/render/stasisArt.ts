import type { World } from '../sim/ecs';
import type { Module } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { wheelSlots } from '../sim/stasis/query';
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

/** What the wheel's art depends on besides the module itself (moduleMemo's inputs): which slots hold a slab. */
export function stasisInputs(world: World, id: number): string {
  return wheelSlots(world, id).map((s) => (s.kind === 'none' ? '0' : '1')).join('');
}

/** Slots back to front for rotation `rot`: the order full slots are drawn in (fixed: the wheel rests in whole steps). */
export function slotOrder(rot: number): number[] {
  const depth = (i: number): number => Math.cos(((45 + 36 * i + 90 * rot - 45) * Math.PI) / 180);
  return Array.from({ length: STASIS_SLOTS }, (_, i) => i).sort((a, b) => depth(a) - depth(b));
}

export function stasisLayers(
  world: World, id: number, m: Module, def: ModuleDef, active: boolean, look?: ModuleLook,
): ModuleLayer[] {
  const main = moduleLayers(world, id, m, def, active, true, null, look)[0] as ModuleLayer;
  if (look?.hp !== undefined && look.hp <= 0) return [main];
  const out: ModuleLayer[] = [main];
  // A slot with a slab in it, empty or full, shows the slab (a full one's prisoner face is a later layer); a slot with none shows the bare socket.
  const slots = wheelSlots(world, id);
  slotOrder(m.rot).forEach((i, k) => {
    if ((slots[i]?.kind ?? 'none') === 'none') return;
    const sid = `${def.asset}.slot${i}.r${m.rot}`;
    out.push({ chain: [sid], key: `${def.asset}.slot${i}`, tiles: 'all', dz: DZ * (k + 1), optional: true });
  });
  return out;
}

/** The way a cart at rotation r is pushed (r0 toward +y, each step 90 deg on, as the sprites face): the carrier stands at its push bar, behind. */
const PUSH: readonly (readonly [number, number])[] = [[0, 1], [-1, 0], [0, -1], [1, 0]];
/** How far ahead of the carrier the cart's middle runs, in tiles (its bar just past their hands). */
export const CART_REACH = 1.4;

/**
 * The cart's rotation for a carrier facing `dir` (crew facings: 0 = +x, 2 = +y, 4 = -x, 6 = -y, odd ones between). Facing
 * between two axes it keeps `prev` when that is one of the two, so a cart going round a diagonal does not flip back and forth.
 */
export function cartRot(dir: number, prev: number): number {
  const d = ((dir % 8) + 8) % 8;
  const rot = (e: number): number => (e / 2 + 3) % 4;
  if (d % 2 === 0) return rot(d);
  const a = rot(d - 1), b = rot((d + 1) % 8);
  return prev === a || prev === b ? prev : a;
}

/** Where the cart's sprite anchors (the centre of its front-most tile), in tiles from the carrier, for rotation `rot`. */
export function cartAnchor(rot: number): { dx: number; dy: number } {
  const [px, py] = PUSH[((rot % 4) + 4) % 4] as readonly [number, number];
  const near = { dx: px * (CART_REACH - 0.5), dy: py * (CART_REACH - 0.5) };
  const far = { dx: px * (CART_REACH + 0.5), dy: py * (CART_REACH + 0.5) };
  return far.dx + far.dy > near.dx + near.dy ? far : near;
}
