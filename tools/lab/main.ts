import { autoDetectRenderer, Container, Graphics } from 'pixi.js';
import { loadAtlas } from '../../src/render/assets/loader';
import type { LabCell, LabCtx } from './panel';
import { PANELS } from './panels';

/**
 * The render lab (dev only, `npm run dev` then `/tools/lab/`): any visual drawn on its own, as a grid of cells each pinned
 * to a moment, so a single still shows every frame of an effect. No sim, no clock: a still is drawn once and then the page
 * sits idle (`window.__labReady` turns true), which makes headless screenshots quick and exact (`npm run lab`).
 *   ?panel=<id>   the panel (no panel: the index)
 *   &zoom=2       css px per world px (default the panel's, else 1: the game's zoom 1)
 *   &cols=N       cells per row at most (default: as many as fit the window)
 *   &play         animate: each cell loops through its own time instead of holding its pinned moment
 *   &bg=0a0d12    cell background (hex)
 * Panels read their own options too; the index lists them.
 */
const LABEL_H = 30;
const GAP = 10;
const MARGIN = 12;

const params = new URLSearchParams(location.search);
const bar = document.getElementById('bar') as HTMLElement;
const stageEl = document.getElementById('stage') as HTMLElement;
const msg = document.getElementById('msg') as HTMLElement;
const lab = window as unknown as { __labReady?: boolean; __labError?: string };

function link(id: string, query = ''): string {
  return `?panel=${id}${query}`;
}

function index(): void {
  bar.innerHTML = '<b>Render lab</b>';
  msg.innerHTML = PANELS.map((p) => `<p><a href="${link(p.id)}">${p.title}</a> <code>?panel=${p.id}</code><br>${p.help}</p>`).join('')
    + '<p>Every panel: <code>&zoom=2</code> <code>&cols=N</code> <code>&play</code> <code>&bg=0a0d12</code>. '
    + 'Screenshot: <code>npm run lab -- --panel ID [--query "&k=v"] [--out file.png]</code>.</p>';
  lab.__labReady = true;
}

interface Placed {
  cell: LabCell;
  set: (t: number) => void;
}

async function run(): Promise<void> {
  const id = params.get('panel');
  const panel = PANELS.find((p) => p.id === id);
  if (!panel) return index();
  bar.innerHTML = `<a href="?">Render lab</a> <b>${panel.title}</b> &nbsp; ${panel.help}`;
  const zoom = Number(params.get('zoom') ?? panel.zoom ?? 1) || 1;
  const play = params.has('play');
  const bg = parseInt(params.get('bg') ?? '', 16);
  const cellBg = Number.isFinite(bg) ? bg : (panel.bg ?? 0x0a0d12);
  const renderer = await autoDetectRenderer({
    width: 1, height: 1, resolution: devicePixelRatio, autoDensity: true, antialias: false, roundPixels: true,
    background: 0x07090d, preference: 'webgl',
  });
  const atlas = await loadAtlas(undefined, { upload: (src) => renderer.texture.initSource(src) });
  atlas.setSmooth(false);
  const ctx: LabCtx = { atlas, renderer, params };
  const cells = await panel.cells(ctx);
  await atlas.whenIdle();

  // lay the cells out in rows that fit the window (or `cols`)
  const maxW = Math.max(200, window.innerWidth - MARGIN * 2);
  const cols = Number(params.get('cols') ?? 0) || Infinity;
  const stage = new Container();
  const placed: Placed[] = [];
  let x = MARGIN, y = MARGIN, rowH = 0, inRow = 0, width = 0;
  for (const cell of cells) {
    const w = cell.w * zoom, h = cell.h * zoom;
    if (inRow > 0 && (cell.newRow || inRow >= cols || x + w > maxW + MARGIN)) {
      x = MARGIN;
      y += rowH + GAP;
      rowH = inRow = 0;
    }
    const box = new Container();
    box.position.set(x, y + LABEL_H);
    box.scale.set(zoom);
    box.addChild(new Graphics().rect(0, 0, cell.w, cell.h).fill(cellBg));
    const root = new Container();
    box.addChild(root);
    stage.addChild(box);
    placed.push({ cell, set: cell.mount(root, ctx) });
    const label = document.createElement('div');
    label.className = 'lab-label';
    label.style.left = `${x}px`;
    label.style.top = `${y}px`;
    label.style.width = `${w}px`;
    label.title = cell.label;
    label.innerHTML = `<b>${cell.label}</b>${cell.note ? `<br>${cell.note}` : ''}`;
    stageEl.appendChild(label);
    x += w + GAP;
    rowH = Math.max(rowH, h + LABEL_H);
    width = Math.max(width, x);
    inRow++;
  }
  const height = y + rowH + MARGIN;
  renderer.resize(Math.max(width, 1), Math.max(height, 1));
  stageEl.style.height = `${height}px`;
  stageEl.prepend(renderer.canvas);
  await atlas.whenIdle();

  const draw = (now: number): void => {
    for (const p of placed) p.set(play && p.cell.loop ? (now / 1000) % p.cell.loop : (p.cell.at ?? 0));
    renderer.render(stage);
  };
  draw(0);
  lab.__labReady = true;
  if (play) {
    const t0 = performance.now();
    const loop = (): void => {
      draw(performance.now() - t0);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

run().catch((e: unknown) => {
  lab.__labError = String(e instanceof Error ? e.stack ?? e.message : e);
  msg.textContent = lab.__labError;
  lab.__labReady = true;
});
