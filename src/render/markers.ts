import { Container, Sprite } from 'pixi.js';
import { diamondTextures } from './diamonds';
import { iso } from './iso';

type Tile = { x: number; y: number };

const CYAN = 0x22d3ee;
const BAD = 0xff4d4d;

/** Pixel-stepped diamond outlines for selection, hover and the drag/footprint build preview. */
export interface Markers {
  /** One tile, or every tile of a footprint. */
  setSelection(t: Tile | readonly Tile[] | null): void;
  setHover(t: Tile | null): void;
  /** `valid` false tints the preview red (blocked placement). */
  setPreview(tiles: readonly Tile[], valid?: boolean): void;
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
  const hover = make(0.45);
  const sel: Sprite[] = [];
  const pool: Sprite[] = [];
  return {
    setSelection(t) {
      const tiles = t === null ? [] : Array.isArray(t) ? (t as readonly Tile[]) : [t as Tile];
      while (sel.length < tiles.length) sel.push(make(1));
      sel.forEach((s, i) => put(s, tiles[i] ?? null));
    },
    setHover: (t) => put(hover, t),
    setPreview(tiles, valid = true) {
      while (pool.length < tiles.length) pool.push(make(0.75));
      pool.forEach((s, i) => {
        s.tint = valid ? CYAN : BAD;
        put(s, tiles[i] ?? null);
      });
    },
  };
}
