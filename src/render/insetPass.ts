import { Container, RenderTexture, Sprite, type Renderer as PixiRenderer } from 'pixi.js';
import type { Ship } from '../sim/combat/components';
import { createCamera, type Camera } from './camera';
import { ROOF_H } from './heights';
import { ART_SCALE, iso, TILE_H, TILE_W } from './iso';
import type { Origin } from './sectorPos';

/** Where the inset shows a ship: a rectangle of the canvas in CSS px. */
export interface InsetRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The view's rectangle in device px of the world canvas (whole px, at least 1x1), from its CSS rectangle and the canvas's
 * device px per CSS px. The inset canvas is sized to it and the world canvas's pixels there are copied 1:1.
 */
export function viewDevicePx(rect: InsetRect, ratio: number): InsetRect {
  return {
    x: Math.round(rect.x * ratio),
    y: Math.round(rect.y * ratio),
    w: Math.max(1, Math.round(rect.w * ratio)),
    h: Math.max(1, Math.round(rect.h * ratio)),
  };
}

const PANEL_BG = 0x04070b;

/** Scale that fits a span into a box: fractional so the ship fills the view (capped at 3 and floored at 0.25 against the 64 px-tile art). */
function fitScale(boxW: number, boxH: number, spanW: number, spanH: number): number {
  return Math.max(0.25 / ART_SCALE, Math.min(3 / ART_SCALE, boxW / spanW, boxH / spanH));
}

export interface InsetPassHost {
  ship(shipId: number): Ship | undefined;
  origin(shipId: number): Origin;
  /** True if the shown region is roofed (the view is lifted to the roof top). */
  roofed(shipId: number): boolean;
  /** Device px per CSS px of the canvas. */
  ratio(): number;
  /** Place the world for a camera pass (`target` is the region shown in the inset). */
  place(cam: Camera, target: number | null): void;
}

/**
 * The combat inset: camera pass B. A second camera, fitted on one ship, renders the same world stack into a texture the size of the inset's canvas,
 * which the main pass draws in place of that element (the page's canvas sits behind the DOM, so the element is a transparent window onto it). No second sprite set; crew, fires, breaches and
 * the threat markers all draw in it, because it is the same scene.
 */
export interface InsetPass {
  /** The inset's sprite: add it to the stage above the world (the main pass draws the texture in place). */
  readonly sprite: Sprite;
  /** Show a ship in `view.view` (null hides it). The canvas's page rectangle is read at every render. */
  set(view: { shipId: number; view: HTMLElement } | null): void;
  /** The ship shown, or null. */
  target(): number | null;
  /** Render pass B (before the main pass). `after` runs once the world is placed for the inset camera, before it draws (so scale-dependent overlays can redraw). */
  render(gl: PixiRenderer, stage: Container, after?: () => void): void;
  dispose(): void;
}

export function createInsetPass(h: InsetPassHost): InsetPass {
  const cam = createCamera(3);
  const sprite = new Sprite();
  sprite.visible = false;
  let rt: RenderTexture | null = null;
  let view: { shipId: number; view: HTMLElement } | null = null;

  return {
    sprite,
    set(v) {
      view = v;
    },
    target: () => (view && h.ship(view.shipId) && h.ship(view.shipId)?.state !== 'fled' ? view.shipId : null),
    render(gl, stage, after) {
      const ship = view && h.ship(view.shipId);
      if (!view || !ship || ship.state === 'fled') {
        sprite.visible = false;
        return;
      }
      const box = view.view.getBoundingClientRect();
      if (!view.view.isConnected || box.width <= 0 || box.height <= 0) {
        sprite.visible = false;
        return;
      }
      const { x, y, w, h: ht } = viewDevicePx({ x: box.left, y: box.top, w: box.width, h: box.height }, h.ratio());
      const lift = h.roofed(view.shipId) ? ROOF_H : 0;
      const spanW = (ship.width + ship.height) * (TILE_W / 2) + TILE_W * 0.2;
      const spanH = (ship.width + ship.height) * (TILE_H / 2) + TILE_H * 1.1 + lift;
      const o = h.origin(view.shipId);
      const c = iso(o.x + ship.width / 2 - 0.5, o.y + ship.height / 2 - 0.5);
      cam.resize(w, ht, 1);
      cam.setExactScale(fitScale(w - 6, ht - 6, spanW, spanH), true);
      cam.centerOn(c.x, c.y - lift / 2);
      if (!rt || rt.width !== w || rt.height !== ht) {
        rt?.destroy(true);
        rt = RenderTexture.create({ width: w, height: ht, resolution: 1 });
        sprite.texture = rt;
      }
      sprite.visible = false;
      h.place(cam, view.shipId);
      after?.();
      gl.render({ container: stage, target: rt, clear: true, clearColor: PANEL_BG });
      sprite.position.set(x, y);
      sprite.visible = true;
    },
    dispose() {
      rt?.destroy(true);
      sprite.destroy();
    },
  };
}
