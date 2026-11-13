import type { World } from '../sim/ecs';
import type { Module } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { slabDrainingIn, wheelSlots, type WheelSlot } from '../sim/stasis/query';
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
const LAMP_DZ = 0.02;                               // the rim lamps, over every slab

/** Each slot's rim lamp: off (no slab), amber (an empty slab ready), cyan (a prisoner held) or red (their slab on its reserve). */
export type Lamp = 'off' | 'amb' | 'cy' | 'red';
/** Each lit lamp's colour, multiplied into its white lens: green held, yellow an empty slab ready, red on its reserve. */
export const LAMP_TINT: Readonly<Record<Exclude<Lamp, 'off'>, number>> = { cy: 0x4f8f3a, amb: 0xc07a18, red: 0xb02a22 };
/** The red lamp's pulse: lit this many ms, then dark as long. */
export const PULSE_MS = 500;

export function lampOf(world: World, slot: WheelSlot | undefined): Lamp {
  if (!slot || slot.kind === 'none') return 'off';
  if (slot.kind === 'empty') return 'amb';
  return slabDrainingIn(world, slot.prisoner) ? 'red' : 'cy';
}

/** True in the lit half of the red lamp's pulse. */
export const pulseLit = (now: number): boolean => Math.floor(Math.max(0, now) / PULSE_MS) % 2 === 0;

/**
 * What the wheel's art depends on besides the module itself (moduleMemo's inputs): each slot's lamp, and the pulse's phase
 * while a lamp is red (the only time the wheel's art moves with the clock).
 */
export function stasisInputs(world: World, id: number, now: number): string {
  const lamps = wheelSlots(world, id).map((s) => lampOf(world, s));
  return lamps.join(',') + (lamps.includes('red') ? `|${pulseLit(now) ? 1 : 0}` : '');
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
  // The rim gauge, on the canopy's top over everything inside: one segment per slot, lit in its state's colour (dark in the base), red pulsing.
  const lit = pulseLit(look?.now ?? 0);
  slots.forEach((s, i) => {
    const lamp = lampOf(world, s);
    if (lamp === 'off' || (lamp === 'red' && !lit)) return;
    out.push({ chain: [`${def.asset}.lamp${i}.r${m.rot}`], key: `${def.asset}.lamp${i}`, tiles: 'all', dz: LAMP_DZ, optional: true, tint: LAMP_TINT[lamp] });
  });
  return out;
}

/**
 * The hover cart is pushed ahead of its carrier along the way they are about to walk (always floor, so it never pokes into a
 * wall, and it turns where their route turns), its push bar toward them. While they stand it rests where the sim says
 * (stasis/query cartRest). The sprite at rotation r is pushed toward PUSH[r], its bar at the other end.
 */
const PUSH: readonly (readonly [number, number])[] = [[0, 1], [-1, 0], [0, -1], [1, 0]];
/** Tiles along the route from the carrier to the cart's middle (its rear end half a tile ahead of them). */
export const CART_GAP = 1.5;

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
  return anchored(cx, cy, rot);
}

/** The pose of a cart with its middle at (cx, cy) turned `rot`: anchored on its front-most tile. */
function anchored(cx: number, cy: number, rot: number): CartPose {
  const [ux, uy] = rot % 2 === 1 ? [0.5, 0] : [0, 0.5];
  return { x: cx + ux, y: cy + uy, rot };
}

/**
 * The walk as whole orthogonal steps: a diagonal step (the sim takes one only where both tiles beside it are open) becomes
 * two, through the side tile that keeps the way it was already going. `first` is how many steps the first move became.
 */
export function orthoSteps(tiles: readonly Pt[]): { tiles: Pt[]; first: number } {
  const out: Pt[] = tiles.length > 0 ? [{ x: tiles[0]!.x, y: tiles[0]!.y }] : [];
  let first = 1;
  for (let i = 1; i < tiles.length; i++) {
    const p = out[out.length - 1]!, q = tiles[i]!;
    if (q.x === p.x && q.y === p.y) continue;
    if (q.x !== p.x && q.y !== p.y) {
      const b = out[out.length - 2];
      const alongY = !!b && b.x === p.x && b.y !== p.y;
      out.push(alongY ? { x: p.x, y: q.y } : { x: q.x, y: p.y });
      if (i === 1) first = 2;
    }
    out.push({ x: q.x, y: q.y });
  }
  return { tiles: out, first };
}

/**
 * The cart pushed ahead of a carrier walking `tiles` (the tile they are leaving, the one they step to, then their path),
 * `progress` (0..1) of the way through the first step. It always stands on two whole floor tiles of their way along one
 * straight run, so it never pokes into a wall: its middle CART_GAP ahead of them, held on a run's last two tiles until
 * they reach the turn, then pivoting onto the corner tile and the next. Null when they have nowhere left to walk.
 */
export function cartAhead(tiles: readonly Pt[], progress: number): CartPose | null {
  const { tiles: t, first } = orthoSteps(tiles);
  if (t.length < 2) return null;
  const dir = (i: number): [number, number] => [t[i + 1]!.x - t[i]!.x, t[i + 1]!.y - t[i]!.y];
  // Runs: straight stretches between turns (a corner tile ends one run and starts the next).
  const ends: number[] = [0];
  for (let i = 1; i < t.length - 1; i++) {
    const [ax, ay] = dir(i - 1), [bx, by] = dir(i);
    if (ax !== bx || ay !== by) ends.push(i);
  }
  ends.push(t.length - 1);
  const m = Math.max(0, Math.min(1, progress)) * first + CART_GAP;
  let r = 0;
  while (r < ends.length - 2 && m >= ends[r + 1]!) r++;
  const a = ends[r]!, b = ends[r + 1]!;
  const c = Math.max(a + 0.5, Math.min(b - 0.5, m));
  const [dx, dy] = dir(a);
  const rot = PUSH.findIndex(([px, py]) => px === dx && py === dy);
  return anchored(t[a]!.x + dx * (c - a), t[a]!.y + dy * (c - a), rot);
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
