import { Container, Sprite } from 'pixi.js';
import { diamondTextures } from './diamonds';
import { iso } from './iso';

type Tile = { x: number; y: number };

const CYAN = 0x22d3ee;

/** Pixel-stepped diamond outlines for selection, hover and the drag-build preview. */
export interface Markers {
  setSelection(t: Tile | null): void;
  setHover(t: Tile | null): void;
  setPreview(tiles: readonly Tile[]): void;
}

export function createMarkers(parent: Container): Markers {
  const tex = diamondTextures().outline;
  const make = (alpha: number) => {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.tint = CYAN;
    s.alpha = alpha;
    s.visible = false;
    parent.addChild(s);
    return s;
  };
  const put = (s: Sprite, t: Tile | null) => {
    s.visible = t !== null;
    if (t) {
      const p = iso(t.x, t.y);
      s.position.set(p.x, p.y);
    }
  };
  const sel = make(1);
  const hover = make(0.45);
  const pool: Sprite[] = [];
  return {
    setSelection: (t) => put(sel, t),
    setHover: (t) => put(hover, t),
    setPreview(tiles) {
      while (pool.length < tiles.length) pool.push(make(0.7));
      pool.forEach((s, i) => put(s, tiles[i] ?? null));
    },
  };
}
