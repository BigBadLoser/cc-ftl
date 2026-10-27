import { Container, Graphics, RenderTexture, Sprite, type Renderer as PixiRenderer } from 'pixi.js';
import type { Ship } from '../sim/combat/components';
import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import { ModuleC } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { createCamera, type Camera } from './camera';
import { ROOF_H } from './heights';
import { ART_SCALE, iso, TILE_H, TILE_W } from './iso';
import { isTargetable } from './moduleArt';
import { sectorTileAt } from './scenePick';
import { footprintQuad, isoBracketSegments, MODULE_RISE, padQuad } from './targetBrackets';
import { rotatedSize } from '../sim/modules/footprint';
import type { Origin } from './sectorPos';

/** Where the combat overlay shows the enemy ship: a rectangle of the canvas in CSS px. */
export interface CombatViewRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The view's rectangle in device px of the world canvas (whole px, at least 1x1), from its CSS rectangle and the canvas's
 * device px per CSS px. The panel canvas is sized to it and the world canvas's pixels there are copied 1:1.
 */
export function viewDevicePx(rect: CombatViewRect, ratio: number): CombatViewRect {
  return {
    x: Math.round(rect.x * ratio),
    y: Math.round(rect.y * ratio),
    w: Math.max(1, Math.round(rect.w * ratio)),
    h: Math.max(1, Math.round(rect.h * ratio)),
  };
}

const PANEL_BG = 0x04070b;
/** Bracket colours: neutral is the theme's --dim, the ship-wide target its --red, weapon overrides its --cyan. */
const C_NEUTRAL = 0x7fa9c0;
const C_SHIP = 0xff5a5a;
const C_OWN = 0x36d4ff;
const C_OUTLINE = 0x05080d;

/** What the target brackets show (module ids; 0 or absent = none). */
export interface CombatMarks {
  shipTarget?: number;
  overrides: readonly number[];
  hover?: number;
  /** A weapon is armed ("tap enemy..."): all brackets pulse. */
  arming: boolean;
}

/** Scale that fits a span into a box: fractional so the ship fills the view (capped at 3 and floored at 0.25 against the 64 px-tile art, so those scale down with it). */
function fitScale(boxW: number, boxH: number, spanW: number, spanH: number): number {
  return Math.max(0.25 / ART_SCALE, Math.min(3 / ART_SCALE, boxW / spanW, boxH / spanH));
}

export interface CombatPassHost {
  world: World;
  modules: Readonly<Record<string, ModuleDef>>;
  ship(shipId: number): Ship | undefined;
  grid(shipId: number): Grid | undefined;
  origin(shipId: number): Origin;
  /** True if the shown region is roofed (the view is lifted to the roof top). */
  roofed(shipId: number): boolean;
  /** Device px per CSS px of the canvas. */
  ratio(): number;
  /**
   * Draw the stage for a camera: `cam` places the world, `target` is the region shown in the panel (null: the main pass).
   * The host positions its layers, culls, and toggles the per-pass layers (target marks in pass B only).
   */
  place(cam: Camera, target: number | null): void;
}

/**
 * The combat panel as camera pass B (ARCHITECTURE "Sector grid" §5): a second camera, centred and fitted on the target
 * region, renders the same world stack into a texture the size of `CombatViewRect`, which the main pass shows in place
 * (the texture is the scissor). No second sprite set.
 */
export interface CombatPass {
  /** The panel's sprite: add it to the stage above the world. */
  readonly sprite: Sprite;
  /**
   * Show a ship in the panel's view `canvas` (null hides it). The canvas's page rectangle is read at every render, so a
   * dragged or resized panel never shows a stale frame.
   */
  set(view: { shipId: number; canvas: HTMLCanvasElement } | null): void;
  /** Which brackets to draw over the targetable modules of the shown ship. */
  setMarks(marks: CombatMarks): void;
  /** The region shown, or null. */
  target(): number | null;
  /** Render pass B (before the main pass). */
  render(gl: PixiRenderer, stage: Container): void;
  /**
   * After the main pass: copy the view's pixels from the world canvas into the panel's own canvas (1:1 device px, a GPU
   * copy, same task as the render so the drawing buffer is still there). The panel then shows the ship opaquely, stacked
   * with the DOM like any other element, whatever lies under it.
   */
  present(source: HTMLCanvasElement): void;
  /** Module (0 = the hull itself) under a canvas-relative position inside the panel, or null if outside the ship. */
  pick(sx: number, sy: number): { moduleId: number } | null;
  dispose(): void;
}

export function createCombatPass(h: CombatPassHost): CombatPass {
  const cam = createCamera(3);
  const sprite = new Sprite();
  sprite.visible = false;
  // Brackets live in the sprite's space (panel device px, the camera's canvas), so they never scale with the art.
  const gfx = new Graphics();
  sprite.addChild(gfx);
  let marks: CombatMarks = { overrides: [], arming: false };
  let rt: RenderTexture | null = null;
  let view: { shipId: number; canvas: HTMLCanvasElement; rect: CombatViewRect } | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let geom: { x: number; y: number; w: number; h: number; lift: number } | null = null;

  function shown(): { ship: Ship; grid: Grid } | null {
    const ship = view && h.ship(view.shipId);
    const grid = view && h.grid(view.shipId);
    return ship && grid && ship.state !== 'fled' ? { ship, grid } : null;
  }

  /** Rebuild the bracket Graphics for the shown ship, projected with the same camera that `pick()` inverts. */
  function drawBrackets(grid: Grid, lift: number): void {
    gfx.clear();
    const k = h.ratio();
    const lw = k >= 2 ? 2 : 1.5;
    const pulse = marks.arming ? 0.6 + 0.4 * Math.sin(performance.now() / 220) : 1;
    const project = (ax: number, ay: number) => ({ x: Math.round(ax * cam.scale + cam.originX), y: Math.round(ay * cam.scale + cam.originY) });
    for (const id of h.world.query(ModuleC)) {
      const m = h.world.get(id, ModuleC);
      const def = m && h.modules[m.def];
      if (!m || !def || !isTargetable(def) || !grid.inBounds(m.x, m.y)) continue;
      const [w, ht] = rotatedSize(def, m.rot);
      const quad = footprintQuad(m.x, m.y, w, ht, { x: 0, y: 0 }, lift, project, MODULE_RISE);
      const hov = marks.hover === id;
      const own = marks.overrides.includes(id);
      const wide = marks.shipTarget === id;
      const color = wide ? C_SHIP : own ? C_OWN : hov ? 0xffffff : C_NEUTRAL;
      const alpha = (wide ? 1 : own ? 0.9 : hov ? 1 : marks.arming ? 0.7 : 0.55) * pulse;
      const pad = hov ? 2 : 0;
      const width = hov ? lw + 1 : lw;
      const segs = isoBracketSegments(padQuad(quad, pad));
      // A dark outline under each bracket keeps it readable on any roof colour.
      for (const sg of segs) gfx.moveTo(sg.x1, sg.y1).lineTo(sg.x2, sg.y2);
      gfx.stroke({ width: width + 2 * k, color: C_OUTLINE, alpha: 0.85 * alpha, cap: 'square' });
      for (const sg of segs) gfx.moveTo(sg.x1, sg.y1).lineTo(sg.x2, sg.y2);
      gfx.stroke({ width, color, alpha });
    }
  }

  return {
    sprite,
    set(v) {
      if (v?.canvas !== view?.canvas) ctx = null;
      view = v ? { ...v, rect: { x: 0, y: 0, w: 0, h: 0 } } : null;
      if (!v) geom = null;
    },
    setMarks(m) {
      marks = m;
    },
    target: () => (shown() && view ? view.shipId : null),
    render(gl, stage) {
      const s = shown();
      if (!s || !view) {
        geom = null;
        sprite.visible = false;
        return;
      }
      const box = view.canvas.getBoundingClientRect();
      view.rect = { x: box.left, y: box.top, w: box.width, h: box.height };
      if (!view.canvas.isConnected || box.width <= 0 || box.height <= 0) {
        geom = null;
        sprite.visible = false;
        return;
      }
      const k = h.ratio();
      const { x, y, w, h: ht } = viewDevicePx(view.rect, k);
      const lift = h.roofed(view.shipId) ? ROOF_H : 0;
      const { ship } = s;
      const spanW = (ship.width + ship.height) * (TILE_W / 2) + TILE_W;
      const spanH = (ship.width + ship.height) * (TILE_H / 2) + TILE_H * 2 + lift;
      const o = h.origin(view.shipId);
      const c = iso(o.x + ship.width / 2 - 0.5, o.y + ship.height / 2 - 0.5);
      // Device px straight in (ratio 1): the camera's canvas is the panel rectangle.
      cam.resize(w, ht, 1);
      cam.setExactScale(fitScale(w - 8, ht - 8, spanW, spanH));
      cam.centerOn(c.x, c.y - lift / 2);
      geom = { x, y, w, h: ht, lift };
      if (!rt || rt.width !== w || rt.height !== ht) {
        rt?.destroy(true);
        rt = RenderTexture.create({ width: w, height: ht, resolution: 1 });
        sprite.texture = rt;
      }
      sprite.visible = false;
      h.place(cam, view.shipId);
      gl.render({ container: stage, target: rt, clear: true, clearColor: PANEL_BG });
      sprite.position.set(x, y);
      sprite.visible = true;
      drawBrackets(s.grid, lift);
    },
    present(source) {
      const g = geom;
      if (!g || !view) return;
      const c = view.canvas;
      if (c.width !== g.w || c.height !== g.h) {
        c.width = g.w;
        c.height = g.h;
        ctx = null;
      }
      ctx ??= c.getContext('2d', { alpha: false });
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#04070b';
      ctx.fillRect(0, 0, g.w, g.h); // the part of the view off the world canvas (a panel dragged past the edge)
      ctx.drawImage(source, g.x, g.y, g.w, g.h, 0, 0, g.w, g.h);
    },
    pick(sx, sy) {
      const g = geom;
      const grid = view && h.grid(view.shipId);
      if (!g || !view || !grid) return null;
      const k = h.ratio();
      const dx = sx * k - g.x;
      const dy = sy * k - g.y;
      if (dx < 0 || dy < 0 || dx >= g.w || dy >= g.h) return null;
      const a = cam.toArt(dx, dy);
      const t = sectorTileAt({ x: a.x, y: a.y + g.lift });
      if (!grid.inBounds(t.x, t.y)) return null;
      // The nearest targetable module within a tile (tiles are small on a phone).
      const targetable = (def: string) => { const md = h.modules[def]; return !!md && isTargetable(md); };
      let best = 0;
      let bestD = Infinity;
      for (let ty = t.y - 1; ty <= t.y + 1; ty++)
        for (let tx = t.x - 1; tx <= t.x + 1; tx++) {
          if (!grid.inBounds(tx, ty)) continue;
          const id = grid.get('module', tx, ty);
          const m = id ? h.world.get(id, ModuleC) : undefined;
          const d = Math.hypot(tx - t.x, ty - t.y);
          if (m && (d === 0 || targetable(m.def)) && d < bestD) {
            best = id;
            bestD = d;
          }
        }
      return { moduleId: best };
    },
    dispose() {
      rt?.destroy(true);
      sprite.destroy();
    },
  };
}
