/** What the starmap levels share: the camera and scene they are given, drawing helpers, and the lazily built, culled pieces. */
import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { UiStarmap, UiStarNode, UiStarRoute } from '../../ui/starmapApi';
import type { ArtTextures } from './art';
import { toneTint } from './tint';
import type { Ops } from './pixel';
import type { Palette } from './palette';

/** The map camera: view centre (map units), scale (screen px per map unit) and the view's size in screen px. */
export interface Cam {
  cx: number;
  cy: number;
  s: number;
  w: number;
  h: number;
  dpr: number;
}

/** The ship's glide while a jump animates (map units): its position on the lane and the lane's ends. */
export interface Glide {
  x: number;
  y: number;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
}

/** What the screen state draws: set by the UI, the same fields the SVG levels took as props. */
export interface Scene {
  map: UiStarmap;
  current: UiStarNode | null;
  selected: string | null;
  hover: string | null;
  picked: string | null;
  route: UiStarRoute | null;
  /** The plotted route, flat x, y pairs. */
  routePts: number[];
  routeSectors: ReadonlySet<string>;
  only: ReadonlySet<string> | null;
  /** Screen px at the right edge that the drawer covers. */
  inset: number;
}

/** The art and palette a level draws with. */
export interface Ctx {
  art: ArtTextures | null;
  pal: Palette;
  dpr: number;
}

export interface Level {
  readonly root: Container;
  /** A new scene (selection, hover, route...) or camera: redraw what depends on it. */
  scene(sc: Scene): void;
  camera(cam: Cam): void;
  glide(g: Glide | null): void;
  /** Advance animations to `now` (ms); true while the level still needs frames ('fast': at the display rate, else 30 fps). */
  tick(now: number): boolean | 'fast';
  /** The tooltip of what is at a screen point of the view, if any. */
  tip(px: number, py: number): string | null;
  destroy(): void;
}

export interface View {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const viewOf = (c: Cam): View => ({ x0: c.cx - c.w / 2 / c.s, y0: c.cy - c.h / 2 / c.s, x1: c.cx + c.w / 2 / c.s, y1: c.cy + c.h / 2 / c.s });

/** Fill a Graphics with ops in white (tint and alpha colour it later, so a state change never rebuilds it). */
export function drawOps(gfx: Graphics, o: Ops): void {
  for (let i = 0; i < o.r.length; i += 4) gfx.rect(o.r[i]!, o.r[i + 1]!, o.r[i + 2]!, o.r[i + 3]!);
  for (const q of o.q) gfx.poly(q, true);
  gfx.fill(0xffffff);
}

/** Fill ops with a colour at an alpha, on a Graphics that may hold other fills. */
export function fillOps(gfx: Graphics, o: Ops, color: number, alpha = 1): void {
  if (!o.r.length && !o.q.length) return;
  for (let i = 0; i < o.r.length; i += 4) gfx.rect(o.r[i]!, o.r[i + 1]!, o.r[i + 2]!, o.r[i + 3]!);
  for (const q of o.q) gfx.poly(q, true);
  gfx.fill({ color, alpha });
}

/**
 * The crisp size of an icon (ARCHITECTURE.md, "Starmap art"): a whole number k >= 1 of device px per art px, the nearest to
 * `target` screen px, never smaller than the art. Returns the drawn size in screen px.
 */
export function crispPx(frame: number, target: number, dpr: number): number {
  const k = Math.max(1, Math.round((target * dpr) / frame));
  return (frame * k) / dpr;
}

/** Below this map scale icons are drawn at half size (the sheet's frames halved, then whole device px per texel): far out they would be huge. */
export const HALF_BELOW = 1.4;

/** An icon's size in screen px: the (half-size or full) frame at a whole number of device px per texel, never below one. */
export function iconSize(frame: number, s: number, dpr: number): number {
  const tex = s < HALF_BELOW ? frame / 2 : frame;
  return (tex * Math.max(1, Math.round(dpr))) / dpr;
}

/**
 * One frame centred on (x, y), `size` map units square, with its glow twin screen-blended over it (and the owner's livery if `tone`).
 * `half`: the half-size frames (see HALF_BELOW). `smooth`: not snapped to device px, for sprites that glide (the orbits).
 */
export function spriteAt(ctx: Ctx, id: string, x: number, y: number, size: number, tone: string | null = null, half = false, smooth = false): Container | null {
  const art = ctx.art;
  const f = art?.art.frames[id];
  if (!art || !f) return null;
  const box = new Container();
  box.eventMode = 'none';
  box.position.set(x, y);
  const put = (tex: Texture | null, screen = false) => {
    if (!tex) return;
    const sp = new Sprite({ texture: tex, roundPixels: !smooth });
    sp.eventMode = 'none';
    sp.anchor.set(0.5);
    sp.scale.set(size / (half ? f.w / 2 : f.w), size / (half ? f.h / 2 : f.h));
    if (screen) sp.blendMode = 'screen';
    box.addChild(sp);
  };
  if (tone) {
    const t = toneTint(tone);
    put(art.tinted(id, t.cloth, t.accent, half));
  } else put(art.frame(id, false, half));
  if (f.glow) put(art.frame(id, true, half), true);
  return box;
}

/** A piece of the map drawn when it comes into view and again whenever the grid changes (`at`); its box is in map units. */
export interface Piece {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  gfx: Graphics;
  /** Draw into `gfx` (already cleared) for grid `g`. */
  build(gfx: Graphics, g: number): void;
  /** Drawn the same at any grid (an area fill): built once. */
  independent: boolean;
  /** The grid it was drawn for (NaN: stale or not yet drawn). */
  at: number;
}

export function piece(parent: Container, box: [number, number, number, number], build: Piece['build'], independent = false): Piece {
  const gfx = new Graphics({ roundPixels: true });
  gfx.eventMode = 'none';
  gfx.visible = false;
  parent.addChild(gfx);
  return { x0: box[0], y0: box[1], x1: box[2], y1: box[3], gfx, build, independent, at: Number.NaN };
}

/** Show the pieces that touch the view (a margin of `m` map units) and draw those whose grid is stale; hide the rest. */
export function syncPieces(pieces: readonly Piece[], v: View, g: number, m: number): void {
  for (const p of pieces) {
    const vis = p.x1 >= v.x0 - m && p.x0 <= v.x1 + m && p.y1 >= v.y0 - m && p.y0 <= v.y1 + m;
    p.gfx.visible = vis;
    if (!vis) continue;
    const want = p.independent ? 0 : g;
    if (p.at !== want) {
      p.gfx.clear();
      p.build(p.gfx, g);
      p.at = want;
    }
  }
}

/** Mark every piece stale (a state change that is drawn into them). */
export function staleAll(pieces: readonly Piece[]): void {
  for (const p of pieces) p.at = Number.NaN;
}

/** The bounding box of flat x, y points, grown by `m`. */
export function boxOf(pts: ArrayLike<number>, m = 0): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i + 1 < pts.length; i += 2) {
    x0 = Math.min(x0, pts[i]!);
    x1 = Math.max(x1, pts[i]!);
    y0 = Math.min(y0, pts[i + 1]!);
    y1 = Math.max(y1, pts[i + 1]!);
  }
  return [x0 - m, y0 - m, x1 + m, y1 + m];
}
