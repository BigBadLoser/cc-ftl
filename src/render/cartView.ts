import { Container, Sprite } from 'pixi.js';
import { batchAdditive } from './batch';
import type { World } from '../sim/ecs';
import { PathC, PositionC } from '../sim/crew/components';
import { cartRest, walking } from '../sim/stasis/query';
import type { Atlas } from './assets/loader';
import type { CrewLook } from './loadout';
import type { SlabFaces } from './slabFace';
import { cartAhead, restPose, turnToward, type CartPose, type Pt } from './cartPose';

/**
 * The hover cart a crew member pushes a stasis slab on (#116; `slab.cart.r<n>[.fN]`, see stasisArt): one sprite and its
 * additive glow, in the depth-sorted layer on its own key, since the cart runs ahead of the carrier (in front of them or
 * behind them by the way they face). A look only: the sim has no cart object.
 */
export interface CartSprite {
  /** `prisoner`: the look of who is in the slab on it (their figure is pressed into its face), none for an empty slab. */
  show(atlas: Atlas, id: string, flip: boolean, x: number, y: number, z: number, tint: number, prisoner?: CrewLook): void;
  hide(): void;
  /** Whether the art point (ax, ay), in the parent's frame, is on the shown cart's sprite box; the y it sorts by when so. */
  hit(ax: number, ay: number): number | null;
  destroy(): void;
}

export function createCart(parent: Container, faces?: SlabFaces): CartSprite {
  const root = new Container();
  const base = new Sprite();
  const glow = new Sprite();
  batchAdditive(glow);
  const face = new Sprite();
  face.visible = false;
  root.addChild(base, face, glow);
  root.visible = false;
  parent.addChild(root);
  return {
    show(atlas, id, flip, x, y, z, tint, prisoner) {
      const art = atlas.firstOf([id]);
      root.visible = !!art;
      if (!art) return;
      base.texture = art.tex;
      base.tint = tint;
      // Flipped left-right about the anchor (the cart's middle): a mirrored heading (cartPose headingArt).
      base.scale.x = flip ? -1 : 1;
      base.position.set(flip ? art.ax : -art.ax, -art.ay);
      // The prisoner's face, over the ring frame showing: baked once per heading from its first frame (slabFace.ts), and
      // flipped with the cart (a mirrored heading shows the figure mirrored too).
      const over = prisoner && faces?.face(id.replace(/\.f\d+$/, ''), art, prisoner)?.over;
      face.visible = !!over;
      if (over) {
        face.texture = over;
        face.tint = tint;
        face.scale.x = base.scale.x;
        face.position.copyFrom(base.position);
      }
      glow.visible = !!art.glow;
      if (art.glow) {
        glow.texture = art.glow;
        glow.scale.x = base.scale.x;
        glow.position.copyFrom(base.position);
      }
      root.position.set(x, y);
      root.zIndex = z;
    },
    hit(ax, ay) {
      if (!root.visible || !base.texture) return null;
      const lx = ax - root.x, ly = ay - root.y;
      const w = base.texture.width, x0 = base.scale.x < 0 ? base.x - w : base.x;
      return lx >= x0 && lx <= x0 + w && ly >= base.y && ly <= base.y + base.texture.height ? root.y : null;
    },
    hide() {
      root.visible = false;
    },
    destroy() {
      root.destroy({ children: true });
    },
  };
}

/**
 * Where the cart of a carrier drawn at (x, y) should be now: on the sim's rest tiles once it has parked them (cartRest: when
 * they stop, or already over their last steps, too short a walk to push it ahead); else, walking, ahead along their route
 * (the tile they are leaving, the one they step to, then their path). Where it last was while neither answers (a stop with
 * no room beside them keeps it where it came to); null: no cart to draw.
 */
export function cartTarget(world: World, id: number, x: number, y: number, last: CartPose | null): CartPose | null {
  const rest = cartRest(world, id);
  if (rest) return restPose(x, y, rest);
  if (!walking(world, id)) return last;
  const pos = world.get(id, PositionC);
  if (!pos) return last;
  const steps = world.get(id, PathC)?.steps ?? [];
  const route: Pt[] = [{ x: pos.x, y: pos.y }, { x: pos.toX, y: pos.toY }, ...steps];
  return cartAhead(route, pos.x === pos.toX && pos.y === pos.toY ? 0 : pos.progress) ?? last;
}

/**
 * Ease the drawn cart toward `next`, `k` of the way, its middle and its angle together (the short way round), so a corner
 * is a turn and a stop a slide rather than a jump; a cart more than 3 tiles off (a new carry) is put there at once.
 */
export function easeCart(cur: CartPose | null, next: CartPose, k: number): CartPose {
  if (!cur || Math.hypot(next.x - cur.x, next.y - cur.y) > 3) return next;
  return { x: cur.x + (next.x - cur.x) * k, y: cur.y + (next.y - cur.y) * k, angle: turnToward(cur.angle, next.angle, k) };
}
