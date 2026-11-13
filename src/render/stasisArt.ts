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
 * The hover cart is pushed ahead of its carrier along the way they are about to walk (always floor, so it never pokes into a
 * wall, and it turns where their route turns), its push bar toward them. While they stand it rests where the sim says
 * (stasis/query cartRest). The sprite at rotation r is pushed toward PUSH[r], its bar at the other end.
 */
const PUSH: readonly (readonly [number, number])[] = [[0, 1], [-1, 0], [0, -1], [1, 0]];
/** Tiles from the carrier to the cart's middle. */
export const CART_GAP = 1.3;

export interface Pt {
  x: number;
  y: number;
}

/** A cart pose: its sprite anchor (the centre of its front-most tile, in tiles) and its rotation. */
export interface CartPose {
  x: number;
  y: number;
  rot: number;
}

/** The pose of a cart whose middle is at (cx, cy), pushed from (x, y): along the axis nearer that line, the bar toward the pusher. */
function poseFrom(x: number, y: number, cx: number, cy: number, prev: number): CartPose {
  const vx = cx - x, vy = cy - y;
  let rot = ((prev % 4) + 4) % 4;
  if (Math.hypot(vx, vy) > 0.2) {
    const alongX = rot % 2 === 1 ? Math.abs(vx) >= 0.7 * Math.abs(vy) : Math.abs(vx) > 1.4 * Math.abs(vy);
    const want: readonly [number, number] = alongX ? [Math.sign(vx), 0] : [0, Math.sign(vy)];
    rot = PUSH.findIndex(([a, b]) => a === want[0] && b === want[1]);
  }
  const [ux, uy] = rot % 2 === 1 ? [0.5, 0] : [0, 0.5];
  return { x: cx + ux, y: cy + uy, rot };
}

/**
 * The cart ahead of a carrier at (x, y) walking `route` (the tiles still ahead, next first): its middle CART_GAP along the
 * route, or at the route's end when less is left. Null with no route (they stand: the cart rests, see restPose).
 */
export function cartAhead(x: number, y: number, route: readonly Pt[], prev: number): CartPose | null {
  if (route.length === 0) return null;
  let px = x, py = y, left = CART_GAP;
  for (const t of route) {
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
  return poseFrom(x, y, px, py, prev);
}

/** The cart resting on its two tiles (the sim's cartRest: the second at +1 along x for rot 0, along y for rot 1), its bar toward the carrier at (x, y). */
export function restPose(x: number, y: number, rest: { x: number; y: number; rot: 0 | 1 }): CartPose {
  const cx = rest.x + (rest.rot === 0 ? 0.5 : 0), cy = rest.y + (rest.rot === 1 ? 0.5 : 0);
  const p = poseFrom(x, y, cx, cy, rest.rot === 0 ? 1 : 0);
  // On the rest tiles' own axis whatever the line to the carrier says (they stand beside one end).
  const axisX = rest.rot === 0;
  if ((p.rot % 2 === 1) === axisX) return p;
  const s = axisX ? Math.sign(cx - x) || 1 : Math.sign(cy - y) || 1;
  const rot = PUSH.findIndex(([a, b]) => (axisX ? a === s && b === 0 : a === 0 && b === s));
  return { x: cx + (axisX ? 0.5 : 0), y: cy + (axisX ? 0 : 0.5), rot };
}
