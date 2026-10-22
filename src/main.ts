import { mount } from 'svelte';
import App from './ui/App.svelte';
import type { UiApi, UiIcon } from './ui/api';
import { createBridge } from './app/bridge';
import { createController } from './app/controller';
import { buildModuleDefs } from './app/moduleSnapshot';
import { buildItemDefs, buildRecipes, buildStructCosts } from './app/logisticsSnapshot';
import { loadItemIcons } from './app/itemIcons';
import { createStore } from './app/store';
import { overlayLegend, overlayList } from './app/overlayLegend';
import { createErrorLog } from './app/errors';
import { attachInput } from './app/input';
import { createLoop } from './app/loop';
import { buildRepro } from './app/repro';
import { installDebugHook } from './app/debugHook';
import { createRenderer, type Renderer } from './render/scene';
import { content } from './content';
import { BodyC, newGame, ShipC } from './sim';
import { shipGrid } from './sim/regions';
import { homeShip } from './sim/index';
import { MIN_SHIP_GAP, REGION_PAD } from './sim/tuning';

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app element');

const param = new URLSearchParams(location.search).get('seed');
const seed = param !== null && Number.isFinite(Number(param)) ? Number(param) >>> 0 : (Math.random() * 0x100000000) >>> 0;

const errorLog = createErrorLog();
const sim = newGame(seed, content);
const bridge = createBridge(sim);
const controller = createController(sim, bridge);
let renderer: Renderer | undefined;
let hook: { onEvents(types: readonly string[]): void } | undefined;

const itemIcons = createStore<Record<string, UiIcon>>({});
loadItemIcons(Object.keys(content.items)).then((v) => itemIcons.set(v)).catch((e: unknown) => errorLog.push(e));

const loop = createLoop({
  sim,
  render: (alpha) => renderer?.render(alpha),
  onEvents: (events) => {
    controller.onEvents(events);
    renderer?.onEvents(events);
    hook?.onEvents(events.map((e) => e.type));
  },
  onFrame: (stats) => bridge.update(stats, renderer?.info()),
});
bridge.attachLoop(loop);

/** Frame the player's ship and a hostile one (or only the player's ship) in the camera. */
function focusFight(ship: number | null): void {
  renderer?.frameShips(ship === null ? [1] : [1, ship]);
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
function spawnRaider(boarders = false): void {
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
  const x = Math.min(sim.sector.width - w, mine.x + mine.width + MIN_SHIP_GAP + 2 * REGION_PAD + 4);
  const y = Math.min(sim.sector.height - h, Math.max(0, Math.round(cy - h / 2)));
  bridge.dispatch({ type: 'debug.spawnEnemy', template, x, y });
}

function homeShipC() {
  return sim.world.get(homeShip(sim), ShipC);
}

/**
 * Debug: generate a station (`kind` 'station.trading'..., `size` outpost | station | hub) east of everything in the node
 * and frame it with the player's ship. `?station=trading:hub` spawns one at start.
 */
function spawnStation(kind: string, size: 'outpost' | 'station' | 'hub'): void {
  const before = new Set(sim.world.query(ShipC));
  bridge.dispatch({ type: 'debug.spawnStation', kind, size, seed: (Math.random() * 0x7fffffff) >>> 0 });
  // The command runs on the next tick: frame the new station once it exists.
  const frame = (tries: number): void => {
    const id = sim.world.query(ShipC).find((i) => !before.has(i) && sim.world.get(i, ShipC)?.immobile);
    if (id) renderer?.frameShips([homeShip(sim), id]);
    else if (tries > 0) setTimeout(() => frame(tries - 1), 100);
  };
  frame(30);
}
const stationFlag = params.get('station');

const api: UiApi = {
  snapshot: bridge.snapshot,
  inspect: bridge.inspect,
  errors: errorLog.errors,
  crew: bridge.crew,
  hostiles: bridge.hostiles,
  focusCrew: controller.focusCrew,
  attack: controller.attack,
  selectedCrew: controller.selectedCrew,
  modules: bridge.modules,
  moduleDefs: buildModuleDefs(sim),
  items: buildItemDefs(sim),
  recipes: buildRecipes(sim),
  structCosts: buildStructCosts(sim),
  itemIcons,
  stock: bridge.stock,
  storages: bridge.storages,
  fabs: bridge.fabs,
  selectedModule: controller.selectedModule,
  selectedShip: controller.selectedShip,
  selectShip: controller.selectShip,
  stats: bridge.stats,
  alerts: controller.alerts.list,
  log: controller.log.list,
  combat: bridge.combat,
  shuttles: bridge.shuttles,
  trade: bridge.trade,
  prizes: bridge.prizes,
  story: bridge.story,
  chooseStory: bridge.chooseStory,
  focusShuttle: (id) => {
    const b = sim.world.get(id, BodyC);
    if (b) renderer?.focusSector(b.x, b.y);
  },
  setCombatView: (view) => renderer?.setCombatView(view && { shipId: view.ship, rect: view.rect }),
  setCombatMarks: (marks) => renderer?.setCombatMarks(marks),
  pickCombat: (x, y) => renderer?.pickCombat(x, y) ?? null,
  setRoofEnemies: (on) => renderer?.setRoofEnemies(on),
  focusFight: (ship) => focusFight(ship),
  spawnRaider: (boarders) => spawnRaider(boarders),
  spawnGenerated: (faction) => spawnGenerated(faction),
  spawnStation: (kind, size) => spawnStation(kind, size),
  overlayList,
  overlayLegend,
  dismissAlert: controller.alerts.dismiss,
  focusAlert: controller.focusAlert,
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
  throwTestError: () => {
    setTimeout(() => {
      throw new Error('Test error from debug panel');
    }, 0);
  },
  setCutaway: (mode) => renderer?.setCutaway(mode),
  setOverlay: (field) => renderer?.setOverlay(field),
  attachCanvas(canvas) {
    createRenderer(canvas, matchMedia('(max-width: 600px)').matches ? 'low' : 'high', sim.world, content)
      .then((r) => {
        renderer = r;
        if (new URLSearchParams(location.search).has('hook')) hook = installDebugHook(sim, r);
        r.setSector(sim.sector.grid);
        const grid = shipGrid(sim, homeShip(sim));
        if (grid) r.setGrid(grid);
        attachInput(canvas, r, controller.attach(r));
        window.addEventListener('resize', () => r.resize());
        loop.start();
        if (stationFlag) {
          const [k, s] = stationFlag.split(':');
          spawnStation(`station.${(k ?? 'trading').replace(/^station\./, '')}`, (s === 'station' || s === 'hub' ? s : 'outpost'));
        }
      })
      .catch((e: unknown) => errorLog.push(e));
  },
};

// Periodic events: one draw about every 3 minutes of play. Danger tier and territory are parameters until sectors are redone.
bridge.dispatch({ type: 'story.setContext', danger: 1, faction: null, periodicSec: 180 });

mount(App, { target, props: { api } });
