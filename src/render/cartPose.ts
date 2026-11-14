/**
 * The hover cart a crew member pushes a stasis slab on (#116): where it is and which way it faces. Art from
 * tools/blender/sprites/slab_cart.py: `slab.cart.h<h>[.fN]`, the cart turned h * 22.5 deg counterclockwise (seen from
 * above) from heading 0, which is pushed toward +y; each anchored on the cart's middle, so it turns in place. Only
 * h2..h10 are rendered: heading h is heading (4 - h) mod 16 flipped left-right on screen (the sprites match exactly).
 *
 * Walking, the cart is pushed ahead of its carrier along their way and always stands on two whole floor tiles of one
 * straight run of it, so it never ends a move in a wall; the drawn cart eases toward that (cartView easeCart), turning
 * through the angles in between at a corner. Standing, it rests where the sim parked it (stasis/query cartRest).
 */

export const CART_FRAMES = 12;
/** The ring loop's pace, not ANIM_FPS (at 4 fps the rings flickered). */
export const CART_FPS = 8;
export const CART_HEADINGS = 16;
/** Tiles along the route from the carrier to the cart's middle (its rear end half a tile ahead of them). */
export const CART_GAP = 1.5;

export interface Pt {
  x: number;
  y: number;
}

/** A cart pose: its middle (in tiles) and the way it is pushed, an angle with heading 0 (+y) at 0, counterclockwise. */
export interface CartPose {
  x: number;
  y: number;
  angle: number;
}

const STEP = (2 * Math.PI) / CART_HEADINGS;

/** The angle of pushing toward (dx, dy). */
export const angleOf = (dx: number, dy: number): number => Math.atan2(-dx, dy);

/** The nearest of the 16 headings to `angle`, 0..15. */
export function headingOf(angle: number): number {
  return ((Math.round(angle / STEP) % CART_HEADINGS) + CART_HEADINGS) % CART_HEADINGS;
}

/** The sprite of heading h: the rendered heading it is drawn from and whether that is flipped left-right. */
export function headingArt(h: number): { h: number; flip: boolean } {
  return h >= 2 && h <= 10 ? { h, flip: false } : { h: (((4 - h) % CART_HEADINGS) + CART_HEADINGS) % CART_HEADINGS, flip: true };
}

/** The cart's sprite id and flip for `angle` at time `now` (ms), each cart on its own frame offset. */
export function cartFrame(angle: number, now: number, offset = 0): { id: string; flip: boolean } {
  const { h, flip } = headingArt(headingOf(angle));
  const f = Math.floor((Math.max(0, now) * CART_FPS) / 1000 + offset) % CART_FRAMES;
  return { id: f ? `slab.cart.h${h}.f${f}` : `slab.cart.h${h}`, flip };
}

/** The point the cart sorts by: the middle of its front-most tile (the end nearer the camera), as a module's front tile. */
export function cartFront(p: CartPose): Pt {
  const dx = -Math.sin(p.angle), dy = Math.cos(p.angle);
  return { x: p.x + Math.abs(dx) * 0.5, y: p.y + Math.abs(dy) * 0.5 };
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
 * `progress` (0..1) of the way through the first step. It stands on two whole floor tiles of their way along one straight
 * run: its middle CART_GAP ahead of them, held on a run's last two tiles until they reach the turn, then on the corner tile
 * and the next. Null when they have nowhere left to walk.
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
  return { x: t[a]!.x + dx * (c - a), y: t[a]!.y + dy * (c - a), angle: angleOf(dx, dy) };
}

/** The cart resting on its two tiles (the sim's cartRest: the second at +1 along x for rot 0, along y for rot 1), pushed away from the carrier at (x, y). */
export function restPose(x: number, y: number, rest: { x: number; y: number; rot: 0 | 1 }): CartPose {
  const cx = rest.x + (rest.rot === 0 ? 0.5 : 0), cy = rest.y + (rest.rot === 1 ? 0.5 : 0);
  const s = rest.rot === 0 ? Math.sign(cx - x) || 1 : Math.sign(cy - y) || 1;
  return { x: cx, y: cy, angle: rest.rot === 0 ? angleOf(s, 0) : angleOf(0, s) };
}

/** `a` turned toward `b` by `k` of the way, the short way round. */
export function turnToward(a: number, b: number, k: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * k;
}
