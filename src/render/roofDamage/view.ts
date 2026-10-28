import { CanvasSource, Sprite, Texture } from 'pixi.js';
import type { World } from '../../sim/ecs';
import type { Grid } from '../../sim/grid';
import type { Atlas } from '../assets/loader';
import { depthKey } from '../iso';
import type { Layers } from '../layers';
import type { RegionTiles } from '../regionTiles';
import { roofTint } from '../roofPlating';
import { damageStore, type DamageTile } from './store';

export interface RoofDamageView {
  update(): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}

/**
 * Battle damage on a ship's roof plating: the ship's damage store (store.ts) shown as one overlay sprite per damaged roof
 * tile, just above its plating and livery and shaded like it. The store outlives this view (it keeps painting).
 */
export function createRoofDamage(grid: Grid, tiles: RegionTiles, atlas: Atlas, L: Layers, world: World): RoofDamageView {
  const store = damageStore(grid);
  const sprites = new Map<number, Sprite>();
  let visible = true;

  function painted(idx: number, t: DamageTile): void {
    const had = sprites.get(idx);
    if (had) {
      had.texture.source.update();
      return;
    }
    const sprite = new Sprite(new Texture({ source: new CanvasSource({ resource: t.canvas, scaleMode: 'nearest' }) }));
    sprite.scale.set(2);
    sprite.position.set(t.left * 2, t.top * 2);
    sprite.zIndex = depthKey(t.x, t.y) + 0.906;
    sprite.tint = roofTint(t.x, t.y, tiles.width, tiles.height);
    sprite.visible = visible;
    L.sorted.addChild(sprite);
    sprites.set(idx, sprite);
  }

  function dropped(idx: number): void {
    const s = sprites.get(idx);
    if (!s) return;
    s.texture.destroy(true);
    s.destroy();
    sprites.delete(idx);
  }

  for (const [idx, t] of store.tiles) painted(idx, t);
  const watcher = { painted, dropped };
  store.watch(watcher);

  return {
    update() {
      store.update(tiles, atlas, world);
    },
    setVisible(v) {
      visible = v;
      for (const s of sprites.values()) s.visible = v;
    },
    dispose() {
      store.watch(null);
      for (const idx of [...sprites.keys()]) dropped(idx);
    },
  };
}
