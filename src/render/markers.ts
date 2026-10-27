import { Container, Sprite } from 'pixi.js';
import { diamondTextures } from './diamonds';
import { Z_PX } from './heights';
import { iso } from './iso';

/** `lift`: tiles of height above the ground the marker is drawn at (the top of a rock block). */
type Tile = { x: number; y: number; lift?: number };

const CYAN = 0x22d3ee;
const BAD = 0xff4d4d;

/** Pixel-stepped diamond outlines for selection, hover and the drag/footprint build preview. */
export interface Markers {
  /** One tile, or every tile of a footprint. */
  setSelection(t: Tile | readonly Tile[] | null): void;
  setHover(t: Tile | null): void;
  /** `valid` false tints the preview red (blocked placement). */
  setPreview(tiles: readonly Tile[], valid?: boolean): void;
  /** Painted areas: each group's tiles filled and outlined in its colour (the shipyard plan, later the construction pod's). Empty clears. */
  setAreas(groups: readonly AreaMarks[]): void;
}

/** One group of painted tiles: `tint` is an 0xRRGGBB colour; `solid` fills the diamond, otherwise only its outline shows. */
export interface AreaMarks {
  tiles: readonly Tile[];
  tint: number;
  solid?: boolean;
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
      s.position.set(p.x, p.y - (t.lift ?? 0) * Z_PX);
    }
  };
  const hover = make(0.45);
  const fills: Sprite[] = [];
  const outlines: Sprite[] = [];
  const area = (pool: Sprite[], n: number, texture: typeof tex, alpha: number): Sprite => {
    if (pool.length <= n) {
      const s = new Sprite(texture);
      s.anchor.set(0.5);
      s.alpha = alpha;
      parent.addChild(s);
      pool.push(s);
    }
    return pool[n] as Sprite;
  };
  const sel: Sprite[] = [];
  const pool: Sprite[] = [];
  return {
    setSelection(t) {
      const tiles = t === null ? [] : Array.isArray(t) ? (t as readonly Tile[]) : [t as Tile];
      while (sel.length < tiles.length) sel.push(make(1));
      sel.forEach((s, i) => put(s, tiles[i] ?? null));
    },
    setHover: (t) => put(hover, t),
    setAreas(groups) {
      let f = 0;
      let o = 0;
      for (const g of groups) {
        for (const t of g.tiles) {
          const p = iso(t.x, t.y);
          if (g.solid) {
            const s = area(fills, f++, diamondTextures().fill, 0.3);
            s.tint = g.tint;
            s.position.set(p.x, p.y);
            s.visible = true;
          }
          const s = area(outlines, o++, tex, 0.9);
          s.tint = g.tint;
          s.position.set(p.x, p.y);
          s.visible = true;
        }
      }
      for (let i = f; i < fills.length; i++) (fills[i] as Sprite).visible = false;
      for (let i = o; i < outlines.length; i++) (outlines[i] as Sprite).visible = false;
    },
    setPreview(tiles, valid = true) {
      while (pool.length < tiles.length) pool.push(make(0.75));
      pool.forEach((s, i) => {
        s.tint = valid ? CYAN : BAD;
        put(s, tiles[i] ?? null);
      });
    },
  };
}
