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

/**
 * The hover cart trails its carrier along the way they walked (always floor they crossed, so it never pokes into a wall or
 * through furniture, follows them round corners and stays put while they work), its push bar toward them. The sprite at
 * rotation r has its bar at the end away from PUSH[r], so a cart towed toward v turns to the r whose PUSH is -v.
 */
const PUSH: readonly (readonly [number, number])[] = [[0, 1], [-1, 0], [0, -1], [1, 0]];
/** Tiles from the carrier back to the cart's middle, and how much of their way is remembered. */
export const CART_GAP = 1.3;
const TRAIL_LEN = 3;

export interface TrailPt {
  x: number;
  y: number;
}

/** Note the carrier's position (tiles): the trail is newest first, points at least a quarter tile apart, about TRAIL_LEN tiles long. */
export function pushTrail(trail: TrailPt[], x: number, y: number): void {
  const head = trail[0];
  if (head && Math.hypot(x - head.x, y - head.y) < 0.25) return;
  trail.unshift({ x, y });
  let len = 0;
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1] as TrailPt, b = trail[i] as TrailPt;
    len += Math.hypot(a.x - b.x, a.y - b.y);
    if (len > TRAIL_LEN) {
      trail.length = i + 1;
      return;
    }
  }
}

/**
 * The cart behind a carrier at (x, y) with that trail: its sprite anchor (the centre of its front-most tile, in tiles) and
 * rotation. It lies along the axis nearer the line back to the carrier, keeping `prev`'s axis until the other is clearly
 * nearer (a diagonal walk does not flip it every step); with no way behind them it stays at `prev`.
 */
export function cartPose(trail: readonly TrailPt[], x: number, y: number, prev: number): { x: number; y: number; rot: number } {
  let px = x, py = y, left = CART_GAP;
  for (const t of trail) {
    const d = Math.hypot(t.x - px, t.y - py);
    if (d >= left) {
      px += ((t.x - px) * left) / d;
      py += ((t.y - py) * left) / d;
      left = 0;
      break;
    }
    left -= d;
    px = t.x;
    py = t.y;
  }
  const vx = x - px, vy = y - py;
  let rot = ((prev % 4) + 4) % 4;
  if (Math.hypot(vx, vy) > 0.3) {
    const alongX = rot % 2 === 1 ? Math.abs(vx) >= 0.7 * Math.abs(vy) : Math.abs(vx) > 1.4 * Math.abs(vy);
    const want: readonly [number, number] = alongX ? [-Math.sign(vx), 0] : [0, -Math.sign(vy)];
    rot = PUSH.findIndex(([a, b]) => a === want[0] && b === want[1]);
  }
  const [ux, uy] = rot % 2 === 1 ? [0.5, 0] : [0, 0.5];
  return { x: px + ux, y: py + uy, rot };
}
