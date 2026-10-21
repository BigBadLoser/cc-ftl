import { Graphics, type Container } from 'pixi.js';
import type { Grid } from '../sim/grid';
import { Struct } from '../sim/structure';
import { ROCK_MASS_Z } from './asteroidView';
import { Z_PX } from './heights';
import { iso, TILE_H, TILE_W } from './iso';

/**
 * PLACEHOLDER rock roof for a dug outpost (procedural while art is pending): with the roof on, every tile the base owns is
 * capped by a rock-mass top at ROCK_MASS_Z, the same block the asteroid's rock is drawn with, so from outside the base reads as
 * plain asteroid. With the roof off (cutaway) it hides and the carved interior shows. Region-local art (tile (0, 0) = the
 * region's top-left); sizes from TILE_W / TILE_H and Z_PX. Rebuilt on the region's struct revision.
 */
export interface RockRoofView {
  setVisible(on: boolean): void;
  update(): void;
  dispose(): void;
}

const TOP = 0x5c5854;

export function createRockRoofView(grid: Grid, layer: Container): RockRoofView {
  const g = new Graphics();
  layer.addChild(g);
  g.zIndex = grid.width + grid.height + 2;
  let rev = -1;
  const draw = () => {
    g.clear();
    const hw = TILE_W / 2, hh = TILE_H / 2, tall = ROCK_MASS_Z * Z_PX;
    const own = (x: number, y: number) => grid.inBounds(x, y) && grid.get('ship', x, y) === grid.id && grid.get('struct', x, y) !== Struct.Space;
    const capped = (x: number, y: number) => own(x, y) || (grid.inBounds(x, y) && grid.get('struct', x, y) === Struct.Rock);
    for (let d = 0; d <= grid.width + grid.height - 2; d++) {
      for (let lx = Math.max(0, d - grid.height + 1); lx <= Math.min(grid.width - 1, d); lx++) {
        const x = grid.x0 + lx, y = grid.y0 + d - lx;
        if (!own(x, y)) continue;
        const c = iso(lx, d - lx);
        const top = c.y - tall;
        if (!capped(x, y + 1)) g.poly([c.x - hw, top, c.x, top + hh, c.x, c.y + hh, c.x - hw, c.y]).fill(0x403d3a);
        if (!capped(x + 1, y)) g.poly([c.x, top + hh, c.x + hw, top, c.x + hw, c.y, c.x, c.y + hh]).fill(0x2e2c2a);
        g.poly([c.x, top - hh, c.x + hw, top, c.x, top + hh, c.x - hw, top]).fill(TOP);
      }
    }
  };
  return {
    setVisible(on) {
      g.visible = on;
    },
    update() {
      const r = grid.revision('struct');
      if (r !== rev && g.visible) {
        rev = r;
        draw();
      }
    },
    dispose() {
      g.destroy();
    },
  };
}
