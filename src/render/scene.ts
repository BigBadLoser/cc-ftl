import { autoDetectRenderer, Container, Sprite, Texture } from 'pixi.js';
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
import { createWorldStack } from './worldLayers';
import { regionOrigin, sectorArt } from './sectorPos';
import type { ModuleDefs } from './moduleView';
import { isTargetable } from './moduleArt';
import { ROOF_H } from './heights';
import { liveryFor } from './roofArt';
import { createShuttleView } from './shuttleView';
import { createFightFx } from './fightFx';
import { createCrewMarks } from './crewMarks';
import { localTileAt, pickCrewAcross, pickTileAcross, screenOfTile, type PickHost } from './scenePick';
import { CrewC, PositionC } from '../sim/crew/components';
import { AllegianceC } from '../sim/fight/components';
import { beamLookFor } from './beamArt';
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
  /** The ship tile (any ship in the sector) under a canvas-relative position, or null. */
  pickTileAny(screenX: number, screenY: number): { gridId: number; x: number; y: number } | null;
  /** Canvas-relative CSS px of a tile's centre on any ship. */
  screenOf(gridId: number, x: number, y: number): { x: number; y: number };
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
  /** The EVA suit, for the air bar over suited crew. */
  suit?: { airSec: number };
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

  // One world layer stack for every region (ship), in the sector frame: art origin = sector tile (0, 0).
  const W = createWorldStack();
  stage.addChild(W.root);
  // The air layer: combat fx and flying bodies above every ship and roof, in the same frame.
  const SL = createLayers(false);
  stage.addChild(SL.world);
  const sectorParticles = createParticles(atlas, SL);
  const fx = createSectorFx(world, atlas, SL, sectorParticles, { weapons: content.weapons, modules: content.modules });

  // Shuttles: flying, docked at an airlock, and (while it lifts off or settles) the one in the camera ship's bay. A shuttle
  // parked in a bay is the bay's own layer (vehicleBayArt).
  const shuttles = createShuttleView(world, atlas, content.modules, {
    layer: SL.sorted,
    project: sectorArt,
    include: (v) => v.state !== 'stowed' || v.homeGrid === refId,
    dock: (v) => {
      const gridId = world.get(v.dock, ModuleC)?.gridId;
      if (gridId === undefined || !scenes.has(gridId)) return null;
      return { layer: W.low, project: sectorArt, depth: (sx, sy) => sx + sy - 1 };
    },
  });

  /** What crew views need to draw EVA: the tank size. */
  const evaHost = () => ({ suitAirSec: () => content.suit?.airSec ?? 240 });
  const origin = (gridId: number) => regionOrigin(world, gridId);
  const pickHost = (): PickHost => ({ scenes, cam, origin });
  // PLACEHOLDER fight feedback and crew status marks, in the sector layer (see fightFx.ts, crewMarks.ts).
  const fightFx = createFightFx(world, SL.ui, () => SL.scale, { ship: shipOf });
  const crewMarks = createCrewMarks(world, SL.ui, { ship: shipOf, visible: (id) => scenes.has(id) && !scenes.get(id)?.isRoofed() });

  // The combat overlay: a second scene of the shown ship, scaled into a rectangle of the canvas, drawn in the same pass.
  const miniRoot = new Container();
  const miniBg = new Sprite(Texture.WHITE);
  miniBg.tint = 0x04070b;
  miniRoot.addChild(miniBg);
  miniRoot.visible = false;
  const MW = createWorldStack();
  miniRoot.addChild(MW.root);
  stage.addChild(miniRoot);
  let mini: { gridId: number; rect: CombatViewRect } | null = null;
  /** The overlay's own scene for the shown ship (a second set of sprites, so the main pass is the only pass). */
  let miniScene: ShipScene | null = null;
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

  /** Extra screen height (art px) that full-height walls (the roof top) stand above the floor diamond. */
  const WALL_RISE = ROOF_H;

  function frame(grid: Grid): void {
    const o = origin(grid.id);
    const c = iso(o.x + grid.width / 2 - 0.5, o.y + grid.height / 2 - 0.5);
    cam.centerOn(c.x, c.y - 8 - WALL_RISE / 2);
    const spanW = (grid.width + grid.height) * (TILE_W / 2) + TILE_W;
    const spanH = (grid.width + grid.height) * (TILE_H / 2) + TILE_H * 2 + WALL_RISE;
    // Largest whole device-px-per-art-px scale at which the whole ship fits (at least 1).
    cam.setZoom(Math.max(1, Math.floor(Math.min(cam.w / spanW, cam.h / spanH))));
  }

  /** A ship's roof livery; the debug URL parameter `?bow=east|west` forces the end the bow motifs take. */
  const bowParam = new URLSearchParams(window.location.search).get('bow');
  const shipLivery = (s: Ship) => ({ ...liveryFor(s.faction, s.name), ...(bowParam ? { bowWest: bowParam === 'west' } : {}) });
  /** True while any of the player's crew stand on this grid (boarders): its interior is shown so they can be ordered about. */
  const boarded = (gridId: number) => {
    for (const id of world.query(CrewC, PositionC)) {
      if (world.get(id, PositionC)?.gridId === gridId && world.get(id, AllegianceC)?.faction === 'player') return true;
    }
    return false;
  };
  const wantsRoof = (s: Ship) => roofEnemies && s.faction === 'hostile' && s.state !== 'wreck' && !boarded(s.gridId);

  function addScene(s: Ship, grid: Grid): ShipScene {
    const sc = createShipScene(grid, { world, atlas, modules: content.modules, items: content.items, layers: W.region(high && grid.id === refId), roofed: wantsRoof(s), livery: shipLivery(s), beamLook: beamLookFor(s.gen?.faction), ...evaHost() });
    sc.setCutaway(cutaway);
    if (grid.id === refId) {
      sc.view.setOverlay(overlay);
      sc.view.setSelection(selection);
      sc.view.setHover(hover);
      sc.view.setPreview(preview, previewValid);
    }
    sc.setSelectedCrew(selectedCrew);
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

  function drawMini(dt: number): void {
    const ship = mini && shipOf(mini.gridId);
    const grid = mini && grids.get(mini.gridId);
    if (!mini || !ship || !grid || ship.state === 'fled') {
      miniGeom = null;
      miniRoot.visible = false;
      if (miniScene) {
        miniScene.dispose();
        miniScene = null;
      }
      return;
    }
    if (miniScene && miniScene.grid !== grid) {
      miniScene.dispose();
      miniScene = null;
    }
    if (!miniScene) {
      miniScene = createShipScene(grid, { world, atlas, modules: content.modules, items: content.items, layers: MW.region(false), roofed: wantsRoof(ship), ...evaHost() });
    }
    const sc = miniScene;
    if (sc.isRoofed() !== wantsRoof(ship)) sc.setRoofed(wantsRoof(ship));
    sc.setMarks(true, targetedModules(mini.gridId));
    sc.update(dt);
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
    miniBg.position.set(x, y);
    miniBg.width = w;
    miniBg.height = h;
    MW.setScale(scale);
    MW.root.scale.set(scale);
    MW.root.position.set(ox, oy);
    miniRoot.visible = true;
  }

  return {
    render(alpha) {
      sync();
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastFrame) / 1000);
      lastFrame = now;
      const ref = shipOf(refId);
      W.setScale(cam.scale);
      for (const [id, sc] of scenes) {
        const o = origin(id);
        const p = iso(o.x, o.y);
        sc.layers.setOrigin(p.x, p.y, o.x + o.y);
        sc.layers.setVisible(ref !== undefined);
        sc.update(dt);
      }
      W.root.scale.set(cam.scale);
      W.root.position.set(cam.originX, cam.originY);
      shuttles.update(dt);
      fightFx.update(dt);
      crewMarks.update();
      fx.update(dt, alpha);
      sectorParticles.update(dt);
      SL.setScale(cam.scale);
      SL.world.position.set(cam.originX, cam.originY);
      drawMini(dt);
      gl.render({ container: stage });
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
      const o = origin(refId);
      const p = iso(o.x + x, o.y + y);
      cam.centerOn(p.x, p.y - 8);
    },
    focusSector(x, y) {
      const p = sectorArt(x, y);
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
          const p = sectorArt(s.x + tx, s.y + ty);
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
      const t = localTileAt(origin(refId), cam.toArt(sx, sy));
      return grid.inBounds(t.x, t.y) ? t : null;
    },
    pickCrew: (sx, sy) => pickCrewAcross(pickHost(), sx, sy),
    pickTileAny: (sx, sy) => pickTileAcross(pickHost(), sx, sy),
    screenOf: (gridId, x, y) => screenOfTile(pickHost(), ratio(), gridId, x, y),
    pickModule(sx, sy) {
      const a = cam.toArt(sx, sy);
      const o = origin(refId);
      const p = iso(o.x, o.y);
      return scenes.get(refId)?.pickModule(a.x - p.x, a.y - p.y) ?? null;
    },
    setSelectedCrew(id) {
      selectedCrew = id;
      for (const sc of scenes.values()) sc.setSelectedCrew(id);
    },
    onEvents: (events) => {
      fx.onEvents(events);
      fightFx.onEvents(events);
    },
    setCombatView(v) {
      mini = v;
      if (!v) miniGeom = null;
    },
    pickCombat(sx, sy) {
      const g = miniGeom;
      const sc = miniScene;
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
          const targetable = (def: string) => { const md = content.modules[def]; return !!md && isTargetable(md); };
          if (m && (d === 0 || targetable(m.def)) && d < bestD) {
            best = id;
            bestD = d;
          }
        }
      return { moduleId: best };
    },
    dispose() {
      shuttles.dispose();
      fightFx.dispose();
      crewMarks.dispose();
      fx.dispose();
      sectorParticles.dispose();
      miniScene?.dispose();
      for (const sc of scenes.values()) sc.dispose();
      scenes.clear();
      gl.destroy();
    },
  };
}
