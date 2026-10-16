import { mount } from 'svelte';
import App from './ui/App.svelte';
import type { UiApi } from './ui/api';
import { createBridge } from './app/bridge';
import { createErrorLog } from './app/errors';
import { createLoop } from './app/loop';
import { buildRepro } from './app/repro';
import { createRenderer, type Renderer } from './render/scene';
import { Sim } from './sim';

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app element');

const param = new URLSearchParams(location.search).get('seed');
const seed = param !== null && Number.isFinite(Number(param)) ? Number(param) >>> 0 : (Math.random() * 0x100000000) >>> 0;

const errorLog = createErrorLog();
const sim = new Sim(seed);
const bridge = createBridge(sim);
let renderer: Renderer | undefined;

const loop = createLoop({
  sim,
  render: (alpha) => renderer?.render(alpha),
  onFrame: (stats) => bridge.update(stats),
});
bridge.attachLoop(loop);

const api: UiApi = {
  snapshot: bridge.snapshot,
  errors: errorLog.errors,
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
  attachCanvas(canvas) {
    renderer = createRenderer(canvas, sim, matchMedia('(max-width: 600px)').matches ? 'low' : 'high');
    window.addEventListener('resize', () => renderer?.resize());
    loop.start();
  },
};

mount(App, { target, props: { api } });
