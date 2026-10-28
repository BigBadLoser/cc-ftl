import { Container, Graphics } from 'pixi.js';
import { iso } from './iso';

const COLOR = 0x22d3ee;
const ALPHA = 0.16;

/**
 * The world tile grid for the build tools: one-pixel lines (Pixi's `pixelLine`, so they stay one device pixel at every zoom) along every tile edge of the
 * sector, drawn under the markers and plan ghosts. Built once per sector size; `set(false)` hides it.
 */
export interface WorldGrid {
  set(on: boolean, width: number, height: number): void;
}

export function createWorldGrid(parent: Container): WorldGrid {
  const g = new Graphics();
  g.visible = false;
  parent.addChildAt(g, 0);
  let built = '';
  return {
    set(on, w, h) {
      g.visible = on;
      if (!on || built === `${w}x${h}`) return;
      built = `${w}x${h}`;
      g.clear();
      // Tile (x, y) is a diamond centred on iso(x, y): its edges lie on the half-integer lines.
      for (let x = 0; x <= w; x++) {
        const a = iso(x - 0.5, -0.5), b = iso(x - 0.5, h - 0.5);
        g.moveTo(a.x, a.y).lineTo(b.x, b.y);
      }
      for (let y = 0; y <= h; y++) {
        const a = iso(-0.5, y - 0.5), b = iso(w - 0.5, y - 0.5);
        g.moveTo(a.x, a.y).lineTo(b.x, b.y);
      }
      g.stroke({ color: COLOR, alpha: ALPHA, width: 1, pixelLine: true });
    },
  };
}
