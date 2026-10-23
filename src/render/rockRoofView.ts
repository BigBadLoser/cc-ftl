import { Container, type Sprite } from 'pixi.js';
import type { Grid } from '../sim/grid';
import { Struct } from '../sim/structure';
import type { Atlas } from './assets/loader';
import { massChain, MASS_DZ } from './asteroidView';
import type { Layers } from './layers';
import { addStatic } from './sprites';

/**
 * Rock roof for a dug outpost: with the roof on, every tile the base owns is capped by a rock-mass block (`rock.mass.*`, the
 * same blocks the asteroid's rock is drawn with, joined to the rock around it), so from outside the base reads as plain
 * asteroid. With the roof off (cutaway) it hides and the carved interior shows. Region-local art (tile (0, 0) = the region's
 * top-left). Rebuilt on the region's struct revision.
 */
export interface RockRoofView {
  setVisible(on: boolean): void;
  update(): void;
  dispose(): void;
}

export function createRockRoofView(grid: Grid, atlas: Atlas, L: Layers, layer: Container): RockRoofView {
  const root = new Container();
  layer.addChild(root);
  root.zIndex = grid.width + grid.height + 2;
  const made: Sprite[] = [];
  let rev = -1;
  const draw = () => {
    for (const s of made.splice(0)) s.destroy();
    const own = (x: number, y: number) => grid.inBounds(x, y) && grid.get('ship', x, y) === grid.id && grid.get('struct', x, y) !== Struct.Space;
    const capped = (x: number, y: number) => own(x, y) || (grid.inBounds(x, y) && grid.get('struct', x, y) === Struct.Rock);
    for (let d = 0; d <= grid.width + grid.height - 2; d++) {
      for (let lx = Math.max(0, d - grid.height + 1); lx <= Math.min(grid.width - 1, d); lx++) {
        const x = grid.x0 + lx, y = grid.y0 + d - lx;
        if (!own(x, y)) continue;
        const s = atlas.firstOf(massChain((dx, dy) => capped(x + dx, y + dy), x, y));
        if (s) made.push(...addStatic(L, s, lx, d - lx, MASS_DZ, root));
      }
    }
  };
  return {
    setVisible(on) {
      root.visible = on;
    },
    update() {
      const r = grid.revision('struct');
      if (r !== rev && root.visible) {
        rev = r;
        draw();
      }
    },
    dispose() {
      root.destroy({ children: true });
    },
  };
}
