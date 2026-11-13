import { Container, Sprite } from 'pixi.js';
import { batchAdditive } from './batch';
import type { World } from '../sim/ecs';
import { PathC, PositionC } from '../sim/crew/components';
import { cartRest, walking } from '../sim/stasis/query';
import type { Atlas } from './assets/loader';
import { cartAhead, restPose, type CartPose, type Pt } from './stasisArt';

/**
 * The hover cart a crew member pushes a stasis slab on (#116; `slab.cart.r<n>[.fN]`, see stasisArt): one sprite and its
 * additive glow, in the depth-sorted layer on its own key, since the cart runs ahead of the carrier (in front of them or
 * behind them by the way they face). A look only: the sim has no cart object.
 */
export interface CartSprite {
  show(atlas: Atlas, id: string, x: number, y: number, z: number, tint: number): void;
  hide(): void;
  destroy(): void;
}

export function createCart(parent: Container): CartSprite {
  const root = new Container();
  const base = new Sprite();
  const glow = new Sprite();
  batchAdditive(glow);
  root.addChild(base, glow);
  root.visible = false;
  parent.addChild(root);
  return {
    show(atlas, id, x, y, z, tint) {
      const art = atlas.firstOf([id]);
      root.visible = !!art;
      if (!art) return;
      base.texture = art.tex;
      base.tint = tint;
      base.position.set(-art.ax, -art.ay);
      glow.visible = !!art.glow;
      if (art.glow) {
        glow.texture = art.glow;
        glow.position.copyFrom(base.position);
      }
      root.position.set(x, y);
      root.zIndex = z;
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
 * Where the cart of a carrier drawn at (x, y) should be now: walking, ahead along their route (the tile they are stepping
 * to, then their path's steps); standing, on the sim's rest tiles (cartRest). Where it last was while neither answers (a
 * stop with no room beside them keeps it where it came to); null: no cart to draw.
 */
export function cartTarget(world: World, id: number, x: number, y: number, last: CartPose | null): CartPose | null {
  if (!walking(world, id)) {
    const rest = cartRest(world, id);
    return rest ? restPose(x, y, rest) : last;
  }
  const pos = world.get(id, PositionC);
  const steps = world.get(id, PathC)?.steps ?? [];
  const route: Pt[] = pos ? [{ x: pos.toX, y: pos.toY }, ...steps] : steps;
  return cartAhead(x, y, route, last?.rot ?? 0) ?? last;
}

/** Ease the drawn cart toward `next` (`k` of the way; a turn snaps), so a corner or a stop slides rather than jumps. */
export function easeCart(cur: CartPose | null, next: CartPose, k: number): CartPose {
  if (!cur || cur.rot !== next.rot || Math.hypot(next.x - cur.x, next.y - cur.y) > 3) return next;
  return { x: cur.x + (next.x - cur.x) * k, y: cur.y + (next.y - cur.y) * k, rot: next.rot };
}
