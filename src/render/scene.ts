import { autoDetectRenderer, Container } from 'pixi.js';
import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import type { ItemDef } from '../sim/registry';
import { loadAtlas } from './assets/loader';
import { createCamera } from './camera';
import { createCrewView } from './crewView';
import { createGridView, type CutawayMode, type GridView } from './gridView';
import { iso, tileAt, TILE_H, TILE_W } from './iso';
import { createAtmosphere } from './fx/atmosphere';
import { createParticles } from './fx/particles';
import { createFxView } from './fxView';
import { createItemView } from './itemView';
import { createJobView } from './jobView';
import { createLayers } from './layers';
import { createModuleView, shipHasPower, type ModuleDefs } from './moduleView';

export type { CutawayMode };
export type Quality = 'high' | 'low';

export interface RenderInfo {
  /** Display objects drawn last frame (floors, walls, crew layers, glow...). */
  sprites: number;
  /** Integer zoom step. */
  zoom: number;
}

type Tile = { x: number; y: number };

export interface Renderer {
  render(alpha: number): void;
  resize(): void;
  dispose(): void;
  /** Show a grid (replacing any previous one) and frame the camera on it. */
  setGrid(grid: Grid): void;
  setCutaway(mode: CutawayMode): void;
  setOverlay(field: string | null): void;
  setSelection(tile: Tile | readonly Tile[] | null): void;
  setHover(tile: Tile | null): void;
  setPreview(tiles: readonly Tile[], valid?: boolean): void;
  /** Center the camera on a (fractional) tile position. */
  focusTile(x: number, y: number): void;
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
}

/** Loads the asset manifest and sheets, then builds the renderer. Rejects if assets are missing or invalid. */
export async function createRenderer(canvas: HTMLCanvasElement, quality: Quality, world: World, modules: ModuleDefs, items: Readonly<Record<string, ItemDef>>): Promise<Renderer> {
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
  const L = createLayers(high);
  stage.addChild(L.world);
  const cam = createCamera(high ? 3 : 2);

  let view: GridView | null = null;
  const target = () => (view ? { grid: view.grid, gridId: view.grid.id } : null);
  let emergency = false;
  const crewView = createCrewView(world, atlas, L, {
    target,
    emergency: () => emergency,
    light: () => (view ? { data: view.grid.raw('light'), width: view.grid.width } : null),
  });
  const jobView = createJobView(world, atlas, L, { target });
  const moduleView = createModuleView(world, atlas, L, modules, {
    target: () => (view ? { grid: view.grid } : null),
    emergency: () => emergency,
  });
  const itemView = createItemView(world, atlas, L, items, {
    target: () => (view ? { grid: view.grid } : null),
    emergency: () => emergency,
  });
  const fxView = createFxView(atlas, L, { target: () => (view ? { grid: view.grid } : null) });
  const particles = createParticles(atlas, L);
  const atmosphere = createAtmosphere(world, particles, modules, { target: () => (view ? { grid: view.grid } : null) });
  let lastFrame = performance.now();
  let cutaway: CutawayMode = 'auto';
  let overlay: string | null = null;
  let hover: Tile | null = null;
  let selection: Tile | readonly Tile[] | null = null;
  let preview: readonly Tile[] = [];
  let previewValid = true;

  function resize(): void {
    cam.resize(canvas.clientWidth || 1, canvas.clientHeight || 1, window.devicePixelRatio || 1);
    gl.resize(cam.w, cam.h);
  }
  resize();

  /** Extra screen height (art px) that full-height walls (about 3 tiles tall) stand above the floor diamond. */
  const WALL_RISE = 88;

  function frame(grid: Grid): void {
    const c = iso(grid.width / 2 - 0.5, grid.height / 2 - 0.5);
    cam.centerOn(c.x, c.y - 8 - WALL_RISE / 2);
    const spanW = (grid.width + grid.height) * (TILE_W / 2) + TILE_W;
    const spanH = (grid.width + grid.height) * (TILE_H / 2) + TILE_H * 2 + WALL_RISE;
    // Largest whole device-px-per-art-px scale at which the whole ship fits (at least 1).
    cam.setZoom(Math.max(1, Math.floor(Math.min(cam.w / spanW, cam.h / spanH))));
  }

  return {
    render() {
      emergency = view ? shipHasPower(world, modules, view.grid.id) === false : false;
      view?.update();
      moduleView.update();
      itemView.update();
      fxView.update();
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastFrame) / 1000);
      lastFrame = now;
      if (view) atmosphere.update(dt);
      particles.update(dt);
      jobView.update();
      crewView.update();
      L.world.visible = view !== null;
      L.setScale(cam.scale);
      L.world.position.set(cam.originX, cam.originY);
      gl.render({ container: stage });
    },
    resize,
    setGrid(grid) {
      view?.dispose();
      view = createGridView(grid, atlas, L, { emergency: () => emergency, overlayWorld: { world, modules } });
      view.setCutaway(cutaway);
      view.setOverlay(overlay);
      view.setSelection(selection);
      view.setHover(hover);
      view.setPreview(preview, previewValid);
      frame(grid);
    },
    setCutaway(m) {
      cutaway = m;
      view?.setCutaway(m);
    },
    setOverlay(f) {
      overlay = f;
      view?.setOverlay(f);
    },
    setSelection(t) {
      selection = t;
      view?.setSelection(t);
    },
    setHover(t) {
      hover = t;
      view?.setHover(t);
    },
    setPreview(tiles, valid = true) {
      preview = tiles;
      previewValid = valid;
      view?.setPreview(tiles, valid);
    },
    focusTile(x, y) {
      const p = iso(x, y);
      cam.centerOn(p.x, p.y - 8);
    },
    info: () => ({ sprites: particles.count() + L.floor.children.length + L.sorted.children.length + L.decal.children.length, zoom: cam.zoom }),
    pan: (dx, dy) => cam.pan(dx, dy),
    zoomAt: (f, x, y) => cam.zoomAt(f, x, y),
    pickTile(sx, sy) {
      if (!view) return null;
      const a = cam.toArt(sx, sy);
      const t = tileAt(a.x, a.y);
      return view.grid.inBounds(t.x, t.y) ? t : null;
    },
    pickCrew(sx, sy) {
      const a = cam.toArt(sx, sy);
      return crewView.pick(a.x, a.y);
    },
    pickModule(sx, sy) {
      const a = cam.toArt(sx, sy);
      return moduleView.pick(a.x, a.y);
    },
    setSelectedCrew: (id) => crewView.setSelectedCrew(id),
    dispose() {
      crewView.dispose();
      moduleView.dispose();
      itemView.dispose();
      fxView.dispose();
      particles.dispose();
      jobView.dispose();
      view?.dispose();
      gl.destroy();
    },
  };
}
