import { mount } from 'svelte';
import { autoDetectRenderer } from 'pixi.js';
import '../../src/ui/theme.css';
import { content } from '../../src/content';
import { newGame } from '../../src/sim';
import { loadAtlas } from '../../src/render/assets/loader';
import { createModuleThumbs } from '../../src/render/moduleThumb';
import { createStore } from '../../src/app/store';
import { loadItemIcons } from '../../src/app/itemIcons';
import { buildModuleDefs } from '../../src/app/moduleSnapshot';
import { buildStructCosts } from '../../src/app/logisticsSnapshot';
import type { UiApi, UiIcon, UiToolState } from '../../src/ui/api';
import BuildCatalog from '../../src/ui/BuildCatalog.svelte';

/**
 * The build menu panel (`?panel=build`): the game's own BuildCatalog (and its hover popover) on a fresh game's module defs, with real
 * thumbnails from the atlas and a mock api (no stock, no mining, nothing placed). `tab=<category>` opens a tab (default life),
 * `hover=<module id>` opens that card's popover (it is scrolled into view), `query=<text>` fills the search box.
 */
export async function mountBuildLab(target: HTMLElement, params: URLSearchParams): Promise<void> {
  for (const e of [document.documentElement, document.body]) { e.style.height = '100%'; e.style.overflow = 'hidden'; }
  document.body.style.background = '#0b0f16';
  const renderer = await autoDetectRenderer({ width: 1, height: 1, resolution: devicePixelRatio, antialias: false, preference: 'webgl' });
  const atlas = await loadAtlas(params.get('assets') ?? undefined, { upload: (src) => renderer.texture.initSource(src) });
  atlas.setSmooth(false);
  const thumbs = createModuleThumbs(renderer.extract, atlas, content.modules);
  const sim = newGame(1, content);
  const itemIcons = createStore<Record<string, UiIcon>>({});
  await loadItemIcons(Object.keys(content.items), (id) => (content.items as Record<string, { art?: string }>)[id]?.art ?? id).then((v) => itemIcons.set(v));
  const tool = createStore<UiToolState>({ tool: 'build', build: 'module', moduleDef: null, rot: 0 });
  const base: Partial<UiApi> = {
    tool,
    setTool: (t: Partial<UiToolState>) => tool.set({ ...tool.get(), ...t }),
    itemIcons,
    stock: createStore([]),
    moduleDefs: createStore(buildModuleDefs(sim)),
    mining: createStore({ asteroids: [], pods: [] }),
    placeHint: createStore(null),
    structCosts: buildStructCosts(sim),
    moduleThumb: (def: string, rot: number) => thumbs.get(def, rot),
    dispatch: () => {},
  } as unknown as Partial<UiApi>;
  // Anything else the menu asks for is a no-op that returns nothing.
  const api = new Proxy(base, { get: (o, k) => (k in o ? (o as Record<string | symbol, unknown>)[k] : () => undefined) }) as UiApi;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0';
  target.appendChild(host);
  mount(BuildCatalog, { target: host, props: { api } });
  await atlas.whenIdle();
  await new Promise((r) => setTimeout(r, 300));
  const tab = params.get('tab') ?? 'life';
  document.querySelector<HTMLElement>(`[data-testid="tab-${tab}"]`)?.click();
  const query = params.get('query');
  if (query) {
    const input = document.querySelector<HTMLInputElement>('input.search');
    if (input) { input.value = query; input.dispatchEvent(new Event('input', { bubbles: true })); }
  }
  await new Promise((r) => setTimeout(r, 1200));                                    // thumbs retry every 250 ms
  const hover = params.get('hover');
  if (hover) {
    const name = content.modules[hover]?.name;
    const card = [...document.querySelectorAll<HTMLElement>('[data-testid="build-catalog"] .card')].find((c) => name && c.textContent?.trim().toUpperCase().startsWith(name.toUpperCase()));
    card?.scrollIntoView({ inline: 'center' });
    card?.focus();
    await new Promise((r) => setTimeout(r, 900));
  }
}
