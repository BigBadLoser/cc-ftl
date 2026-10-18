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
import { newGame, ShipC, VehicleC } from './sim';

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
function focusFight(gridId: number | null): void {
  renderer?.frameShips(gridId === null ? [1] : [1, gridId]);
}

/** Debug: put a raider a fair distance from the player's ship (diagonally, so a fight fits on a phone screen too). */
function spawnRaider(boarders = false): void {
  const template = boarders ? 'ship.raiderBoarder' : 'ship.raider';
  const mine = shipOfGrid(1);
  const t = content.ships[template];
  if (!mine || !t) return;
  const w = Math.max(...t.rows.map((r) => r.length));
  const h = t.rows.length;
  const cx = mine.x + mine.width / 2;
  const cy = mine.y + mine.height / 2;
  const x = Math.min(sim.sector.width - w, Math.max(0, Math.round(cx + 18 - w / 2)));
  const y = Math.min(sim.sector.height - h, Math.max(0, Math.round(cy + 22 - h / 2)));
  bridge.dispatch({ type: 'debug.spawnEnemy', template, x, y });
}

function shipOfGrid(gridId: number) {
  for (const id of sim.world.query(ShipC)) {
    const s = sim.world.get(id, ShipC);
    if (s?.gridId === gridId) return s;
  }
  return undefined;
}

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
  stats: bridge.stats,
  alerts: controller.alerts.list,
  combat: bridge.combat,
  shuttles: bridge.shuttles,
  focusShuttle: (id) => {
    const v = sim.world.get(id, VehicleC);
    if (v) renderer?.focusSector(v.x, v.y);
  },
  setCombatView: (view) => renderer?.setCombatView(view),
  pickCombat: (x, y) => renderer?.pickCombat(x, y) ?? null,
  setRoofEnemies: (on) => renderer?.setRoofEnemies(on),
  focusFight: (gridId) => focusFight(gridId),
  spawnRaider: (boarders) => spawnRaider(boarders),
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
        r.setGrids(sim.grids);
        const grid = sim.grids.get(1);
        if (grid) r.setGrid(grid);
        attachInput(canvas, r, controller.attach(r));
        window.addEventListener('resize', () => r.resize());
        loop.start();
      })
      .catch((e: unknown) => errorLog.push(e));
  },
};

mount(App, { target, props: { api } });
