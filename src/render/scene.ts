import {
  AmbientLight, ACESFilmicToneMapping, Color, DirectionalLight, HemisphereLight, PCFShadowMap, Scene,
  Raycaster, Vector2, Vector3, WebGLRenderer,
} from 'three';
import type { World } from '../sim/ecs';
import { createCrewView } from './crew/crewView';
import { createJobView } from './jobView';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { Grid } from '../sim/grid';
import { createCameraRig } from './camera';
import { createGridView, type CutawayMode, type GridView } from './gridView';
import { WALL_FULL_H } from './models/tiles';
import { VOXEL_SIZE } from './voxel/model';

export type Quality = 'high' | 'low';
export type { CutawayMode };

export interface RenderInfo {
  calls: number;
  triangles: number;
}

export interface Renderer {
  render(alpha: number): void;
  resize(): void;
  dispose(): void;
  /** Show a grid (replacing any previous one) and frame the camera on it. */
  setGrid(grid: Grid): void;
  setCutaway(mode: CutawayMode): void;
  setOverlay(field: string | null): void;
  setSelection(tile: { x: number; y: number } | null): void;
  setHover(tile: { x: number; y: number } | null): void;
  /** Draw calls and triangles of the last frame (all passes). */
  info(): RenderInfo;
  /** Drag the view by a screen-space delta in CSS px. */
  pan(dxPx: number, dyPx: number): void;
  /** Zoom by factor (>1 zooms in) keeping the point under (screenX, screenY) fixed. Canvas-relative px. */
  zoomAt(factor: number, screenX: number, screenY: number): void;
  /** Tile under a canvas-relative screen position, or null if outside the grid. */
  pickTile(screenX: number, screenY: number): { x: number; y: number } | null;
  /** Crew entity id under a canvas-relative screen position, or null. Prefer over pickTile when set. */
  pickCrew(screenX: number, screenY: number): number | null;
  /** Draw a cyan ring under this crew member (null clears). */
  setSelectedCrew(id: number | null): void;
}

export function createRenderer(canvas: HTMLCanvasElement, quality: Quality = 'high', world?: World): Renderer {
  const high = quality === 'high';
  const renderer = new WebGLRenderer({ canvas, antialias: high, powerPreference: 'high-performance' });
  renderer.info.autoReset = false;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.7;
  renderer.shadowMap.enabled = high;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  scene.background = new Color(0x07090d);

  const rig = createCameraRig();
  scene.add(new AmbientLight(0x8a9abb, 1.3));
  scene.add(new HemisphereLight(0x8fa8d4, 0x1d1712, 1.0));
  const key = new DirectionalLight(0xd4e0ff, 2.4);
  key.castShadow = high;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);

  let composer: EffectComposer | null = null;
  if (high) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, rig.camera));
    composer.addPass(new UnrealBloomPass(new Vector2(256, 256), 0.55, 0.5, 0.85));
    composer.addPass(new OutputPass());
  }

  let view: GridView | null = null;
  const target = () => (view ? { offsetX: view.offsetX, offsetZ: view.offsetZ, gridId: view.grid.id, grid: view.grid } : null);
  const crewView = world ? createCrewView(world, { target }) : null;
  const jobView = world ? createJobView(world, { target }) : null;
  if (crewView) scene.add(crewView.group);
  if (jobView) scene.add(jobView.group);
  const raycaster = new Raycaster();
  let cutaway: CutawayMode = 'auto';
  let overlay: string | null = null;
  let selection: { x: number; y: number } | null = null;
  let hover: { x: number; y: number } | null = null;
  let cw = 1;
  let ch = 1;

  function resize(): void {
    cw = canvas.clientWidth || 1;
    ch = canvas.clientHeight || 1;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(ratio);
    renderer.setSize(cw, ch, false);
    composer?.setPixelRatio(ratio);
    composer?.setSize(cw, ch);
    rig.resize(cw, ch);
  }
  resize();

  function frame(grid: Grid): void {
    const w = grid.width;
    const h = grid.height;
    const aspect = cw / ch;
    const span = (w + h) * Math.SQRT1_2; // screen width of the footprint
    const wallH = WALL_FULL_H * VOXEL_SIZE;
    const needH = span * Math.sin(Math.atan(1 / Math.SQRT2)) + wallH * 0.82;
    rig.setView(new Vector3(0, wallH * 0.2, 0), Math.max(needH, span / aspect) * 1.12);
    const r = Math.max(w, h) * 0.9;
    Object.assign(key.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: r * 6 });
    key.shadow.camera.updateProjectionMatrix();
    key.position.set(r * 0.5, r * 1.6, r * 1.1);
    key.target.position.set(0, 0, 0);
  }

  return {
    render(alpha) {
      view?.update();
      jobView?.update();
      crewView?.update(alpha);
      renderer.info.reset();
      if (composer) composer.render();
      else renderer.render(scene, rig.camera);
    },
    resize,
    setGrid(grid) {
      if (view) {
        scene.remove(view.group);
        view.dispose();
      }
      view = createGridView(grid);
      view.setCutaway(cutaway);
      view.setOverlay(overlay);
      view.setSelection(selection);
      view.setHover(hover);
      scene.add(view.group);
      frame(grid);
    },
    setCutaway(mode) {
      cutaway = mode;
      view?.setCutaway(mode);
    },
    setOverlay(field) {
      overlay = field;
      view?.setOverlay(field);
    },
    setSelection(t) {
      selection = t;
      view?.setSelection(t);
    },
    setHover(t) {
      hover = t;
      view?.setHover(t);
    },
    info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    pan: (dx, dy) => rig.pan(dx, dy),
    zoomAt: (f, x, y) => rig.zoomAt(f, x, y),
    pickTile(sx, sy) {
      if (!view) return null;
      const p = rig.groundAt(sx, sy);
      if (!p) return null;
      const x = Math.floor(p.x - view.offsetX);
      const y = Math.floor(p.z - view.offsetZ);
      return view.grid.inBounds(x, y) ? { x, y } : null;
    },
    pickCrew(sx, sy) {
      if (!crewView) return null;
      raycaster.setFromCamera(new Vector2((sx / cw) * 2 - 1, -(sy / ch) * 2 + 1), rig.camera);
      return crewView.pick(raycaster);
    },
    setSelectedCrew: (id) => crewView?.setSelectedCrew(id),
    dispose() {
      crewView?.dispose();
      jobView?.dispose();
      view?.dispose();
      composer?.dispose();
      renderer.dispose();
    },
  };
}
