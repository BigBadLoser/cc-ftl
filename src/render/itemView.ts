import { Sprite } from 'pixi.js';
import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import { ItemStackC } from '../sim/items/components';
import type { ItemDef } from '../sim/registry';
import type { Atlas, StaticSprite } from './assets/loader';
import { depthKey, iso } from './iso';
import type { Layers } from './layers';
import { lightTint, pulsePhase } from './lightTint';

export interface ItemViewHost {
  target(): { grid: Grid } | null;
  /** True when the ship has no running power source (emergency lighting). */
  emergency(): boolean;
}

export interface ItemView {
  update(): void;
  dispose(): void;
}

/** Stack size class of a floor stack: small up to a quarter of a full stack, medium up to 60%, then large. */
export function stackClass(count: number, stackSize: number): 's' | 'm' | 'l' {
  const f = count / Math.max(1, stackSize);
  return f <= 0.25 ? 's' : f <= 0.6 ? 'm' : 'l';
}

/** Asset ids for a floor stack of an item, most specific first. Items without art fall back to a plain crate. */
export const stackAssets = (item: string, count: number, stackSize: number): string[] => [`${item}.${stackClass(count, stackSize)}`, 'prop.crate'];
/** Asset ids for the small sprite a crew member carries. */
export const heldAssets = (item: string): string[] => [`${item}.held`, 'prop.crate'];

interface Entry {
  spr: Sprite;
  glow: Sprite | null;
  src: StaticSprite;
}

type ItemDefs = Readonly<Record<string, ItemDef>>;

/** Loose item stacks lying on floor tiles: one sprite per stack, sized by how full the stack is. */
export function createItemView(world: World, atlas: Atlas, L: Layers, items: ItemDefs, host: ItemViewHost): ItemView {
  const entries = new Map<number, Entry>();

  function drop(e: Entry): void {
    e.spr.destroy();
    e.glow?.destroy();
  }

  function place(e: Entry, x: number, y: number): void {
    const p = iso(x, y);
    const px = Math.round(p.x - e.src.ax);
    const py = Math.round(p.y - e.src.ay);
    e.spr.position.set(px, py);
    e.glow?.position.set(px, py);
  }

  function update(): void {
    const t = host.target();
    const live = new Set<number>();
    if (t) {
      const { grid } = t;
      const pulse = host.emergency() ? pulsePhase(performance.now()) : -1;
      for (const id of world.query(ItemStackC)) {
        const st = world.get(id, ItemStackC);
        if (!st || !grid.inBounds(st.x, st.y)) continue;
        const src = atlas.firstOf(stackAssets(st.item, st.count, items[st.item]?.stackSize ?? 50));
        if (!src) continue;
        live.add(id);
        let e = entries.get(id);
        if (e && e.src !== src) {
          drop(e);
          e = undefined;
        }
        if (!e) {
          const spr = new Sprite(src.tex);
          L.sorted.addChild(spr);
          let glow: Sprite | null = null;
          if (src.glow) {
            glow = new Sprite(src.glow);
            glow.blendMode = 'add';
            L.sorted.addChild(glow);
          }
          entries.set(id, (e = { spr, glow, src }));
        }
        // Stacks are in sector tiles; sprites are region-local (the region's containers sit at its sector offset).
        place(e, st.x - grid.x0, st.y - grid.y0);
        const key = depthKey(st.x - grid.x0, st.y - grid.y0) - 0.4;
        e.spr.zIndex = key;
        if (e.glow) e.glow.zIndex = key + 0.01;
        const lv = grid.inBounds(st.x, st.y) ? grid.get('light', st.x, st.y) : 0;
        e.spr.tint = lightTint(lv, false, pulse);
      }
    }
    for (const [id, e] of entries) {
      if (live.has(id)) continue;
      drop(e);
      entries.delete(id);
    }
  }

  return {
    update,
    dispose() {
      for (const e of entries.values()) drop(e);
      entries.clear();
    },
  };
}

