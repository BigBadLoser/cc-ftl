import { mount } from 'svelte';
import { setAnimPaused } from './render/animClock';
import App from './ui/App.svelte';
import type { UiApi, UiIcon, UiSession } from './ui/api';
import type { UiStarArt } from './ui/starmapApi';
import { createBridge } from './app/bridge';
import { createController } from './app/controller';
import { buildItemDefs, buildRecipes, buildStructCosts } from './app/logisticsSnapshot';
import { loadItemIcons } from './app/itemIcons';
import { loadStarmapArt } from './app/starmapArt';
import { createStarmapGpu } from './render/starmap';
import { createStore } from './app/store';
import { overlayLegend, overlayList } from './app/overlayLegend';
import { createErrorLog } from './app/errors';
import { installConsoleRing } from './app/consoleRing';
import { buildContext, buildIssueUrl, type ReportInfo } from './app/bugReport';
import { attachInput } from './app/input';
import type { OrderId } from './app/orders';
import { createLoop } from './app/loop';
import { buildRepro } from './app/repro';
import { installDebugHook } from './app/debugHook';
import { DRAFT_CSS, DRAFT_CSS_FILL } from './render/draftColor';
import { createRenderer, type Renderer } from './render/scene';
import { createSaver, lostReason, reloadLastSave, restartNewGame, startGame } from './app/saves';
import { content } from './content';
import { BodyC, CrewC, ModuleC, footprintTiles, NOOP_PROBE, PositionC, SAVE_VERSION, commitEtaSec, shotColor, shotSlot, galaxyIndex, nodeOf, serialize, ShipC, type Probe } from './sim';
import { shipGrid } from './sim/regions';
import { homeShip } from './sim/index';
import { damageScenarioCommands } from './app/damageScenario';
import { MIN_SHIP_GAP, REGION_PAD } from './sim/tuning';

// The drafted-crew colour is defined once (render/draftColor.ts) and shared with the UI as a CSS token.
document.documentElement.style.setProperty('--draft', DRAFT_CSS);
document.documentElement.style.setProperty('--draft-fill', DRAFT_CSS_FILL);

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app element');


const errorLog = createErrorLog();
const consoleRing = installConsoleRing();
let gameCanvas: HTMLCanvasElement | undefined;
// The saved game if there is one (`?seed=` forces a new game of that seed), else a new one.
const start = startGame(new URLSearchParams(location.search).get('seed'));
const sim = start.sim;
const bridge = createBridge(sim);
const controller = createController(sim, bridge);
let renderer: Renderer | undefined;
let starmapOpen = false;
let hook: { onEvents(types: readonly string[]): void } | undefined;

const itemIcons = createStore<Record<string, UiIcon>>({});
loadItemIcons(Object.keys(content.items)).then((v) => itemIcons.set(v)).catch((e: unknown) => errorLog.push(e));
const starmapArt = createStore<UiStarArt | null>(null);
loadStarmapArt().then((v) => starmapArt.set(v)).catch((e: unknown) => errorLog.push(e));

/** Where the layers report timings: the no-op until the profiler (`?perf` or F3, loaded on demand) swaps itself in. */
let probe: Probe = NOOP_PROBE;
const setProbe = (p: Probe | null): void => {
  probe = p ?? NOOP_PROBE;
  renderer?.setProbe(probe);
};

let upkeepFrame = 0;
const loop = createLoop({
  sim,
  probe: () => probe,
  // The starmap covers the whole screen, and in hyperspace or while deploying the sector is empty: skip drawing the world.
  render: (alpha) => {
    // World animations freeze while the game is paused (speed 0); camera, UI and hover feedback keep running.
    setAnimPaused(loop.getSpeed() === 0);
    if (upkeepFrame++ % 10 === 0) {
      probe.begin('ui/upkeep');
      controller.upkeep();
      probe.end('ui/upkeep');
    }
    if (!starmapOpen && sim.sector.state === 'active') {
      probe.begin('render/main');
      renderer?.render(alpha);
      probe.end('render/main');
    }
  },
  onEvents: (events) => {
    probe.begin('ui/events');
    controller.onEvents(events);
    renderer?.onEvents(events);
    probe.end('ui/events');
    // A jump lifts the ships out of the sector: their scenes are stale. The deployed ship is shown (and framed) like a new game's.
    for (const e of events) {
      if (e.type === 'sector.jumped' || e.type === 'galaxy.hyperspace' || e.type === 'galaxy.eventLeft') {
        renderer?.setSector(sim.sector.grid); // archiving and restoring swap the sector's grid object
        renderer?.resetWorld();
      }
      else if (e.type === 'sector.deployed') {
        const grid = shipGrid(sim, e.ship);
        if (grid) renderer?.setGrid(grid);
        setTimeout(save, 0); // after a jump lands: the new node is in the save
      }
    }
    hook?.onEvents(events.map((e) => e.type));
  },
  onFrame: (stats) => {
    probe.begin('ui/bridge');
    const info = renderer?.info();
    if (info) probe.count('render/sprites', info.sprites);
    bridge.update(stats, info);
    probe.end('ui/bridge');
  },
});
bridge.attachLoop(loop);

// Profiler (debug only, loaded on demand): `?perf` turns it on at start, F3 toggles its panel. See docs/PROFILING.md.
const perfBoot = (): Promise<import('./app/profiler/install').ProfilerHandle> => import('./app/profiler/install').then((m) => m.installProfiler(setProbe));
if (new URLSearchParams(location.search).has('perf')) void perfBoot().then((h) => h.api.enable());
window.addEventListener('keydown', (e) => {
  if (e.key !== 'F3') return;
  e.preventDefault();
  void perfBoot().then((h) => h.togglePanel());
});

/**
 * Saving: the game is written every AUTOSAVE_MS, when the page is hidden or closed (a phone killing the tab), and after a
 * jump lands. Once the game is lost it is never written again, so the save on disk is the last one before the loss and
 * "Load last save" goes back to it.
 */
const AUTOSAVE_MS = 30_000;
const session = createStore<UiSession>({ notice: start.notice, lost: null });
// Read the loss from the sim too, not only the session: the poll below lags by up to a second. A `?seed=` game never saves.
const save = createSaver(sim, start.persist, () => session.get().lost !== null);
setInterval(save, AUTOSAVE_MS);
setInterval(() => {
  if (session.get().lost) return;
  const lost = lostReason(sim);
  if (!lost) return;
  // The world stops behind the game-over screen for good: no speed key or button can start it again.
  bridge.setSpeed(0);
  loop.stop();
  session.set({ ...session.get(), lost });
}, 1000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
window.addEventListener('pagehide', save);

/** Frame one ship in the camera (null: the player's), clear of the combat HUD bands while a fight is on. */
function focusFight(ship: number | null): void {
  renderer?.frameShips([ship ?? homeShip(sim)], sim.sector.inCombat ? { top: 40, bottom: 170 } : undefined);
}

/**
 * Generated enemies (behind a flag): `?shipgen=1` makes "Spawn raider" generate a ship of a random faction,
 * `?shipgen=navy` (scrapper, drones) picks one; `?depth=N` sets the sector depth (default 2).
 */
const params = new URLSearchParams(location.search);
const shipgenFlag = params.get('shipgen');
const genDepth = Math.max(0, Math.floor(Number(params.get('depth') ?? 2)) || 0);
/** `?genAt=dx,dy`: where a generated ship's centre goes, in tiles from the player's ship's centre (default 18,22). */
const genAt = (params.get('genAt') ?? '18,22').split(',').map((v) => Math.round(Number(v) || 0)) as [number, number];

/** Debug: generate a ship of `faction` (random if omitted) and put it where a raider would go. */
function spawnGenerated(faction?: string): void {
  const mine = homeShipC();
  const ids = Object.keys(content.factions);
  const id = faction ?? ids[Math.floor(Math.random() * ids.length)];
  if (!mine || !id) return;
  const cx = Math.round(mine.x + mine.width / 2 + genAt[0]);
  const cy = Math.round(mine.y + mine.height / 2 + (genAt[1] ?? 22));
  bridge.dispatch({ type: 'debug.spawnGenerated', faction: id, depth: genDepth, seed: (Math.random() * 0x7fffffff) >>> 0, cx, cy });
}

/**
 * Debug: `?shipgen=derelict` (or `derelict:scrapper`) makes "Spawn raider" spawn a ruined derelict instead; `?ruin=0.8`
 * sets the intensity and `?cause=combat|decay` the cause (both rolled per seed otherwise).
 */
function spawnDerelict(faction?: string): void {
  const mine = homeShipC();
  const ids = Object.keys(content.factions);
  const id = faction ? `faction.${faction.replace(/^faction\./, '')}` : ids[Math.floor(Math.random() * ids.length)];
  if (!mine || !id) return;
  const cause = params.get('cause');
  const intensity = params.has('ruin') ? Math.max(0, Math.min(1, Number(params.get('ruin')) || 0)) : 0.5;
  bridge.dispatch({
    type: 'debug.spawnDerelict', faction: id, depth: genDepth, seed: (Math.random() * 0x7fffffff) >>> 0, intensity,
    cx: Math.round(mine.x + mine.width / 2 + genAt[0]), cy: Math.round(mine.y + mine.height / 2 + (genAt[1] ?? 22)),
    ...(cause === 'combat' || cause === 'decay' ? { cause } : {}),
  });
}

/** Debug: put a raider a fair distance from the player's ship (diagonally, so a fight fits on a phone screen too). */
function spawnRaider(boarders = false, far = params.has('far')): void {
  const template = boarders ? 'ship.raiderBoarder' : 'ship.raider';
  if (shipgenFlag?.startsWith('derelict')) {
    spawnDerelict(shipgenFlag.split(':')[1]);
    return;
  }
  if (shipgenFlag) {
    spawnGenerated(shipgenFlag === '1' || shipgenFlag === 'true' ? undefined : `faction.${shipgenFlag.replace(/^faction\./, '')}`);
    return;
  }
  const mine = homeShipC();
  const t = content.ships[template];
  if (!mine || !t) return;
  const w = Math.max(...t.rows.map((r) => r.length));
  const h = t.rows.length;
  const cy = mine.y + mine.height / 2;
  // Just past the player ship's padded frame plus the minimum gap, level with it, so the placement is never refused as tooClose.
  // `far`: a typical engagement distance, well past what a camera can frame beside the player's ship (about 55 tiles east, 45 north: the free corner of the start node).
  const x = Math.min(sim.sector.width - w, mine.x + mine.width + (far ? 55 : MIN_SHIP_GAP + 2 * REGION_PAD + 4));
  const y = Math.min(sim.sector.height - h, Math.max(0, Math.round(cy - h / 2) - (far ? 45 : 0)));
  bridge.dispatch({ type: 'debug.spawnEnemy', template, x, y });
}

function homeShipC() {
  return sim.world.get(homeShip(sim), ShipC);
}

/**
 * Debug: generate a station (`kind` 'station.trading'..., `size` outpost | station | hub) east of everything in the node
 * and frame it with the player's ship. `?station=trading:hub` spawns one at start.
 */
function spawnStation(kind: string, size: 'outpost' | 'station' | 'hub', frameStation = true): void {
  const before = new Set(sim.world.query(ShipC));
  bridge.dispatch({ type: 'debug.spawnStation', kind, size, seed: (Math.random() * 0x7fffffff) >>> 0 });
  // The command runs on the next tick: frame the new station once it exists.
  const frame = (tries: number): void => {
    const id = sim.world.query(ShipC).find((i) => !before.has(i) && sim.world.get(i, ShipC)?.immobile);
    if (id) renderer?.frameShips(frameStation ? [homeShip(sim), id] : [homeShip(sim)]);
    else if (tries > 0) setTimeout(() => frame(tries - 1), 100);
  };
  frame(30);
}
const stationFlag = params.get('station');
/**
 * `?scenario=hullplan`: playtest the hull plan brushes. A trading hub (visit cap 100) beside the ship, plenty of credits and metal, the Hull plan
 * tool open with the Rectangle brush, and the game running at normal speed. The plan starts empty; the station's Shipyard tab is one click away.
 */
const scenario = params.get('scenario');
/**
 * `?scenario=damage`: a fire, a hull breach and a damaged reactor (see app/damageScenario.ts).
 * `?scenario=fight`: a raider beside the ship and the game running at normal speed, for the combat view; add `&far` for a raider at engagement distance.
 * `&charged` also fills the FTL drive.
 * `?scenario=handover`: a trade station beside the ship and a delivery for it with its crate on deck, so the station shuttle comes for it. `?scenario=bounty` / `?scenario=survey`:
 * a finished bounty / survey to hand in, and you at the nearest military / research station (drops in by itself). See galaxy/jobsDebug.ts.
 */
function startJobScenario(name: 'handover' | 'bounty' | 'survey'): void {
  if (name === 'handover') spawnStation('station.trading', 'outpost'); // a fresh game has no station ship at the start node: the shuttle needs one
  bridge.dispatch({ type: 'debug.jobScenario', name });
  bridge.dispatch({ type: 'debug.setCredits', value: 500 });
  loop.setSpeed(1);
  const spots = [[100, 60], [20, 50], [60, 120], [150, 40], [30, 130], [170, 110], [10, 10]] as const;
  const deploy = (i: number): void => {
    if (name === 'handover' || sim.sector.state === 'active' || i >= 60) return;
    if (sim.sector.state === 'deploying') bridge.dispatch({ type: 'sector.deploy', x: spots[i % spots.length]![0], y: spots[i % spots.length]![1] });
    setTimeout(() => deploy(i + 1), 150);
  };
  deploy(0);
}
function startScenario(): void {
  if (scenario === 'log') return logScenario();
  if (scenario === 'handover' || scenario === 'bounty' || scenario === 'survey') return startJobScenario(scenario);
  if (scenario === 'fight') {
    // The start node holds a station that leaves no room for a raider: jump to an empty neighbour first, deploy where the ship was, then spawn the raider.
    const g = sim.galaxy;
    const next = (galaxyIndex(g).adjacent.get(g.current) ?? []).map((e) => (e.a === g.current ? e.b : e.a))
      .find((id) => !nodeOf(sim, id)?.structures.length) ?? g.current;
    const at = homeShipC();
    if (next !== g.current) bridge.dispatch({ type: 'debug.galaxyTeleport', node: next });
    setTimeout(() => {
      if (at) bridge.dispatch({ type: 'sector.deploy', x: at.x, y: at.y });
      setTimeout(() => {
        spawnRaider();
        if (params.has('charged')) bridge.dispatch({ type: 'debug.chargeFtl' });
      }, 400);
    }, 400);
    loop.setSpeed(1);
    return;
  }
  if (scenario === 'damage') {
    loop.setSpeed(1);
    // Rooms exist after the first ticks: set the scene then. Crew answer the fire and the breach on their own.
    setTimeout(() => { for (const cmd of damageScenarioCommands(sim)) bridge.dispatch(cmd); }, 600);
    return;
  }
  if (scenario !== 'hullplan') return;
  spawnStation('station.trading', 'hub', false); // the camera stays on the ship and the open space around it
  bridge.dispatch({ type: 'debug.setCredits', value: 100000 });
  bridge.dispatch({ type: 'debug.giveItems', item: 'item.metal', count: 500 });
  controller.setTool({ tool: 'build', build: 'hull', hull: { brush: 'rect', erase: false, mirror: false } });
  loop.setSpeed(1);
}

/**
 * `?scenario=log`: look at the ship's log and alerts. A raider arrives (combat alert, jumps to it), a fire breaks out on the ship, and a few
 * seconds later 450 credits come in (the log entry pulses).
 */
function logScenario(): void {
  // The first free spot wins (a rejected spawn overlaps something).
  const spots = [[110, 80], [60, 20], [20, 100], [150, 30], [100, 50], [40, 90], [130, 110]];
  spots.forEach(([x, y], i) => setTimeout(() => { if (!sim.sector.inCombat) bridge.dispatch({ type: 'debug.spawnEnemy', template: 'ship.raider', x: x as number, y: y as number }); }, i * 400));
  const crew = sim.world.query(CrewC)[0];
  const p = crew === undefined ? undefined : sim.world.get(crew, PositionC);
  if (p) bridge.dispatch({ type: 'debug.setField', ship: homeShip(sim), x: Math.round(p.x), y: Math.round(p.y), field: 'fire', value: 200 });
  loop.setSpeed(3);
  for (const [ms, amount] of [[6000, 80], [8000, 200], [12000, 450]] as const) setTimeout(() => bridge.dispatch({ type: 'debug.setCredits', value: sim.trade.credits + amount }), ms);
}

/** The WebGL driver's renderer string, if the browser exposes it; pixi's canvas already owns a webgl context, so asking again returns it. */
function gpuName(): string | null {
  try {
    const gl = (gameCanvas?.getContext('webgl2') ?? gameCanvas?.getContext('webgl')) as WebGLRenderingContext | null | undefined;
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : null;
  } catch {
    return null;
  }
}

function reportInfo(): ReportInfo {
  return {
    commit: __COMMIT__, url: location.href, seed: sim.seed, turn: sim.galaxy.turn, node: sim.galaxy.current, saveVersion: SAVE_VERSION,
    userAgent: navigator.userAgent, viewport: { w: innerWidth, h: innerHeight }, dpr: devicePixelRatio, gpu: gpuName(),
    errors: consoleRing.get().map((e) => ({ message: e.message, stack: e.stack })),
  };
}

const api: UiApi = {
  snapshot: bridge.snapshot,
  session,
  newGame: restartNewGame,
  loadLastSave: reloadLastSave,
  dismissNotice: () => session.set({ ...session.get(), notice: null }),
  inspect: bridge.inspect,
  errors: errorLog.errors,
  crew: bridge.crew,
  hostiles: bridge.hostiles,
  focusCrew: controller.focusCrew,
  attack: controller.attack,
  selectedCrew: controller.selectedCrew,
  selectedGroup: controller.selectedGroup,
  selectedShuttle: controller.selectedShuttle,
  selectBox: controller.selectBox,
  contextMenu: controller.contextMenu,
  pickContext: (id) => controller.pickContext(id as OrderId | null),
  modules: bridge.modules,
  moduleDefs: bridge.moduleDefs,
  placeHint: controller.placeHint,
  items: buildItemDefs(sim),
  recipes: buildRecipes(sim),
  structCosts: buildStructCosts(sim),
  itemIcons,
  starmapArt,
  createStarmapGpu,
  stock: bridge.stock,
  storages: bridge.storages,
  fabs: bridge.fabs,
  research: bridge.research,
  selectedModule: controller.selectedModule,
  sites: bridge.sites,
  selectedSite: controller.selectedSite,
  selectSite: controller.selectSite,
  selectedShip: controller.selectedShip,
  selectShip: controller.selectShip,
  stats: bridge.stats,
  jobs: bridge.jobs,
  goals: bridge.goals,
  stranded: bridge.stranded,
  alerts: controller.alerts.list,
  log: controller.log.list,
  combat: bridge.combat,
  ftl: bridge.ftl,
  shuttles: bridge.shuttles,
  trade: bridge.trade,
  yard: bridge.yard,
  watchYard: bridge.watchYard,
  prizes: bridge.prizes,
  mining: bridge.mining,
  selectedAsteroid: controller.selectedAsteroid,
  aiming: controller.aiming.aiming,
  setAiming: controller.aiming.set,
  selectAsteroid: controller.selectAsteroid,
  story: bridge.story,
  starmap: bridge.starmap,
  planRoute: bridge.planRoute,
  deploy: bridge.deploy,
  deployCheck: bridge.deployCheck,
  jumpWarnings: bridge.jumpWarnings,
  setStarmapOpen: (open) => {
    starmapOpen = open;
    bridge.setStarmapOpen(open);
  },
  chooseStory: bridge.chooseStory,
  focusShuttle: (id) => {
    const b = sim.world.get(id, BodyC);
    if (b) renderer?.focusSector(b.x, b.y);
  },
  setRoofEnemies: (on) => renderer?.setRoofEnemies(on),
  setRoofPlayer: (on) => renderer?.setRoofPlayer(on),
  focusFight: (ship) => focusFight(ship),
  insetSize: (ship) => renderer?.insetSize(ship) ?? null,
  moduleScreenRect: (id) => {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!renderer || !m || !def) return null;
    const tiles = footprintTiles(def, m.x, m.y, m.rot);
    const o = renderer.screenOf(0, m.x, m.y);
    const dx = renderer.screenOf(0, m.x + 1, m.y);
    const half = Math.max(Math.abs(dx.x - o.x), Math.abs(dx.y - o.y)) * 0.75; // a tile's diamond is about this far from its centre
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const t of tiles) {
      const p = renderer.screenOf(0, t.x, t.y);
      x0 = Math.min(x0, p.x - half); x1 = Math.max(x1, p.x + half);
      y0 = Math.min(y0, p.y - half * 1.5); y1 = Math.max(y1, p.y + half * 0.75); // the module stands up from the floor: more room above
    }
    return x0 === Infinity ? null : { x0, y0, x1, y1 };
  },
  setInset: (view) => renderer?.setInset(view && { shipId: view.ship, view: view.view }),
  spawnRaider: (boarders) => spawnRaider(boarders),
  spawnGenerated: (faction) => spawnGenerated(faction),
  spawnStation: (kind, size) => spawnStation(kind, size),
  overlayList,
  overlayLegend,
  dismissAlert: controller.alerts.dismiss,
  focusAlert: controller.focusAlert,
  focusSubject: controller.focusSubject,
  selectModule: controller.selectModule,
  tool: controller.tool,
  toast: controller.toast,
  setTool: controller.setTool,
  selectCrew: controller.selectCrew,
  dispatch: bridge.dispatch,
  setSpeed: bridge.setSpeed,
  togglePause: bridge.togglePause,
  clearErrors: errorLog.clear,
  buildRepro: () => buildRepro(sim, errorLog.get()),
  bugReport: {
    context: () => buildContext(reportInfo()),
    issue: (draft) => buildIssueUrl(draft, reportInfo()),
    saveJson: () => serialize(sim),
    // A webgl canvas only keeps its pixels until the frame is presented: draw one now and read it in the same task.
    screenshot: () => new Promise((resolve) => {
      if (!gameCanvas) return resolve(null);
      renderer?.render(1);
      gameCanvas.toBlob(resolve, 'image/png');
    }),
  },
  throwTestError: () => {
    setTimeout(() => {
      throw new Error('Test error from debug panel');
    }, 0);
  },
  portrait: (id) => renderer?.portrait(id) ?? null,
  moduleThumb: (def, rot) => renderer?.moduleThumb(def, rot) ?? null,
  setCutaway: (mode) => renderer?.setCutaway(mode),
  setOverlay: (field) => renderer?.setOverlay(field),
  attachCanvas(canvas) {
    gameCanvas = canvas;
    createRenderer(canvas, matchMedia('(max-width: 600px)').matches ? 'low' : 'high', sim.world, content)
      .then((r) => {
        renderer = r;
        r.setCommitEta((id) => commitEtaSec(sim, id));
        r.setShotColor((id) => shotColor(shotSlot(sim, id)));
        r.setProbe(probe);
        if (new URLSearchParams(location.search).has('hook')) hook = installDebugHook(sim, r);
        r.setSector(sim.sector.grid);
        const grid = shipGrid(sim, homeShip(sim));
        if (grid) r.setGrid(grid);
        attachInput(canvas, r, controller.attach(r));
        window.addEventListener('resize', () => r.resize());
        loop.start();
        startScenario();
        if (stationFlag) {
          const [k, s] = stationFlag.split(':');
          spawnStation(`station.${(k ?? 'trading').replace(/^station\./, '')}`, (s === 'station' || s === 'hub' ? s : 'outpost'));
        }
        // Build the starmap's geometry in idle time (one small piece per slot), so its first open does not wait for it.
        const idle = (f: () => void): void => (typeof requestIdleCallback === 'function' ? void requestIdleCallback(f, { timeout: 3000 }) : void setTimeout(f, 100));
        const warm = (): void => { if (bridge.warmStarmap()) idle(warm); };
        setTimeout(() => idle(warm), 1500);
      })
      .catch((e: unknown) => errorLog.push(e));
  },
};

mount(App, { target, props: { api } });
