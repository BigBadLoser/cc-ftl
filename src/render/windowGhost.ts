import { Container, Sprite } from 'pixi.js';
import { decodeWindow, windowCode, type WindowAxis } from '../sim/windows';
import type { Atlas } from './assets/loader';
import { iso } from './iso';
import { PREVIEW_BAD, PREVIEW_OK } from './markers';
import { windowChain } from './tiles';

/** The window being placed: its tiles (sector tiles, lower coordinate first) along `axis`, `size` of them. */
export interface WindowGhostSpec {
  tiles: readonly { x: number; y: number }[];
  axis: WindowAxis;
  size: number;
  valid: boolean;
}

export interface WindowGhost {
  set(g: WindowGhostSpec | null): void;
}

const ALPHA = 0.5;

/**
 * The Window tool's placement ghost: the window's own full-height pieces (the walls-up art, `windowChain`'s) over the run in the
 * preview tint (cyan, red when it cannot go there), added over what is below like the queued-window ghost. Drawn at every wall level,
 * so the window shows even with the walls cut.
 */
export function createWindowGhost(parent: Container, atlas: Atlas): WindowGhost {
  const root = new Container();
  root.visible = false;
  parent.addChild(root);
  const pool: Sprite[] = [];
  return {
    set(g) {
      let used = 0;
      if (g) {
        g.tiles.forEach((t, i) => {
          const win = decodeWindow(windowCode(g.axis, g.size, i));
          const a = atlas.firstOf(windowChain('tile.wall.full.', g.axis === 'x' ? 10 : 5, win));
          if (!a) return;
          const s = pool[used] ?? root.addChild(new Sprite());
          pool[used++] = s;
          const p = iso(t.x, t.y);
          s.texture = a.tex;
          s.position.set(Math.round(p.x - a.ax), Math.round(p.y - a.ay));
          s.tint = g.valid ? PREVIEW_OK : PREVIEW_BAD;
          s.alpha = ALPHA;
          s.blendMode = 'add';
          s.zIndex = p.y;
        });
      }
      root.sortableChildren = true;
      root.visible = used > 0;
      pool.forEach((s, i) => (s.visible = i < used));
    },
  };
}
