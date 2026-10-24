import { autoDetectRenderer, Container } from 'pixi.js';
import { ShipC, type Ship } from '../sim/combat/components';
import type { World } from '../sim/ecs';
import type { SimEvent } from '../sim/events';
import type { Grid } from '../sim/grid';
import type { SectorGrid } from '../sim/sectorGrid';
import { shipGridOf } from '../sim/shipGrid';
import type { ItemDef, ModuleDef, WeaponDef } from '../sim/registry';
import { loadAtlas, type AtlasStats } from './assets/loader';
import { createArtStream } from './artStream';
import { createCamera, type Camera } from './camera';
import { createCombatPass, type CombatMarks, type CombatViewRect } from './combatPass';
import type { CutawayMode } from './gridView';
import { ART_SCALE, iso, TILE_H, TILE_W } from './iso';
import { createParticles } from './fx/particles';
import { createLayers } from './layers';
import { initHalos } from './haloTex';
import { createWorldStack } from './worldLayers';
import { regionOrigin, sectorArt, type Origin } from './sectorPos';
import type { ModuleDefs } from './moduleView';
import { ROOF_H, Z_PX } from './heights';
import { liveryFor } from './roofArt';
import { createShuttleView } from './shuttleView';
import { createContainerBodyView } from './containerBodyView';
import { createFightFx } from './fightFx';
import { crewMuzzle } from './crewMuzzle';
import { createCrewMarks } from './crewMarks';
import { sectorTileAt, pickCrewAcross, pickTileAcross, screenOfTile, type PickHost } from './scenePick';
import { targetedModules, wantsRoof } from './regionRules';
import { beamLookFor } from './beamArt';
import { createSectorFx } from './sectorFx';
import { createAsteroidView } from './asteroidView';
import { createMarkers } from './markers';
import { createPodView } from './podView';
import { createShipScene, type ShipScene } from './shipScene';

export type { CutawayMode };
export type Quality = 'high' | 'low';

export interface RenderInfo {
  /** Display objects drawn last frame (floors, walls, crew layers, glow...). */
  sprites: number;
  /** Integer zoom step. */
  zoom: number;
}

type Tile = { x: number; y: number; lift?: number };

export type { CombatMarks, CombatViewRect };

export interface Renderer {
  render(alpha: number): void;
  resize(): void;
  dispose(): void;
  /** The sector grid every ship is stamped into. Ships are drawn for every ShipC (a scene reads its ShipC rectangle of it). */
  setSector(sector: SectorGrid): void;
  /** Make this grid the one the camera, picking and the editing markers work on, and frame the camera on it. */
  setGrid(grid: Grid): void;
  setCutaway(mode: CutawayMode): void;
  /** Roof hostile ships (default on); off shows their interior. */
  setRoofEnemies(on: boolean): void;
  setOverlay(field: string | null): void;
  /** Selected tile(s) on `shipId`'s grid (default the camera ship's; derelicts and other ships take their own). */
  setSelection(tile: Tile | readonly Tile[] | null, shipId?: number): void;
  setHover(tile: Tile | null): void;
  setPreview(tiles: readonly Tile[], valid?: boolean): void;
  /** Center the camera on a (fractional) tile position of the camera ship's grid. */
  focusTile(x: number, y: number): void;
  /** Center the camera on a sector position (tiles). */
  focusSector(x: number, y: number): void;
  /** Frame the given ships (by grid id) in the view: centered, at the largest zoom that fits them (at least 1). */
  frameShips(gridIds: readonly number[]): void;
  info(): RenderInfo;
  /** Sheet streaming counters (decoded bytes resident, requests, pending...) and scene rebuilds, for the debug hook. */
  art(): AtlasStats & { rebuilds: number };
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
  pickTileAny(screenX: number, screenY: number): { shipId: number; x: number; y: number } | null;
  /** The sector tile under a canvas-relative position, wherever it is (painting tools, asteroid rock). `lift`: read the point as that many tiles above the ground (the top of a rock block). */
  pickSector(screenX: number, screenY: number, lift?: number): Tile;
  /** Canvas-relative CSS px of a tile's centre on any ship. */
  screenOf(shipId: number, x: number, y: number): { x: number; y: number };
  /** Draw a ring under this crew member (null clears). */
  setSelectedCrew(id: number | null): void;
  /** Drop every ship scene (the sector changed under them: a jump lifted the ships out); the next frame builds them again. */
  resetWorld(): void;
  /** Sim events of the last frame, for combat fx. */
  onEvents(events: readonly SimEvent[]): void;
  /** Show a ship in the combat overlay rectangle (null hides it). */
  setCombatView(view: { shipId: number; rect: CombatViewRect } | null): void;
  /** Which target brackets the combat overlay draws. */
  setCombatMarks(marks: CombatMarks): void;
  /** Module (0 = the hull itself) under a canvas-relative position inside the combat overlay, or null if outside the ship. */
  pickCombat(screenX: number, screenY: number): { moduleId: number } | null;
}

interface RendererContent {
  modules: ModuleDefs & Readonly<Record<string, ModuleDef>>;
  items: Readonly<Record<string, ItemDef>>;
  weapons: Readonly<Record<string, WeaponDef>>;
  /** The EVA suit, for the air bar over suited crew. */
  suit?: { airSec: number };
  /** Ore kinds (code and placeholder colour) for the asteroid placeholder drawing. */
  ores?: Readonly<Record<string, { code: number; color: number; amount: readonly [number, number] }>>;
  /** Vehicle classes by def id: pods ('pod') are drawn by podView, not as shuttles. */
  vehicles?: Readonly<Record<string, { class: string; size?: number }>>;
}

/** Loads the asset manifest and sheets, then builds the renderer. Rejects if assets are missing or invalid. */
export async function createRenderer(canvas: HTMLCanvasElement, quality: Quality, world: World, content: RendererContent): Promise<Renderer> {
  const high = quality === 'high';
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
  // Sheets go to the GPU as they load and their decoded copy is dropped; if the context is lost they are decoded again.
  const atlas = await loadAtlas(undefined, { upload: (src) => gl.texture.initSource(src) });
  canvas.addEventListener('webglcontextlost', () => atlas.contextLost());
  canvas.addEventListener('webglcontextrestored', () => void atlas.contextRestored());
  if (high) initHalos(gl);
  const stage = new Container();
  const cam = createCamera(high ? 3 : 2);
  const scenes = new Map<number, ShipScene>();
  let sector: SectorGrid | null = null;
  let refId = 0;
  let cutaway: CutawayMode = 'auto';
  let roofEnemies = true;
  let overlay: string | null = null;
  let hover: Tile | null = null;
  let selection: Tile | readonly Tile[] | null = null;
  let selShip = 0;
  let selectedCrew: number | null = null;
  let lastFrame = performance.now();

  // One world layer stack for every region (ship), in the sector frame: art origin = sector tile (0, 0).
  const W = createWorldStack();
  stage.addChild(W.root);
  // The air layer: combat fx and flying bodies above every ship and roof, in the same frame.
  const SL = createLayers(false);
  stage.addChild(SL.world);
  const sectorParticles = createParticles(atlas, SL);
  const fx = createSectorFx(world, atlas, SL, sectorParticles, { weapons: content.weapons, modules: content.modules });
  // Asteroids (rock sprites, asteroidView.ts): one region layer set in the sector frame, under every ship's tiles.
  const rockLayers = W.region(false);
  rockLayers.setOrigin(0, 0, 0);
  const asteroids = createAsteroidView(world, atlas, rockLayers, content.ores ?? {});
  const isPod = (def: string) => content.vehicles?.[def]?.class === 'pod';
  const pods = createPodView(world, atlas, { air: SL.sorted, low: W.low, size: (def) => (isPod(def) ? content.vehicles?.[def]?.size ?? 2.6 : undefined) });

  // Shuttles: flying, docked at an airlock, and (while it lifts off or settles) the one in the camera ship's bay. A shuttle
  // parked in a bay is the bay's own layer (vehicleBayArt).
  const shuttles = createShuttleView(world, atlas, content.modules, {
    layer: SL.sorted,
    project: sectorArt,
    include: (v) => v.state !== 'stowed' || v.homeGrid === refId,
    skip: isPod,
    low: { layer: W.low, project: sectorArt },
  });

  // Detached containers: inert bodies at hull height, sorted with the ships' tiles.
  const boxes = createContainerBodyView(world, atlas, content.modules, { layer: W.low, project: sectorArt });

  /** What crew views need to draw EVA: the tank size. */
  const evaHost = () => ({ suitAirSec: () => content.suit?.airSec ?? 240 });
  // Where a region's ship-local art sits: its grid's sector top-left ((0, 0) for a grid that is not shown).
  const ZERO: Origin = { x: 0, y: 0 };
  const origin = (shipId: number): Origin => {
    const g = scenes.get(shipId)?.grid ?? (sector ? shipGridOf(sector, world, shipId) : undefined);
    return g ? regionOrigin(g) : ZERO;
  };
  const NONE: ReadonlySet<number> = new Set();
  const pickHost = (): PickHost => ({ scenes, cam, origin, hidden: (id) => !!world.get(id, ShipC)?.outpost?.hidden });
  // PLACEHOLDER fight feedback and crew status marks, in the sector layer (see fightFx.ts, crewMarks.ts).
  const fightFx = createFightFx(world, SL.ui, () => SL.scale, { ship: shipOf, muzzle: (id) => crewMuzzle(world, atlas, content.items, id) });
  const sectorMarks = createMarkers(SL.ui);
  const crewMarks = createCrewMarks(world, SL.ui, { ship: shipOf, visible: (id, x, y) => { const sc = scenes.get(id); return !!sc && sc.layers.visible && !sc.hidesCrewAt(x, y); } });

  function shipOf(shipId: number): Ship | undefined {
    return shipId ? world.get(shipId, ShipC) : undefined;
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
    cam.centerOn(c.x, c.y - 8 * ART_SCALE - WALL_RISE / 2);
    const spanW = (grid.width + grid.height) * (TILE_W / 2) + TILE_W;
    const spanH = (grid.width + grid.height) * (TILE_H / 2) + TILE_H * 2 + WALL_RISE;
    // Largest zoom level (whole from 1 up; 0.75 and 0.5 below at 2x art) at which the whole ship fits (at least the smallest).
    cam.fitZoom(Math.min(cam.w / spanW, cam.h / spanH));
  }

  /** A ship's roof livery; the debug URL parameter `?bow=east|west` forces the end the bow motifs take. */
  const bowParam = new URLSearchParams(window.location.search).get('bow');
  const shipLivery = (s: Ship) => ({ ...liveryFor(s.faction, s.name), ...(bowParam ? { bowWest: bowParam === 'west' } : {}) });
  // a hidden outpost stays under its rock roof whatever the roof toggle says
  const roofFor = (id: number, s: Ship) => !!s.outpost?.hidden || wantsRoof(world, id, s, roofEnemies);

  function addScene(s: Ship, grid: Grid): ShipScene {
    const sc = createShipScene(grid, { world, atlas, modules: content.modules, items: content.items, layers: W.region(high && grid.id === refId), roofed: roofFor(grid.id, s), livery: shipLivery(s), beamLook: beamLookFor(s.gen?.faction), ...evaHost() });
    sc.setCutaway(cutaway);
    if (grid.id === refId) {
      sc.view.setOverlay(overlay);
      sc.view.setSelection(selection);
      sc.view.setHover(hover);
    } else if (grid.id === selShip) sc.view.setSelection(selection);
    sc.setSelectedCrew(selectedCrew);
    scenes.set(grid.id, sc);
    art.built(grid.id);
    return sc;
  }

  /** Create scenes for new ships, drop those of ships that are gone or have jumped away, and re-roof. */
  function sync(): void {
    const live = new Set<number>();
    for (const id of world.query(ShipC)) {
      const s = world.get(id, ShipC);
      const grid = s && sector && shipGridOf(sector, world, id);
      if (!s || !grid || s.state === 'fled') continue;
      live.add(id);
      const sc = scenes.get(id) ?? addScene(s, grid);
      if (sc.grid !== grid) {
        sc.dispose();
        scenes.delete(id);
        addScene(s, grid);
      } else if (sc.isRoofed() !== roofFor(id, s)) sc.setRoofed(roofFor(id, s));
    }
    for (const [id, sc] of scenes) {
      if (live.has(id)) continue;
      sc.dispose();
      scenes.delete(id);
    }
  }

  // Sheets load on demand: scenes are rebuilt when the art they asked for arrives (artStream.ts).
  const art = createArtStream(
    atlas,
    {
      rebuild() {
        for (const sc of scenes.values()) sc.dispose();
        scenes.clear();
        asteroids.rebuild();
      },
      sync,
    },
    () => performance.now(),
  );

  /** Art px box of a region (padded for the roof, turrets, bells and docked bodies), for culling per camera. */
  function regionInView(id: number, grid: Grid, c: Camera): boolean {
    const o = origin(id);
    const P = 4;
    const x0 = iso(o.x - P, o.y + grid.height + P).x;
    const x1 = iso(o.x + grid.width + P, o.y - P).x;
    const y0 = iso(o.x - P, o.y - P).y - ROOF_H - 64 * ART_SCALE;
    const y1 = iso(o.x + grid.width + P, o.y + grid.height + P).y + 32 * ART_SCALE;
    const vx0 = -c.originX / c.scale;
    const vy0 = -c.originY / c.scale;
    return x1 >= vx0 && x0 <= vx0 + c.w / c.scale && y1 >= vy0 && y0 <= vy0 + c.h / c.scale;
  }

  /** Place the world for a camera pass: the main pass (target null) or the combat panel (pass B, showing `target`). */
  function place(c: Camera, target: number | null): void {
    const any = shipOf(refId) !== undefined;
    for (const [id, sc] of scenes) sc.layers.setVisible(any && !art.waiting(id) && regionInView(id, sc.grid, c));
    // Shrunk art (the main camera below zoom 1) is drawn with linear filtering; the combat panel keeps nearest.
    atlas.setSmooth(target === null && c.scale < 1);
    W.setUiVisible(target === null);
    W.setMarksVisible(target !== null);
    SL.ui.visible = target === null;
    W.root.scale.set(c.scale);
    W.root.position.set(c.originX, c.originY);
    SL.setScale(c.scale);
    SL.world.position.set(c.originX, c.originY);
  }

  // The combat panel: camera pass B over the same world stack, into a texture shown above the main pass.
  const pass = createCombatPass({
    world,
    modules: content.modules,
    ship: shipOf,
    grid: (id) => scenes.get(id)?.grid,
    origin,
    roofed: (id) => scenes.get(id)?.isRoofed() ?? false,
    ratio,
    place,
  });
  stage.addChild(pass.sprite);

  return {
    render(alpha) {
      if (atlas.restoring) return;
      sync();
      art.update();
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastFrame) / 1000);
      lastFrame = now;
      W.setScale(cam.scale);
      const shown = pass.target();
      for (const [id, sc] of scenes) {
        const o = origin(id);
        const p = iso(o.x, o.y);
        sc.layers.setOrigin(p.x, p.y, o.x + o.y);
        sc.setMarks(id === shown, id === shown ? targetedModules(world, refId, id) : NONE);
        sc.update(dt);
      }
      asteroids.update(sector);
      pods.update(dt);
      shuttles.update(dt);
      boxes.update();
      fightFx.update(dt);
      crewMarks.update();
      fx.update(dt, alpha);
      sectorParticles.update(dt);
      art.settle();
      pass.render(gl, stage);
      place(cam, null);
      gl.render({ container: stage });
      atlas.tick();
    },
    resize,
    resetWorld() {
      for (const sc of scenes.values()) sc.dispose();
      scenes.clear();
    },
    setSector(g) {
      sector = g;
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
    setSelection(t, shipId = refId) {
      selection = t;
      if (selShip !== shipId) scenes.get(selShip)?.view.setSelection(null);
      selShip = shipId;
      scenes.get(shipId)?.view.setSelection(t);
    },
    setHover(t) {
      hover = t;
      scenes.get(refId)?.view.setHover(t);
    },
    setPreview(tiles, valid = true) {
      // Drawn in the shared sector layer, not the reference ship's: a drag over a distant asteroid has that ship culled away.
      sectorMarks.setPreview(tiles, valid);
    },
    focusTile(x, y) {
      const p = iso(x, y); // a sector tile
      cam.centerOn(p.x, p.y - 8 * ART_SCALE);
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
      cam.fitZoom(Math.min(cam.w / (x1 - x0 + 64 * ART_SCALE), cam.h / (y1 - y0 + 64 * ART_SCALE)));
    },
    info: () => {
      let sprites = sectorParticles.count();
      for (const sc of scenes.values()) sprites += sc.sprites();
      return { sprites, zoom: cam.zoom };
    },
    art: () => ({ ...atlas.stats(), rebuilds: art.rebuilds() }),
    pan: (dx, dy) => cam.pan(dx, dy),
    zoomAt: (f, x, y) => cam.zoomAt(f, x, y),
    pickTile(sx, sy) {
      const grid = scenes.get(refId)?.grid;
      if (!grid) return null;
      const t = sectorTileAt(cam.toArt(sx, sy));
      return grid.inBounds(t.x, t.y) ? t : null;
    },
    pickCrew: (sx, sy) => pickCrewAcross(pickHost(), sx, sy),
    pickTileAny: (sx, sy) => pickTileAcross(pickHost(), sx, sy),
    pickSector: (sx, sy, lift = 0) => {
      const a = cam.toArt(sx, sy);
      return sectorTileAt({ x: a.x, y: a.y + lift * Z_PX });
    },
    screenOf: (shipId, x, y) => screenOfTile(pickHost(), ratio(), shipId, x, y),
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
    setCombatView: (v) => pass.set(v),
    setCombatMarks: (m) => pass.setMarks(m),
    pickCombat: (sx, sy) => pass.pick(sx, sy),
    dispose() {
      asteroids.dispose();
      pods.dispose();
      rockLayers.dispose();
      shuttles.dispose();
      boxes.dispose();
      fightFx.dispose();
      crewMarks.dispose();
      fx.dispose();
      sectorParticles.dispose();
      pass.dispose();
      for (const sc of scenes.values()) sc.dispose();
      scenes.clear();
      gl.destroy();
    },
  };
}
