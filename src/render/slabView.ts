import { Container, Sprite } from 'pixi.js';
import { batchAdditive } from './batch';
import { animNow } from './animClock';
import type { World } from '../sim/ecs';
import { floorSlabs } from '../sim/stasis/query';
import type { Atlas, StaticSprite } from './assets/loader';
import { depthKey, iso } from './iso';
import type { ItemViewHost } from './itemView';
import type { Layers } from './layers';
import { lightTint, pulsePhase } from './lightTint';

/**
 * Full stasis slabs set down on the floor (#116; a carry cut short): `slab.floor.x` / `.y` (tools/blender/sprites/slab_floor.py),
 * anchored on the slab's front-most tile, which is its second (stasis/place.ts floorTiles). Sorted like a floor stack: just
 * under anyone standing on that tile. A slab in a wheel is the wheel's layer (stasisArt) and one on a cart is the carrier's (crewView).
 */
export interface SlabView {
  update(): void;
  dispose(): void;
}

interface Entry {
  root: Container;
  spr: Sprite;
  src: StaticSprite;
}

export function createSlabView(world: World, atlas: Atlas, L: Layers, host: ItemViewHost): SlabView {
  const entries = new Map<number, Entry>();

  function build(src: StaticSprite): Entry {
    const root = new Container();
    const spr = new Sprite(src.tex);
    spr.position.set(-src.ax, -src.ay);
    root.addChild(spr);
    if (src.glow) {
      const glow = new Sprite(src.glow);
      batchAdditive(glow);
      glow.position.copyFrom(spr.position);
      root.addChild(glow);
    }
    L.sorted.addChild(root);
    return { root, spr, src };
  }

  function update(): void {
    const t = host.target();
    const live = new Set<number>();
    if (t) {
      const { grid } = t;
      const pulse = host.emergency() ? pulsePhase(animNow()) : -1;
      for (const s of floorSlabs(world)) {
        const f = s.tiles[1];
        if (!grid.inBounds(f.x, f.y)) continue;
        const src = atlas.firstOf([s.rot === 0 ? 'slab.floor.x' : 'slab.floor.y']);
        if (!src) continue;
        live.add(s.prisoner);
        let e = entries.get(s.prisoner);
        if (e && e.src !== src) {
          e.root.destroy({ children: true });
          e = undefined;
        }
        if (!e) entries.set(s.prisoner, (e = build(src)));
        const p = iso(f.x - grid.x0, f.y - grid.y0);
        e.root.position.set(Math.round(p.x), Math.round(p.y));
        e.root.zIndex = depthKey(f.x - grid.x0, f.y - grid.y0) - 0.4;
        e.spr.tint = lightTint(grid.get('light', f.x, f.y), false, pulse);
      }
    }
    for (const [id, e] of entries) {
      if (live.has(id)) continue;
      e.root.destroy({ children: true });
      entries.delete(id);
    }
  }

  return {
    update,
    dispose() {
      for (const e of entries.values()) e.root.destroy({ children: true });
      entries.clear();
    },
  };
}
