import { Container, Sprite } from 'pixi.js';
import { batchAdditive } from './batch';
import type { Atlas } from './assets/loader';

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
