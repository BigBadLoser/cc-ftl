import { Container, Sprite } from 'pixi.js';
import { animNow } from './animClock';
import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import { ItemStackC } from '../sim/items/components';
import type { ItemDef } from '../sim/registry';
import type { Atlas, StaticSprite } from './assets/loader';
import { depthKey, iso } from './iso';
import type { Layers } from './layers';
import { lightTint, pulsePhase } from './lightTint';
import { slotOffset, unitCount } from './stackSlots';

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

/** Asset ids for a floor stack of an item drawn as one sprite, most specific first. Items without art fall back to a plain crate. */
export const stackAssets = (item: string, count: number, stackSize: number): string[] => [`${item}.${stackClass(count, stackSize)}`, 'prop.crate'];
/** Asset id of an item's stack unit (stackSlots.ts): items that have one draw their floor stacks as units on the slot grid. */
export const unitAsset = (item: string): string => `${item}.unit`;
/** Asset ids for the small sprite a crew member carries. */
export const heldAssets = (item: string): string[] => [`${item}.held`, 'prop.crate'];

interface Entry {
  root: Container;
  /** One sprite (and glow) per drawn unit; one in all for a single-sprite stack. */
  sprs: Sprite[];
  glows: (Sprite | null)[];
  src: StaticSprite;
}

type ItemDefs = Readonly<Record<string, ItemDef>>;

/**
 * Loose item stacks lying on floor tiles. An item with a `.unit` sprite shows one unit per twelfth of a full stack on the
 * slot grid (stackSlots.ts); others show one sprite sized by how full the stack is (`.s/.m/.l`).
 */
export function createItemView(world: World, atlas: Atlas, L: Layers, items: ItemDefs, host: ItemViewHost): ItemView {
  const entries = new Map<number, Entry>();

  function drop(e: Entry): void {
    e.root.destroy({ children: true });
  }

  function build(src: StaticSprite, units: number): Entry {
    const root = new Container();
    const sprs: Sprite[] = [];
    const glows: (Sprite | null)[] = [];
    for (let i = 0; i < Math.max(1, units); i++) {
      const o = units > 0 ? slotOffset(i) : { x: 0, y: 0 };
      const spr = new Sprite(src.tex);
      spr.position.set(o.x - src.ax, o.y - src.ay);
      root.addChild(spr);
      sprs.push(spr);
      let glow: Sprite | null = null;
      if (src.glow) {
        glow = new Sprite(src.glow);
        glow.blendMode = 'add';
        glow.position.copyFrom(spr.position);
        root.addChild(glow);
      }
      glows.push(glow);
    }
    L.sorted.addChild(root);
    return { root, sprs, glows, src };
  }

  function update(): void {
    const t = host.target();
    const live = new Set<number>();
    if (t) {
      const { grid } = t;
      const pulse = host.emergency() ? pulsePhase(animNow()) : -1;
      for (const id of world.query(ItemStackC)) {
        const st = world.get(id, ItemStackC);
        if (!st || !grid.inBounds(st.x, st.y)) continue;
        const size = items[st.item]?.stackSize ?? 50;
        const unit = atlas.firstOf([unitAsset(st.item), ...stackAssets(st.item, st.count, size)]);
        if (!unit) continue;
        const isUnit = unit === atlas.stat(unitAsset(st.item));
        const units = isUnit ? unitCount(st.count, size) : 0;
        live.add(id);
        let e = entries.get(id);
        if (e && (e.src !== unit || e.sprs.length !== Math.max(1, units))) {
          drop(e);
          e = undefined;
        }
        if (!e) entries.set(id, (e = build(unit, units)));
        // Stacks are in sector tiles; sprites are region-local (the region's containers sit at its sector offset).
        const p = iso(st.x - grid.x0, st.y - grid.y0);
        e.root.position.set(Math.round(p.x), Math.round(p.y));
        e.root.zIndex = depthKey(st.x - grid.x0, st.y - grid.y0) - 0.4;
        const tint = lightTint(grid.get('light', st.x, st.y), false, pulse);
        for (const s of e.sprs) s.tint = tint;
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

