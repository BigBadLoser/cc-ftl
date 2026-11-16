import { Container, Sprite } from 'pixi.js';
import { decodeWindow, windowCode, type WindowAxis } from '../sim/windows';
import type { Atlas } from './assets/loader';
import type { Grid } from '../sim/grid';
import { Struct } from '../sim/structure';
import { hullKeys, windowExteriorId, type HullKeys } from './hullArt';
import { iso } from './iso';
import { PREVIEW_BAD, PREVIEW_OK } from './markers';
import { artKind, windowChain } from './tiles';

/** The window being placed: its tiles (sector tiles, lower coordinate first) along `axis`, `size` of them. */
export interface WindowGhostSpec {
  /** The ship the run is on (its grid gives the hull the exterior pieces come from). */
  ship: number;
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
 * The Window tool's placement ghost: the window's own full-height pieces (the walls-up art, `windowChain`'s; on a straight near hull run the hull window's exterior piece) over the run in the
 * preview tint (cyan, red when it cannot go there), added over what is below like the queued-window ghost. Drawn at every wall level,
 * so the window shows even with the walls cut.
 */
export function createWindowGhost(parent: Container, atlas: Atlas, gridOf: (ship: number) => Grid | undefined): WindowGhost {
  const root = new Container();
  root.visible = false;
  parent.addChild(root);
  const pool: Sprite[] = [];
  let memo: { grid: Grid; rev: number; keys: HullKeys | null } | undefined;
  /** The hull of the ship as it stands (kept until its struct changes). */
  const hullOf = (grid: Grid): HullKeys | null => {
    const rev = grid.revision('struct');
    if (memo?.grid !== grid || memo.rev !== rev) memo = { grid, rev, keys: hullKeys((x, y) => (grid.inBounds(grid.x0 + x, grid.y0 + y) ? artKind(grid.get('struct', grid.x0 + x, grid.y0 + y)) : Struct.Space), grid.width, grid.height) };
    return memo.keys;
  };
  return {
    set(g) {
      let used = 0;
      if (g) {
        g.tiles.forEach((t, i) => {
          const win = decodeWindow(windowCode(g.axis, g.size, i));
          const grid = gridOf(g.ship);
          const has = (id: string) => !!atlas.stat(id);
          // A straight near run: the hull window's exterior piece (what the roofed ship draws); anything else the interior full piece.
          // No hull keys (an asteroid base with rock or ground): the interior piece.
          const keys = grid && win ? hullOf(grid) : null;
          const ext = grid && win && keys ? windowExteriorId(keys, t.x - grid.x0, t.y - grid.y0, has, win) : null;
          const a = atlas.firstOf(ext ? [ext] : windowChain('tile.wall.full.', g.axis === 'x' ? 10 : 5, win));
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
