import { autoDetectRenderer, Container, Graphics } from 'pixi.js';
import { CombatC, ShipC, WeaponC, type Ship } from '../sim/combat/components';
import type { World } from '../sim/ecs';
import type { SimEvent } from '../sim/events';
import type { Grid } from '../sim/grid';
import { ModuleC } from '../sim/modules/components';
import type { ItemDef, ModuleDef, WeaponDef } from '../sim/registry';
import { loadAtlas } from './assets/loader';
import { createCamera } from './camera';
import type { CutawayMode } from './gridView';
import { iso, tileAt, TILE_H, TILE_W } from './iso';
import { createParticles } from './fx/particles';
import { createLayers } from './layers';
import type { ModuleDefs } from './moduleView';
import { ROOF_H } from './roofView';
import { createSectorFx } from './sectorFx';
import { createShipScene, type ShipScene } from './shipScene';

export type { CutawayMode };
export type Quality = 'high' | 'low';

export interface RenderInfo {
  /** Display objects drawn last frame (floors, walls, crew layers, glow...). */
  sprites: number;
  /** Integer zoom step. */
  zoom: number;
}

type Tile = { x: number; y: number };

/** Where the combat overlay shows the enemy ship: a rectangle of the canvas in CSS px. */
export interface CombatViewRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Renderer {
  render(alpha: number): void;
  resize(): void;
  dispose(): void;
  /** The grids of the sector, by id. Ships are drawn for every ShipC whose grid is here. */
  setGrids(grids: ReadonlyMap<number, Grid>): void;
  /** Make this grid the one the camera, picking and the editing markers work on, and frame the camera on it. */
  setGrid(grid: Grid): void;
  setCutaway(mode: CutawayMode): void;
  /** Roof hostile ships (default on); off shows their interior. */
  setRoofEnemies(on: boolean): void;
  setOverlay(field: string | null): void;
  setSelection(tile: Tile | readonly Tile[] | null): void;
  setHover(tile: Tile | null): void;
  setPreview(tiles: readonly Tile[], valid?: boolean): void;
  /** Center the camera on a (fractional) tile position of the camera ship's grid. */
  focusTile(x: number, y: number): void;
  /** Center the camera on a sector position (tiles). */
  focusSector(x: number, y: number): void;
  /** Frame the given ships (by grid id) in the view: centered, at the largest zoom that fits them (at least 1). */
  frameShips(gridIds: readonly number[]): void;
  info(): RenderInfo;
  /** Drag the view by a screen-space delta in CSS px. */
  pan(dxPx: number, dyPx: number): void;
  /** Zoom by factor (>1 zooms in), snapped to integer steps, keeping the point under (screenX, screenY) fixed. */
  zoomAt(factor: number, screenX: number, screenY: number): void;
  /** Tile under a canvas-relative CSS px position, or null if outside the grid. */
  pickTile(screenX: number, screenY: number): Tile | null;
  /** Crew entity id under a canvas-relative position, or null. Prefer over pickTile when set. */
  pickCrew(screenX: number, screenY: number): number | null;
  /** Module entity under a canvas-relative position (its sprite bounds), or null. */
  pickModule(screenX: number, screenY: number): number | null;
  /** Draw a ring under this crew member (null clears). */
  setSelectedCrew(id: number | null): void;
  /** Sim events of the last frame, for combat fx. */
  onEvents(events: readonly SimEvent[]): void;
  /** Show a ship in the combat overlay rectangle (null hides it). */
  setCombatView(view: { gridId: number; rect: CombatViewRect } | null): void;
  /** Module (0 = the hull itself) under a canvas-relative position inside the combat overlay, or null if outside the ship. */
  pickCombat(screenX: number, screenY: number): { moduleId: number } | null;
}

interface RendererContent {
  modules: ModuleDefs & Readonly<Record<string, ModuleDef>>;
  items: Readonly<Record<string, ItemDef>>;
  weapons: Readonly<Record<string, WeaponDef>>;
}

/** Whole-number scale that fits a span into a box; below 1 it steps by quarters. */
function fitScale(boxW: number, boxH: number, spanW: number, spanH: number): number {
  const s = Math.min(boxW / spanW, boxH / spanH);
  return s >= 1 ? Math.min(3, Math.floor(s)) : Math.max(0.25, Math.floor(s * 4) / 4);
}

/** Loads the asset manifest and sheets, then builds the renderer. Rejects if assets are missing or invalid. */
export async function createRenderer(canvas: HTMLCanvasElement, quality: Quality, world: World, content: RendererContent): Promise<Renderer> {
  const high = quality === 'high';
  const atlas = await loadAtlas();
  const gl = await autoDetectRenderer({
    canvas,
    width: 1,
    height: 1,
    resolution: 1,
    antialias: false,
    roundPixels: true,
    background: 0x07090d,
    preference: 'webgl',
    powerPreference: 'high-performance',
  });
  const stage = new Container();
  stage.sortableChildren = true;
  const cam = createCamera(high ? 3 : 2);
  const scenes = new Map<number, ShipScene>();
  let grids: ReadonlyMap<number, Grid> = new Map();
  let refId = 1;
  let cutaway: CutawayMode = 'auto';
  let roofEnemies = true;
  let overlay: string | null = null;
  let hover: Tile | null = null;
  let selection: Tile | readonly Tile[] | null = null;
  let selectedCrew: number | null = null;
  let preview: readonly Tile[] = [];
  let previewValid = true;
  let lastFrame = performance.now();

  // The sector layer: combat fx above every ship, in the camera ship's frame.
  const SL = createLayers(false);
  SL.world.zIndex = 1e9;
  stage.addChild(SL.world);
  const sectorParticles = createParticles(atlas, SL);
  const fx = createSectorFx(world, atlas, SL, sectorParticles, { weapons: content.weapons, modules: content.modules }, { ref: () => shipOf(refId) ?? null });

  // The combat overlay: the shown ship's layer stack is drawn a second time, scaled into a rectangle of the canvas.
  const miniRoot = new Container();
  const miniBg = new Graphics();
  const miniMask = new Graphics();
  miniRoot.addChild(miniBg, miniMask);
  miniRoot.mask = miniMask;
  let mini: { gridId: number; rect: CombatViewRect } | null = null;
  let miniGeom: { x: number; y: number; w: number; h: number; scale: number; ox: number; oy: number; lift: number } | null = null;

  function shipOf(gridId: number): Ship | undefined {
    for (const id of world.query(ShipC)) {
      const s = world.get(id, ShipC);
      if (s?.gridId === gridId) return s;
    }
    return undefined;
  }
  const ratio = () => cam.w / Math.max(1, canvas.clientWidth);

  function resize(): void {
    cam.resize(canvas.clientWidth || 1, canvas.clientHeight || 1, window.devicePixelRatio || 1);
    gl.resize(cam.w, cam.h);
  }
  resize();

  function frame(grid: Grid): void {
    const c = iso(grid.width / 2 - 0.5, grid.height / 2 - 0.5);
    cam.centerOn(c.x, c.y - 8);
    const spanW = (grid.width + grid.height) * (TILE_W / 2) + TILE_W;
    const spanH = (grid.width + grid.height) * (TILE_H / 2) + TILE_H * 2;
    // Largest whole device-px-per-art-px scale at which the whole ship fits (at least 1).
    cam.setZoom(Math.max(1, Math.floor(Math.min(cam.w / spanW, cam.h / spanH))));
  }

  const wantsRoof = (s: Ship) => roofEnemies && s.faction === 'hostile' && s.state !== 'wreck';

  function addScene(s: Ship, grid: Grid): ShipScene {
    const sc = createShipScene(grid, { world, atlas, modules: content.modules, items: content.items, halos: high && grid.id === refId, roofed: wantsRoof(s) });
    sc.setCutaway(cutaway);
    if (grid.id === refId) {
      sc.view.setOverlay(overlay);
      sc.view.setSelection(selection);
      sc.view.setHover(hover);
      sc.view.setPreview(preview, previewValid);
      sc.setSelectedCrew(selectedCrew);
    }
    stage.addChild(sc.layers.world);
    scenes.set(grid.id, sc);
    return sc;
  }

  /** Create scenes for new ships, drop those of ships that are gone or have jumped away, and re-roof. */
  function sync(): void {
    const live = new Set<number>();
    for (const id of world.query(ShipC)) {
      const s = world.get(id, ShipC);
      const grid = s && grids.get(s.gridId);
      if (!s || !grid || s.state === 'fled') continue;
      live.add(s.gridId);
      const sc = scenes.get(s.gridId) ?? addScene(s, grid);
      if (sc.grid !== grid) {
        sc.dispose();
        scenes.delete(s.gridId);
        addScene(s, grid);
      } else if (sc.isRoofed() !== wantsRoof(s)) sc.setRoofed(wantsRoof(s));
    }
    for (const [id, sc] of scenes) {
      if (live.has(id)) continue;
      sc.dispose();
      scenes.delete(id);
    }
  }

  /** Module ids on the enemy grid that the player's ship (or one of its weapons) is aiming at. */
  function targetedModules(gridId: number): Set<number> {
    const out = new Set<number>();
    for (const id of world.query(ShipC, CombatC)) {
      if (world.get(id, ShipC)?.gridId !== refId) continue;
      const t = world.get(id, CombatC)?.target;
      if (t?.gridId === gridId && t.moduleId) out.add(t.moduleId);
    }
    for (const id of world.query(WeaponC, ModuleC)) {
      const t = world.get(id, WeaponC)?.target;
      if (t?.gridId === gridId && t.moduleId && world.get(id, ModuleC)?.gridId === refId) out.add(t.moduleId);
    }
    return out;
  }

  function drawMini(): void {
    const sc = mini && scenes.get(mini.gridId);
    const ship = mini && shipOf(mini.gridId);
    if (!mini || !sc || !ship) {
      miniGeom = null;
      return;
    }
    const k = ratio();
    const x = Math.round(mini.rect.x * k);
    const y = Math.round(mini.rect.y * k);
    const w = Math.max(1, Math.round(mini.rect.w * k));
    const h = Math.max(1, Math.round(mini.rect.h * k));
    const lift = sc.isRoofed() ? ROOF_H : 0;
    const spanW = (ship.width + ship.height) * (TILE_W / 2) + TILE_W;
    const spanH = (ship.width + ship.height) * (TILE_H / 2) + TILE_H * 2 + lift;
    const scale = fitScale(w - 8, h - 8, spanW, spanH);
    const c = iso(ship.width / 2 - 0.5, ship.height / 2 - 0.5);
    const ox = Math.round(x + w / 2 - c.x * scale);
    const oy = Math.round(y + h / 2 - (c.y - lift / 2) * scale);
    miniGeom = { x, y, w, h, scale, ox, oy, lift };
    miniBg.clear().rect(x, y, w, h).fill(0x04070b);
    miniMask.clear().rect(x, y, w, h).fill(0xffffff);
    const root = sc.layers.world;
    sc.layers.setScale(scale);
    root.position.set(ox, oy);
    miniRoot.addChild(root);
    gl.render({ container: miniRoot, clear: false });
    stage.addChild(root);
  }

  return {
    render(alpha) {
      sync();
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastFrame) / 1000);
      lastFrame = now;
      const ref = shipOf(refId);
      for (const [id, sc] of scenes) {
        const s = shipOf(id);
        const L = sc.layers;
        sc.setMarks(mini?.gridId === id, mini?.gridId === id ? targetedModules(id) : new Set());
        sc.update(dt);
        const off = ref && s ? iso(s.x - ref.x, s.y - ref.y) : { x: 0, y: 0 };
        L.setScale(cam.scale);
        L.world.position.set(cam.originX + off.x * cam.scale, cam.originY + off.y * cam.scale);
        L.world.zIndex = s ? s.x + s.y : 0;
        L.world.visible = ref !== undefined;
      }
      fx.update(dt, alpha);
      sectorParticles.update(dt);
      SL.setScale(cam.scale);
      SL.world.position.set(cam.originX, cam.originY);
      gl.render({ container: stage });
      drawMini();
    },
    resize,
    setGrids(g) {
      grids = g;
    },
    setGrid(grid) {
      refId = grid.id;
      scenes.get(grid.id)?.dispose();
      scenes.delete(grid.id);
      sync();
      frame(grid);
    },
    setCutaway(m) {
      cutaway = m;
      for (const sc of scenes.values()) sc.setCutaway(m);
    },
    setRoofEnemies(on) {
      roofEnemies = on;
    },
    setOverlay(f) {
      overlay = f;
      scenes.get(refId)?.view.setOverlay(f);
    },
    setSelection(t) {
      selection = t;
      scenes.get(refId)?.view.setSelection(t);
    },
    setHover(t) {
      hover = t;
      scenes.get(refId)?.view.setHover(t);
    },
    setPreview(tiles, valid = true) {
      preview = tiles;
      previewValid = valid;
      scenes.get(refId)?.view.setPreview(tiles, valid);
    },
    focusTile(x, y) {
      const p = iso(x, y);
      cam.centerOn(p.x, p.y - 8);
    },
    focusSector(x, y) {
      const r = shipOf(refId) ?? { x: 0, y: 0 };
      const p = iso(x - r.x - 0.5, y - r.y - 0.5);
      cam.centerOn(p.x, p.y);
    },
    frameShips(ids) {
      const r = shipOf(refId);
      if (!r) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const id of ids) {
        const s = shipOf(id);
        if (!s) continue;
        for (const [tx, ty] of [[0, 0], [s.width, 0], [0, s.height], [s.width, s.height]] as const) {
          const p = iso(s.x + tx - r.x - 0.5, s.y + ty - r.y - 0.5);
          x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y - ROOF_H); y1 = Math.max(y1, p.y);
        }
      }
      if (x0 === Infinity) return;
      cam.centerOn((x0 + x1) / 2, (y0 + y1) / 2);
      cam.setZoom(Math.max(1, Math.floor(Math.min(cam.w / (x1 - x0 + 64), cam.h / (y1 - y0 + 64)))));
    },
    info: () => {
      let sprites = sectorParticles.count();
      for (const sc of scenes.values()) sprites += sc.sprites();
      return { sprites, zoom: cam.zoom };
    },
    pan: (dx, dy) => cam.pan(dx, dy),
    zoomAt: (f, x, y) => cam.zoomAt(f, x, y),
    pickTile(sx, sy) {
      const grid = scenes.get(refId)?.grid;
      if (!grid) return null;
      const a = cam.toArt(sx, sy);
      const t = tileAt(a.x, a.y);
      return grid.inBounds(t.x, t.y) ? t : null;
    },
    pickCrew(sx, sy) {
      const a = cam.toArt(sx, sy);
      return scenes.get(refId)?.pickCrew(a.x, a.y) ?? null;
    },
    pickModule(sx, sy) {
      const a = cam.toArt(sx, sy);
      return scenes.get(refId)?.pickModule(a.x, a.y) ?? null;
    },
    setSelectedCrew(id) {
      selectedCrew = id;
      scenes.get(refId)?.setSelectedCrew(id);
    },
    onEvents: (events) => fx.onEvents(events),
    setCombatView(v) {
      mini = v;
      if (!v) miniGeom = null;
    },
    pickCombat(sx, sy) {
      const g = miniGeom;
      const sc = mini && scenes.get(mini.gridId);
      if (!g || !sc) return null;
      const k = ratio();
      const dx = sx * k;
      const dy = sy * k;
      if (dx < g.x || dy < g.y || dx >= g.x + g.w || dy >= g.y + g.h) return null;
      const t = tileAt((dx - g.ox) / g.scale, (dy - g.oy) / g.scale + g.lift);
      if (!sc.grid.inBounds(t.x, t.y)) return null;
      // The nearest targetable module within a tile (tiles are small on a phone).
      let best = 0;
      let bestD = Infinity;
      for (let ty = t.y - 1; ty <= t.y + 1; ty++)
        for (let tx = t.x - 1; tx <= t.x + 1; tx++) {
          if (!sc.grid.inBounds(tx, ty)) continue;
          const id = sc.grid.get('module', tx, ty);
          const m = id ? world.get(id, ModuleC) : undefined;
          const d = Math.hypot(tx - t.x, ty - t.y);
          if (m && (d === 0 || content.modules[m.def]?.roofAsset) && d < bestD) {
            best = id;
            bestD = d;
          }
        }
      return { moduleId: best };
    },
    dispose() {
      fx.dispose();
      sectorParticles.dispose();
      for (const sc of scenes.values()) sc.dispose();
      scenes.clear();
      gl.destroy();
    },
  };
}
