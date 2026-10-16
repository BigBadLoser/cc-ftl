import { mount } from 'svelte';
import App from './ui/App.svelte';
import type { UiApi } from './ui/api';
import { createBridge } from './app/bridge';
import { createController } from './app/controller';
import { createErrorLog } from './app/errors';
import { attachInput } from './app/input';
import { createLoop } from './app/loop';
import { buildRepro } from './app/repro';
import { createRenderer, type Renderer } from './render/scene';
import { content } from './content';
import { newGame } from './sim';

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app element');

const param = new URLSearchParams(location.search).get('seed');
const seed = param !== null && Number.isFinite(Number(param)) ? Number(param) >>> 0 : (Math.random() * 0x100000000) >>> 0;

const errorLog = createErrorLog();
const sim = newGame(seed, content);
const bridge = createBridge(sim);
const controller = createController(sim, bridge);
let renderer: Renderer | undefined;

const loop = createLoop({
  sim,
  render: (alpha) => renderer?.render(alpha),
  onEvents: controller.onEvents,
  onFrame: (stats) => bridge.update(stats, renderer?.info()),
});
bridge.attachLoop(loop);

const api: UiApi = {
  snapshot: bridge.snapshot,
  inspect: bridge.inspect,
  errors: errorLog.errors,
  crew: bridge.crew,
  selectedCrew: controller.selectedCrew,
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
    createRenderer(canvas, matchMedia('(max-width: 600px)').matches ? 'low' : 'high', sim.world, content.modules)
      .then((r) => {
        renderer = r;
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
