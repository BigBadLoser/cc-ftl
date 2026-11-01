import { autoDetectRenderer, Container, RenderTexture, Sprite } from 'pixi.js';
import { animNow } from './animClock';
import { NOOP_PROBE, type Probe } from '../sim/probe';
import { ShipC, type Ship } from '../sim/combat/components';
import type { World } from '../sim/ecs';
import type { SimEvent } from '../sim/events';
import type { Grid } from '../sim/grid';
import type { SectorGrid } from '../sim/sectorGrid';
import { shipGridOf } from '../sim/shipGrid';
import { ModuleC } from '../sim/modules/components';
import type { ItemDef, ModuleDef, WeaponDef } from '../sim/registry';
import { loadAtlas, type AtlasStats } from './assets/loader';
import { createArtStream } from './artStream';
import { createCamera, type Camera } from './camera';
import { createThreatMarks } from './threatMarks';
import { createInsetPass, insetFit } from './insetPass';
import { createAimMarks, type AimHover } from './aimMarks';
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
import { createOrderFx, type OrderKind } from './orderFx';
import { sectorTileAt, pickCrewAcross, pickTileAcross, screenOfTile, type PickHost } from './scenePick';
import { wantsRoof } from './regionRules';
import { beamLookFor } from './beamArt';
import { createSectorFx } from './sectorFx';
import { createAsteroidView } from './asteroidView';
import { createMarkers, type AreaMarks } from './markers';
import { createWorldGrid } from './worldGrid';
import { createCutLine } from './cutLine';
import { createPodView } from './podView';
import { createPortraits } from './portrait';
import type { CrewLook } from './loadout';
import { createModuleThumbs, type ModuleThumb } from './moduleThumb';
import { createModuleGhost, type ModuleGhostSpec } from './moduleGhost';
import { createBackdrop, type BackdropSpec } from './backdrop';
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


/** Cap on `whenArtReady`, so a broken sheet never holds the loading screen. */
export const ART_READY_MAX_MS = 6000;

export interface Renderer {
  render(alpha: number): void;
  /** Where `render` reports its passes (labels `render/...`); the no-op by default. */
  setProbe(probe: Probe): void;
  resize(): void;
  dispose(): void;
  /** Resolves once the scene has drawn with every sheet it asked for loaded (a few quiet frames with every scene shown), or after `ART_READY_MAX_MS`. */
  whenArtReady(): Promise<void>;
  /** The sector grid every ship is stamped into. Ships are drawn for every ShipC (a scene reads its ShipC rectangle of it). */
  setSector(sector: SectorGrid): void;
  /** Make this grid the one the camera, picking and the editing markers work on, and frame the camera on it. */
  setGrid(grid: Grid): void;
  setCutaway(mode: CutawayMode): void;
  /** Roof hostile ships (default on); off shows their interior. */
  setRoofEnemies(on: boolean): void;
  /** Roof the player's own ship too (default off), to see it from outside. */
  setRoofPlayer(on: boolean): void;
  setOverlay(field: string | null): void;
  /** Selected tile(s) on `shipId`'s grid (default the camera ship's; derelicts and other ships take their own). */
  setSelection(tile: Tile | readonly Tile[] | null, shipId?: number): void;
  setHover(tile: Tile | null): void;
  setPreview(tiles: readonly Tile[], valid?: boolean): void;
  /** Painted areas (the shipyard plan): groups of tiles drawn filled or outlined in a colour, in the sector layer. Empty clears. */
  setAreas(groups: readonly AreaMarks[]): void;
  /** The world tile grid (thin lines over the whole node), shown while the build tools are open. */
  setWorldGrid(on: boolean): void;
  /** The line brush's cut: bold polylines through tile centres (empty clears). */
  setCutLine(segments: readonly (readonly Tile[])[], color?: number): void;
  /** The module being placed, drawn see-through at the cursor (red when invalid) with its access tile; null hides it. */
  setModuleGhost(g: ModuleGhostSpec | null): void;
  /** Center the camera on a (fractional) tile position of the camera ship's grid. */
  focusTile(x: number, y: number): void;
  /** Center the camera on a sector position (tiles). */
  focusSector(x: number, y: number): void;
  /** Frame the given ships (by grid id) in the view: centered, at the largest zoom that fits them (at least 1). */
  /** Fit the ships in view; `inset` (CSS px) keeps them clear of HUD bands along the top and bottom edge. */
  frameShips(gridIds: readonly number[], inset?: { top: number; bottom: number }): void;
  info(): RenderInfo;
  /** Head-and-shoulders portrait of a crew member (a PNG data URL, cached per look), or null while its sheets load. */
  portrait(id: number): string | null;
  /** The same for a look with no crew entity behind it (a lesson's instructor). */
  portraitOf(look: CrewLook): string | null;
  /** A dedicated portrait asset by manifest key, or null while it loads or if it does not exist. */
  portraitArt(key: string): string | null;
  /** A module def's art as an image at a rotation (the build catalog's thumbnail), or null while its sheets load. */
  moduleThumb(def: string, rot: number): ModuleThumb | null;
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
  /** Module construction site (its job id) whose ghost is under a canvas-relative position, or null. */
  pickSite(screenX: number, screenY: number): number | null;
  /** Mark module sites that are stuck (amber) and the selected one (job ids). */
  setSites(blocked: ReadonlySet<number>, selected: number | null): void;
  /** The ship tile (any ship in the sector) under a canvas-relative position, or null. */
  pickTileAny(screenX: number, screenY: number): { shipId: number; x: number; y: number } | null;
  /** The sector tile under a canvas-relative position, wherever it is (painting tools, asteroid rock). `lift`: read the point as that many tiles above the ground (the top of a rock block). */
  pickSector(screenX: number, screenY: number, lift?: number): Tile;
  /** Canvas-relative CSS px of a tile's centre on any ship. */
  screenOf(shipId: number, x: number, y: number): { x: number; y: number };
  /** Draw a ring under this crew member (null clears). */
  setSelectedCrew(ids: readonly number[]): void;
  /** The shuttle (vehicle entity) under a canvas-relative position, or null. */
  pickShuttle(screenX: number, screenY: number): number | null;
  /** Flash an order marker on a sector tile (centre x, y). */
  addOrderMarker(x: number, y: number, kind?: OrderKind): void;
  /** Drop every ship scene (the sector changed under them: a jump lifted the ships out); the next frame builds them again. */
  resetWorld(): void;
  /** Sim events of the last frame, for combat fx. */
  onEvents(events: readonly SimEvent[]): void;
  /** Show a ship in the combat inset's window (a page element; null hides it): a second camera over the same scene, drawn there every frame. */
  setInset(view: { shipId: number; view: HTMLElement } | null): void;
  /** The inset window's size in CSS px for a ship (sized to the ship at a pixel-perfect zoom), or null. */
  insetSize(shipId: number): { w: number; h: number } | null;
  /** The space behind the ships: this node's seed, nebula density and central body. */
  setBackdrop(spec: BackdropSpec): void;
  /** Show or hide the space backdrop (screenshot tooling: a flat background lets a script cut ships out). */
  showBackdrop(on: boolean): void;
  /** Where the threat markers read the seconds until an enemy weapon's committed shot lands. */
  setCommitEta(fn: (weaponId: number) => number | null): void;
  /** Where the threat arrows read each enemy weapon's colour (matches the incoming timeline). */
  setShotColor(fn: (weaponId: number) => number): void;
  /** The enemy tile or module the pointer would aim at while "Target in view" is armed (null clears the preview). */
  setAimHover(h: AimHover | null): void;
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
  /** Generated factions by id: a ship's roof livery comes from its generating faction's `art.livery`. */
  factions?: Readonly<Record<string, { art: { livery: string } }>>;
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
    // The game picks in its own coordinates; pixi's event system would hit-test the whole scene tree on every pointer move.
    eventFeatures: { move: false, globalMove: false, click: false, wheel: false },
  });
  // Sheets go to the GPU as they load and their decoded copy is dropped; if the context is lost they are decoded again.
  const atlas = await loadAtlas(undefined, { upload: (src) => gl.texture.initSource(src) });
  canvas.addEventListener('webglcontextlost', () => atlas.contextLost());
  canvas.addEventListener('webglcontextrestored', () => void atlas.contextRestored());
  if (high) initHalos(gl);
  const portraits = createPortraits(gl.extract, atlas, world, content.items);
  const thumbs = createModuleThumbs(gl.extract, atlas, content.modules);
  const stage = new Container();
  const cam = createCamera(high ? 3 : 2);
  const scenes = new Map<number, ShipScene>();
  let sector: SectorGrid | null = null;
  let refId = 0;
  let cutaway: CutawayMode = 'auto';
  let roofEnemies = true;
  let roofPlayer = false;
  let overlay: string | null = null;
  let hover: Tile | null = null;
  let selection: Tile | readonly Tile[] | null = null;
  let selShip = 0;
  let selectedCrew: readonly number[] = [];
  let siteMarks: { blocked: ReadonlySet<number>; selected: number | null } = { blocked: new Set(), selected: null };
  let lastFrame = animNow();

  // One world layer stack for every region (ship), in the sector frame: art origin = sector tile (0, 0).
  const backdrop = createBackdrop(atlas);
  stage.addChild(backdrop.root);
  let backdropOn = true;
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
  const pickHost = (): PickHost => ({ scenes, cam, origin, hidden: (id) => !!world.get(id, ShipC)?.outpost?.hidden });
  // PLACEHOLDER fight feedback and crew status marks, in the sector layer (see fightFx.ts, crewMarks.ts).
  const fightFx = createFightFx(world, SL.ui, () => SL.scale, { ship: shipOf, muzzle: (id) => crewMuzzle(world, atlas, content.items, id) });
  const sectorMarks = createMarkers(SL.ui);
  const worldGrid = createWorldGrid(SL.ui);
  const cutLine = createCutLine(SL.ui);
  const aimMarks = createAimMarks({ world, modules: content.modules, refId: () => refId, roofed: (id) => scenes.get(id)?.isRoofed() ?? false, scale: () => SL.scale }, SL.ui);
  /** The camera the world is currently placed for (the main one, or the inset's during pass B). */
  let placed: Camera = cam;
  let shotColor: (weaponId: number) => number = () => 0xff5a5a;
  let commitEta: (weaponId: number) => number | null = () => null;
  const threatMarks = createThreatMarks({ world, modules: content.modules, weapons: content.weapons ?? {}, refId: () => refId, roofed: (id) => scenes.get(id)?.isRoofed() ?? false, scale: () => SL.scale, commitEta: (id) => commitEta(id), color: (id) => shotColor(id),
    frame: () => ({ x0: -placed.originX / placed.scale, y0: -placed.originY / placed.scale, x1: (placed.w - placed.originX) / placed.scale, y1: (placed.h - placed.originY) / placed.scale }),
    shipCenter: (id) => { const sh = shipOf(id); const o = sh && origin(id); return sh && o ? { x: o.x + sh.width / 2 - 0.5, y: o.y + sh.height / 2 - 0.5 } : null; } }, SL.ui);
  const moduleGhost = createModuleGhost(SL.ui, thumbs, content.modules);
  /** Where a crew member's feet are drawn, in the sector-frame art px the overlays use (the sprite's own smoothed position). */
  const crewSpritePos = (id: number): { x: number; y: number; h: number } | null => {
    for (const [gid, sc] of scenes) {
      const p = sc.crewPos(id);
      if (!p) continue;
      const o = iso(origin(gid).x, origin(gid).y);
      return { x: p.x + o.x, y: p.y + o.y, h: p.h };
    }
    return null;
  };
  const orderFx = createOrderFx(world, SL.ui, crewSpritePos);
  const crewMarks = createCrewMarks(world, SL.ui, { ship: shipOf, visible: (id, x, y) => { const sc = scenes.get(id); return !!sc && sc.layers.visible && !sc.hidesCrewAt(x, y); } });

  function shipOf(shipId: number): Ship | undefined {
    return shipId ? world.get(shipId, ShipC) : undefined;
  }
  const ratio = () => cam.w / Math.max(1, canvas.clientWidth);

  function resize(): void {
    // At a fractional dpr (125% scaling, browser zoom 90%) the canvas box is not a whole number of physical px, and the browser
    // resamples a backing store that is not exactly that size: art px come out 1 and 2 px wide. So the backing store is the box
    // rounded down to whole physical px, and the canvas box is then set to exactly that size.
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = '';
    canvas.style.height = '';
    const box = canvas.getBoundingClientRect();
    const device = { w: Math.max(1, Math.floor(box.width * dpr + 1e-6)), h: Math.max(1, Math.floor(box.height * dpr + 1e-6)) };
    canvas.style.width = `${device.w / dpr}px`;
    canvas.style.height = `${device.h / dpr}px`;
    cam.resize(canvas.clientWidth || 1, canvas.clientHeight || 1, dpr, device);
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
    // Largest zoom level (whole from 1 up; fractional levels below 1) at which the whole ship fits (at least the smallest).
    cam.fitZoom(Math.min(cam.w / spanW, cam.h / spanH));
  }

  /**
   * A ship's roof livery, from its generating faction's art def. Debug URL parameters: `?bow=east|west` forces the end the
   * bow motifs take, `?livery=<livery id>` gives every ship that livery (screenshots of liveries no faction uses yet).
   */
  const params = new URLSearchParams(window.location.search);
  const bowParam = params.get('bow');
  const liveryParam = params.get('livery');
  const shipLivery = (s: Ship, grid: Grid) => ({
    ...liveryFor(s.faction, s.name, liveryParam ?? (s.gen ? content.factions?.[s.gen.faction]?.art.livery : undefined)),
    bowWest: bowParam ? bowParam === 'west' : bowWestOf(grid),
  });
  /** The bow motifs go to the end away from the engines (their mean column); a ship without engines faces west. */
  function bowWestOf(grid: Grid): boolean {
    let sum = 0;
    let n = 0;
    for (let y = grid.y0; y < grid.y0 + grid.height; y++)
      for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
        const m = world.get(grid.get('module', x, y), ModuleC);
        if (m && content.modules[m.def]?.engine) {
          sum += x;
          n++;
        }
      }
    return n === 0 || sum / n >= grid.x0 + grid.width / 2;
  }
  // a hidden outpost stays under its rock roof whatever the roof toggle says
  const roofFor = (id: number, s: Ship) => !!s.outpost?.hidden || wantsRoof(world, id, s, roofEnemies, roofPlayer);

  function addScene(s: Ship, grid: Grid): ShipScene {
    const sc = createShipScene(grid, { world, atlas, modules: content.modules, items: content.items, layers: W.region(high && grid.id === refId), roofed: roofFor(grid.id, s), livery: shipLivery(s, grid), beamLook: beamLookFor(s.gen?.faction), ...evaHost() });
    sc.setCutaway(cutaway);
    if (grid.id === refId) {
      sc.view.setOverlay(overlay);
      sc.view.setSelection(selection);
      sc.view.setHover(hover);
    } else if (grid.id === selShip) sc.view.setSelection(selection);
    sc.setSelectedCrew(selectedCrew);
    sc.setSites(siteMarks.blocked, siteMarks.selected);
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
    placed = c;
    const any = shipOf(refId) !== undefined;
    for (const [id, sc] of scenes) sc.layers.setVisible(any && !art.waiting(id) && regionInView(id, sc.grid, c));
    // Shrunk art (the main camera below zoom 1) is drawn with linear filtering, in the inset too.
    atlas.setSmooth(c.scale < 1);
    W.setUiVisible(target === null);
    W.setMarksVisible(false);
    SL.ui.visible = true; // threat markers, crew marks and fight fx draw in the inset too
    W.root.scale.set(c.scale);
    W.root.position.set(c.originX, c.originY);
    SL.setScale(c.scale);
    SL.world.position.set(c.originX, c.originY);
  }


  /**
   * Below the 1:1 level (1/2) the art px grid cannot be drawn sprite by sprite: offsets fall on fractions of a device px, so rounding
   * each sprite steps wall pieces apart and not rounding blends tile edges into faint seams. So the world is drawn at 1/2 (every sprite
   * on whole device px) into a texture k times the canvas on each side, and that image is averaged down by k (in steps of 2, linear
   * filter on exact texel boundaries = a box filter). Every seam would have to survive averaging a clean image.
   */
  const mini = new Sprite();
  mini.visible = false;
  stage.addChildAt(mini, 1);
  const miniRts: RenderTexture[] = [];
  const MAX_MINI_PX = 96e6;
  /** The GPU's own texture and renderbuffer size limits (4096 on some GPUs), so the pass falls back before it would fail. */
  const maxMiniSide = ((): number => {
    const ctx = (gl as unknown as { gl?: WebGLRenderingContext }).gl;
    if (!ctx) return 4096;
    return Math.min(8192, ctx.getParameter(ctx.MAX_TEXTURE_SIZE) as number, ctx.getParameter(ctx.MAX_RENDERBUFFER_SIZE) as number);
  })();
  function miniRt(i: number, w: number, h: number): RenderTexture {
    let rt = miniRts[i];
    if (!rt || rt.width !== w || rt.height !== h) {
      rt?.destroy(true);
      rt = RenderTexture.create({ width: w, height: h, resolution: 1, scaleMode: 'linear' });
      miniRts[i] = rt;
    }
    return rt;
  }
  const setArt = (on: boolean): void => {
    W.setArtVisible(on);
    for (const c of [SL.under, SL.floor, SL.decal, SL.sorted, SL.fx, SL.fxAdd]) c.visible = on;
  };
  /** Draw the world at 1/2 into a texture and average it down to the canvas size; false when it would be too big (drawn directly instead). */
  function renderMini(k: number, inView: Sprite): boolean {
    const w = cam.w * k, h = cam.h * k;
    if (w * h > MAX_MINI_PX || w > maxMiniSide || h > maxMiniSide) return false;
    const vcam = { scale: 0.5, zoom: 0.5, w, h, originX: cam.originX * k, originY: cam.originY * k } as unknown as Camera;
    place(vcam, null);
    W.setUiVisible(false);
    SL.ui.visible = false;
    threatMarks.update();
    backdrop.root.visible = false;
    const insetShown = inView.visible;
    inView.visible = false;
    let rt = miniRt(0, w, h);
    gl.render({ container: stage, target: rt, clear: true, clearColor: [0, 0, 0, 0] });
    inView.visible = insetShown;
    let n = 1;
    for (let f = k; f > 1; f /= 2, n++) {
      const down = new Sprite(rt);
      down.scale.set(0.5);
      const next = miniRt(n, Math.ceil(rt.width / 2), Math.ceil(rt.height / 2));
      gl.render({ container: down, target: next, clear: true, clearColor: [0, 0, 0, 0] });
      down.destroy();
      rt = next;
      }
    mini.texture = rt;
    return true;
  }

  // The combat inset: camera pass B over the same world stack, into a texture shown above the main pass.
  const inset = createInsetPass({ ship: shipOf, origin, roofed: (id) => scenes.get(id)?.isRoofed() ?? false, ratio, place });
  stage.addChild(inset.sprite);

  let probe: Probe = NOOP_PROBE;
  let frames = 0;

  return {
    setProbe(p) {
      probe = p;
    },
    whenArtReady() {
      return new Promise<void>((resolve) => {
        const t0 = performance.now();
        let quiet = 0;
        let seen = frames;
        const poll = (): void => {
          if (frames !== seen) {
            seen = frames;
            const hidden = scenes.size === 0 || [...scenes.keys()].some((id) => art.waiting(id));
            quiet = atlas.busy() === 0 && !hidden ? quiet + 1 : 0;
          }
          if (quiet >= 5 || performance.now() - t0 > ART_READY_MAX_MS) resolve();
          else setTimeout(poll, 30);
        };
        poll();
      });
    },
    render(alpha) {
      if (atlas.restoring) return;
      frames++;
      probe.begin('render/sync');
      sync();
      art.update();
      probe.end('render/sync');
      const now = animNow();
      const dt = Math.min(0.1, (now - lastFrame) / 1000);
      lastFrame = now;
      W.setScale(cam.scale);
      probe.begin('render/scenes');
      for (const [id, sc] of scenes) {
        const o = origin(id);
        const p = iso(o.x, o.y);
        sc.layers.setOrigin(p.x, p.y, o.x + o.y);
        sc.update(dt);
      }
      probe.end('render/scenes');
      probe.begin('render/views');
      asteroids.update(sector);
      pods.update(dt);
      shuttles.update(dt);
      boxes.update();
      aimMarks.update();
      threatMarks.update();
      fightFx.update(dt);
      crewMarks.update();
      orderFx.update();
      probe.end('render/views');
      probe.begin('render/fx');
      fx.update(dt, alpha);
      sectorParticles.update(dt);
      // Before the census settles: the body's texture lookup marks its sheet in use, so it is never evicted while on screen.
      backdrop.update(cam.w, cam.h, cam.originX, cam.originY, ratio());
      art.settle();
      probe.end('render/fx');
      probe.begin('render/inset');
      backdrop.root.visible = false; // the combat panel has its own flat background
      inset.render(gl, stage, () => threatMarks.update());
      backdrop.root.visible = backdropOn;
      probe.end('render/inset');
      probe.begin('render/gl');
      const k = cam.scale < 0.5 - 1e-9 ? Math.round(0.5 / cam.scale) : 1;
      const shrunk = k > 1 && renderMini(k, inset.sprite);
      backdrop.root.visible = backdropOn;
      place(cam, null);
      backdrop.update(cam.w, cam.h, cam.originX, cam.originY, ratio());
      threatMarks.update();
      // Shrunk: the art is the averaged texture; only the ui layers (one-pixel grid lines, markers) draw directly, at the real scale.
      mini.visible = shrunk;
      setArt(!shrunk);
      gl.render({ container: stage });
      mini.visible = false;
      setArt(true);
      probe.end('render/gl');
      probe.begin('render/present');
      atlas.tick();
      probe.end('render/present');
      probe.count('render/sceneCount', scenes.size);
    },
    resize,
    resetWorld() {
      for (const sc of scenes.values()) sc.dispose();
      scenes.clear();
    },
    setBackdrop(spec) {
      backdrop.setSpec(spec);
    },
    showBackdrop(on) {
      backdropOn = on;
      backdrop.root.visible = on;
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
    setRoofPlayer(on) {
      roofPlayer = on;
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
    setAreas: (groups) => sectorMarks.setAreas(groups),
    setCutLine: (segments, color = 0xff3df0) => cutLine.set(segments, color),
    setWorldGrid: (on) => worldGrid.set(on, sector?.width ?? 0, sector?.height ?? 0),
    setModuleGhost: (g) => moduleGhost.set(g),
    focusTile(x, y) {
      const p = iso(x, y); // a sector tile
      cam.centerOn(p.x, p.y - 8 * ART_SCALE);
    },
    focusSector(x, y) {
      const p = sectorArt(x, y);
      cam.centerOn(p.x, p.y);
    },
    frameShips(ids, inset) {
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
      const dpr = window.devicePixelRatio || 1;
      const top = (inset?.top ?? 0) * dpr, bottom = (inset?.bottom ?? 0) * dpr;
      cam.centerOn((x0 + x1) / 2, (y0 + y1) / 2);
      cam.fitZoom(Math.min(cam.w / (x1 - x0 + 64 * ART_SCALE), (cam.h - top - bottom) / (y1 - y0 + 64 * ART_SCALE)));
      if (top || bottom) cam.centerOn((x0 + x1) / 2, (y0 + y1) / 2 - (top - bottom) / 2 / cam.zoom);
    },
    info: () => {
      let sprites = sectorParticles.count();
      for (const sc of scenes.values()) sprites += sc.sprites();
      return { sprites, zoom: cam.zoom };
    },
    portrait: (id) => portraits.url(id),
    portraitOf: (look) => portraits.lookUrl(look),
    portraitArt: (key) => portraits.assetUrl(key),
    moduleThumb: (def, rot) => thumbs.get(def, rot),
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
    pickShuttle(sx, sy) {
      const a = cam.toArt(sx, sy);
      return shuttles.pick(a.x, a.y);
    },
    addOrderMarker: (x, y, kind) => orderFx.addMarker(x, y, kind),
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
    pickSite(sx, sy) {
      const a = cam.toArt(sx, sy);
      const o = origin(refId);
      const p = iso(o.x, o.y);
      return scenes.get(refId)?.pickSite(a.x - p.x, a.y - p.y) ?? null;
    },
    setSites(blocked, selected) {
      siteMarks = { blocked, selected };
      for (const sc of scenes.values()) sc.setSites(blocked, selected);
    },
    setSelectedCrew(ids) {
      selectedCrew = ids;
      orderFx.setSelected(ids);
      for (const sc of scenes.values()) sc.setSelectedCrew(ids);
    },
    onEvents: (events) => {
      fx.onEvents(events);
      fightFx.onEvents(events);
    },
    setAimHover: (h) => aimMarks.setHover(h),
    setInset: (v) => inset.set(v),
    insetSize: (id) => { const sh = shipOf(id); if (!sh) return null; const f = insetFit(sh, scenes.get(id)?.isRoofed() ? ROOF_H : 0, ratio()); return { w: f.w, h: f.h }; },
    setCommitEta: (fn) => { commitEta = fn; },
    setShotColor: (fn) => { shotColor = fn; },
    dispose() {
      asteroids.dispose();
      pods.dispose();
      rockLayers.dispose();
      shuttles.dispose();
      boxes.dispose();
      fightFx.dispose();
      crewMarks.dispose();
      orderFx.dispose();
      fx.dispose();
      backdrop.dispose();
      sectorParticles.dispose();
      inset.dispose();
      for (const sc of scenes.values()) sc.dispose();
      scenes.clear();
      gl.destroy();
    },
  };
}
