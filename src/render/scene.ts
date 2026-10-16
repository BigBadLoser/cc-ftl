import { autoDetectRenderer, Container } from 'pixi.js';
import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import { loadAtlas } from './assets/loader';
import { createCamera } from './camera';
import { createCrewView } from './crewView';
import { createGridView, type CutawayMode, type GridView } from './gridView';
import { iso, tileAt, TILE_H, TILE_W } from './iso';
import { createJobView } from './jobView';
import { createLayers } from './layers';

export type Quality = 'high' | 'low';
export type { CutawayMode };

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
  setSelection(tile: Tile | null): void;
  setHover(tile: Tile | null): void;
  setPreview(tiles: readonly Tile[]): void;
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
  /** Draw a ring under this crew member (null clears). */
  setSelectedCrew(id: number | null): void;
}

/** Loads the asset manifest and sheets, then builds the renderer. Rejects if assets are missing or invalid. */
export async function createRenderer(canvas: HTMLCanvasElement, quality: Quality, world: World): Promise<Renderer> {
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
  const crewView = createCrewView(world, atlas, L, { target });
  const jobView = createJobView(world, atlas, L, { target });
  let cutaway: CutawayMode = 'auto';
  let overlay: string | null = null;
  let selection: Tile | null = null;
  let hover: Tile | null = null;
  let preview: readonly Tile[] = [];

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
    const dprInt = cam.scale / cam.zoom;
    cam.setZoom(Math.min(3, Math.floor(Math.min(cam.w / dprInt / spanW, cam.h / dprInt / spanH))));
  }

  return {
    render() {
      view?.update();
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
      view = createGridView(grid, atlas, L);
      view.setCutaway(cutaway);
      view.setOverlay(overlay);
      view.setSelection(selection);
      view.setHover(hover);
      view.setPreview(preview);
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
    setPreview(tiles) {
      preview = tiles;
      view?.setPreview(tiles);
    },
    focusTile(x, y) {
      const p = iso(x, y);
      cam.centerOn(p.x, p.y - 8);
    },
    info: () => ({ sprites: L.floor.children.length + L.sorted.children.length + L.decal.children.length, zoom: cam.zoom }),
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
    setSelectedCrew: (id) => crewView.setSelectedCrew(id),
    dispose() {
      crewView.dispose();
      jobView.dispose();
      view?.dispose();
      gl.destroy();
    },
  };
}
