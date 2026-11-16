import { mount } from 'svelte';
import '../../src/ui/theme.css';
import { content } from '../../src/content';
import { createRenderer } from '../../src/render/scene';
import { createStore } from '../../src/app/store';
import { createPaintTools } from '../../src/app/paintTools';
import type { Bridge } from '../../src/app/bridge';
import type { UiApi, UiToolState } from '../../src/ui/api';
import { shipGrid, type WindowAxis } from '../../src/sim';
import BuildCatalog from '../../src/ui/BuildCatalog.svelte';
import { ORIGIN } from '../layout/camera';
import type { Layout } from '../layout/layout';
import { blankLayout } from '../layout/source';
import { addWindow } from '../layout/windows';
import { buildWorld } from '../layout/world';

/**
 * A ship section with the walls the Window tool cares about: an interior wall along y (x = 10, y 1..4) meeting a wall along x
 * (y = 5, x 10..24) in a T, the hull around it, and floor either side. '#' wall, '_' floor, '.' space.
 */
const ROWS = [
  '##########################',
  '#_________#______________#',
  '#_________#______________#',
  '#_________#______________#',
  '#_________#______________#',
  '#_________################',
  '#________________________#',
  '#________________________#',
  '#________________________#',
  '##########################',
];
const BUILT: { x: number; y: number; axis: WindowAxis; size: number }[] = [{ x: 20, y: 5, axis: 'x', size: 3 }, { x: 18, y: 0, axis: 'x', size: 2 }, { x: 0, y: 6, axis: 'y', size: 3 }, { x: 14, y: 9, axis: 'x', size: 4 }, { x: 25, y: 6, axis: 'y', size: 3 }];
const PENDING = { x: 4, y: 9, axis: 'x' as WindowAxis, size: 3 };

interface Case { label: string; note: string; at: [number, number]; size: number; roof?: boolean; newRow?: boolean; walls?: 'up' | 'auto' }
const CASES: Case[] = [
  { label: 'valid: interior wall along x, size 2', note: 'hover (14,5)', at: [14, 5], size: 2, newRow: true },
  { label: 'size 3', note: 'hover (14,5)', at: [14, 5], size: 3 },
  { label: 'size 4', note: 'hover (14,5)', at: [14, 5], size: 4 },
  { label: 'valid: interior wall along y, size 2', note: 'hover (10,2)', at: [10, 2], size: 2, newRow: true },
  { label: 'size 3', note: 'hover (10,2)', at: [10, 2], size: 3 },
  { label: 'size 4', note: 'hover (10,2)', at: [10, 2], size: 4 },
  { label: 'valid: hull, top, size 3', note: 'hover (5,0)', at: [5, 0], size: 3, newRow: true },
  { label: 'valid: hull, west, size 4', note: 'hover (0,3)', at: [0, 3], size: 4 },
  { label: 'valid: hull, bottom, size 2', note: 'hover (20,9)', at: [20, 9], size: 2 },
  { label: 'invalid: on floor', note: 'hover (5,3)', at: [5, 3], size: 3, newRow: true },
  { label: 'invalid: T-junction', note: 'hover (10,5)', at: [10, 5], size: 3 },
  { label: 'invalid: hull corner', note: 'hover (0,0)', at: [0, 0], size: 2 },
  { label: 'invalid: over a window', note: 'hover (21,5)', at: [21, 5], size: 2, newRow: true },
  { label: 'invalid: job pending', note: 'hover (5,9)', at: [5, 9], size: 2 },
  { label: 'built windows, walls up', note: 'no tool', at: [20, 5], size: 0, newRow: true, walls: 'up' },
  { label: 'built, hull top, default walls', note: 'no tool', at: [18, 0], size: 0, walls: 'auto' },
  { label: 'built, hull west, walls up', note: 'no tool', at: [0, 7], size: 0, walls: 'up' },
  { label: 'built, hull bottom (4), roofed', note: 'no tool', at: [16, 9], size: 0, roof: true },
  { label: 'built, hull east (3), roofed', note: 'no tool', at: [25, 7], size: 0, roof: true },
];

const W = 640, H = 340;

/** The ship as a layout: the section above with the built windows. */
function layout(): Layout {
  let l: Layout = { ...blankLayout(ROWS[0]?.length ?? 1, ROWS.length), name: 'Window tool section', cells: [...ROWS] };
  for (const w of BUILT) l = addWindow(l, w);
  return l;
}

/**
 * The Window tool's conditions (`?panel=windows-tool`), drawn with the game's own code: a renderer over a sim holding the section,
 * the real paint tool (`createPaintTools`) put on build > window at each case's size and hovered over its tile, so the preview tint
 * and the hint text are exactly what the game shows; the hint is the build menu's own element. `zoom=` sets the camera zoom
 * (its steps; default the widest, 2), `only=0,12` shows those cells (by index). A pending job stands on the bottom wall; built windows sit on the interior wall along x, the top, west, bottom and east hull.
 */
export async function mountWindowsToolLab(target: HTMLElement, params: URLSearchParams): Promise<void> {
  const world = buildWorld(layout());
  if (!world) throw new Error('the section did not stand');
  const { sim, ship } = world;
  const zoom = Number(params.get('zoom') ?? 1) || 1;
  const canvas = document.createElement('canvas');
  // the renderer sizes its canvas from the box it is laid out in (it clears any inline size), so it sits in a box of its own
  const live = document.createElement('div');
  live.id = 'wt-live-box';
  live.style.cssText = `position:fixed;left:-9999px;top:0;width:${W}px;height:${H}px`;
  const sheet = document.createElement('style');
  sheet.textContent = '.wt-live{position:absolute;inset:0;width:100%;height:100%}';
  document.head.appendChild(sheet);
  canvas.className = 'wt-live';
  live.appendChild(canvas);
  document.body.appendChild(live);
  const r = await createRenderer(canvas, 'high', sim.world, content);
  r.setSector(sim.sector.grid);
  const grid = shipGrid(sim, ship);
  if (grid) r.setGrid(grid);
  r.setBackdrop({ seed: 7, density: 0.25, body: null, bodyHash: 0 });
  r.setWorldGrid(true);
  r.resize();
  // a pending window job on the bottom hull, the game's own command
  sim.enqueue({ type: 'job.window', ship, ...PENDING, x: PENDING.x + ORIGIN, y: PENDING.y + ORIGIN });
  sim.step();
  for (let i = 0; i < 24 && r.info().zoom < zoom - 1e-9; i++) r.zoomAt(1.2, 0, 0);
  for (let i = 0; i < 24 && r.info().zoom > zoom + 1e-9; i++) r.zoomAt(1 / 1.2, 0, 0);

  const tool = createStore<UiToolState>({ tool: 'select', build: 'module', moduleDef: null, rot: 0 });
  const placeHint = createStore<{ x: number; y: number; text: string; ok?: boolean } | null>(null);
  const paint = createPaintTools(sim, { setHovered() {}, yard: createStore({ plan: { ship: 0, tiles: [], connected: [], loose: [], blocked: [], floor: [], bad: [], hull: { now: 0, afterAll: 0, capacity: 0, max: 0 } }, quote: null, order: null }) } as unknown as Bridge, { tool, placeHint, renderer: () => r, showToast() {}, homeShipId: () => ship });
  /** The build menu on its own copy of the hint (each cell keeps its hint after the shared store moves on to the next case). */
  const apiWith = (hint: ReturnType<typeof placeHint.get>): UiApi => new Proxy({ tool, setTool: () => {}, stock: createStore([]), itemIcons: createStore({}), moduleDefs: createStore([]), mining: createStore({ asteroids: [], pods: [] }), placeHint: createStore(hint), structCosts: {}, dispatch: () => {} } as unknown as Partial<UiApi>, {
    get: (o, k) => (k in o ? (o as Record<string | symbol, unknown>)[k] : () => undefined),
  }) as UiApi;

  document.body.style.background = '#0b0f16';
  for (const e of [document.documentElement, document.body]) { e.style.height = 'auto'; e.style.overflow = 'visible'; } // theme.css pins the page to the viewport; the cells run past it
  const style = document.createElement('style');
  style.textContent = '.wt{display:flex;flex-wrap:wrap;gap:10px;padding:12px}.wt .cell{width:640px}.wt .frame{position:relative;width:640px;height:340px;contain:layout paint;background:#07090d}.wt canvas{display:block;width:640px;height:340px}.wt [data-testid="build-catalog"]{display:none}.wt .cap{padding:2px 0;color:#8fa3b8}.wt .cap b{color:#e6eef6}';
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.className = 'wt';
  target.appendChild(root);

  (window as unknown as { __wt: unknown }).__wt = { r, sim, ship };
  const only = params.get('only')?.split(',').map(Number);
  for (const [ci, c] of CASES.entries()) {
    if (only && !only.includes(ci)) continue;
    paint.setTool(c.size ? { tool: 'build', build: 'window', windowSize: c.size } : { tool: 'select' });
    r.setRoofPlayer(!!c.roof);
    r.setCutaway(c.walls ?? 'auto');
    const at = { x: c.at[0] + ORIGIN, y: c.at[1] + ORIGIN };
    r.focusTile(at.x, at.y);
    placeHint.set(null);
    if (c.size) paint.onHover(at); else { paint.onHover(null); r.setPreview([]); }
    // the scene builds over a few frames
    for (let i = 0; i < 20; i++) { r.render(1); await new Promise((res) => setTimeout(res, 40)); }
    await r.whenArtReady();
    if (c.size) paint.onHover(at); // the camera has settled: the hint goes at the tile's place now
    r.render(1);
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.innerHTML = `<div class="cap"><b>${c.label}</b><br>${c.note}${c.size ? ` · size ${c.size}` : ''}</div><div class="frame"></div>`;
    root.appendChild(cell);
    const frame = cell.querySelector('.frame') as HTMLElement;
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    copy.getContext('2d')?.drawImage(canvas, 0, 0);
    frame.appendChild(copy);
    const hint = placeHint.get();
    if (hint) mount(BuildCatalog, { target: frame, props: { api: apiWith(hint) } });
    await new Promise((res) => setTimeout(res, 60));
  }
}
