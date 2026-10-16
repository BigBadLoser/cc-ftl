import type { Sprite } from 'pixi.js';
import type { Atlas } from './assets/loader';
import type { Grid } from '../sim/grid';
import { Struct } from '../sim/structure';
import { depthKey } from './iso';
import type { Layers } from './layers';
import { createMarkers, type Markers } from './markers';
import { createOverlay, type Overlay } from './overlay';
import { addStatic } from './sprites';
import { floorChain, isLowered, wallChains } from './tiles';

export type CutawayMode = 'auto' | 'up' | 'down';

export interface GridView extends Markers {
  readonly grid: Grid;
  update(): void;
  setCutaway(mode: CutawayMode): void;
  setOverlay(field: string | null): void;
  dispose(): void;
}

/** Floors, walls, hull and doors of one grid, rebuilt whenever the struct revision or cutaway mode changes. */
export function createGridView(grid: Grid, atlas: Atlas, L: Layers): GridView {
  const markers = createMarkers(L.ui);
  const overlay: Overlay = createOverlay(grid, L.decal);
  let owned: Sprite[] = [];
  let mode: CutawayMode = 'auto';
  let builtMode: CutawayMode | null = null;
  let rev = -1;

  const kindAt = (x: number, y: number): number => (grid.inBounds(x, y) ? grid.get('struct', x, y) : Struct.Space);

  function clear(): void {
    for (const s of owned) s.destroy();
    owned = [];
  }

  function rebuild(): void {
    clear();
    for (let y = 0; y < grid.height; y++)
      for (let x = 0; x < grid.width; x++) {
        const k = kindAt(x, y);
        if (k === Struct.Space) continue;
        if (k === Struct.Floor || k === Struct.Door) {
          const f = atlas.firstOf(floorChain(x, y));
          if (f) owned.push(...addStatic(L, f, x, y, 0, L.floor));
        }
        if (k === Struct.Floor) continue;
        const low = isLowered(kindAt, x, y, mode);
        for (const chain of wallChains(kindAt, x, y, k, low)) {
          const s = atlas.firstOf(chain);
          if (s) owned.push(...addStatic(L, s, x, y, depthKey(x, y), L.sorted));
        }
      }
    builtMode = mode;
  }

  return {
    ...markers,
    grid,
    update() {
      const r = grid.revision('struct');
      if (r !== rev || builtMode !== mode) {
        rebuild();
        rev = r;
      }
      overlay.update();
    },
    setCutaway(m) {
      mode = m;
    },
    setOverlay: (f) => overlay.setField(f),
    dispose() {
      clear();
      for (const layer of [L.decal, L.ui]) for (const c of layer.removeChildren()) c.destroy({ children: true });
    },
  };
}
