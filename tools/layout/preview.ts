/**
 * The preview: the game's renderer over a sim built from the design and never ticked, so it shows the real art and nothing moves.
 * One host element lives for the page (panes move it between docks and floating windows). A new design gets a fresh canvas and
 * renderer, built beside the old one; the old stays on screen until the new one has its art, so an edit does not flash. The renderer
 * only reads the sim; nothing here writes to it.
 */
import { content } from '../../src/content';
import { createRenderer, type Renderer } from '../../src/render/scene';
import { ModuleC, shipGrid } from '../../src/sim';
import { ORIGIN, type View } from './camera';
import type { Design } from './design';
import { worldOf } from './world';

export interface Mark { tiles: readonly [number, number][]; tint: number; solid?: boolean }
export interface Preview {
  /** The element panes mount; it holds the canvas. */
  host: HTMLElement;
  setDesign(d: Design): Promise<void>;
  /** Resize to the host's box (call when it changes size or moves). */
  resize(): void;
  setView(v: View): void;
  setMarks(marks: readonly Mark[]): void;
  setShields(on: boolean): void;
  /** The design tile under a host-relative css px position, and the module there if the pointer is on one. */
  pick(sx: number, sy: number): { x: number; y: number; module: number | null } | null;
  /** The renderer's current zoom level (null before it exists). */
  zoom(): number | null;
  /** Stop drawing (a minimised preview). */
  pause(on: boolean): void;
}

interface Live { r: Renderer; c: HTMLCanvasElement; world: NonNullable<ReturnType<typeof worldOf>>; design: Design }

export function createPreview(): Preview {
  const host = document.createElement('div');
  host.className = 'relative size-full overflow-hidden bg-black';
  let cur: Live | undefined;
  let next: Live | undefined;
  let view: View | undefined;
  let marks: readonly Mark[] = [];
  let shields = false;
  let paused = false;
  let generation = 0;

  function applyView(l: Live | undefined): void {
    if (!l || !view) return;
    for (let i = 0; i < 24 && l.r.info().zoom < view.zoom - 1e-9; i++) l.r.zoomAt(1.2, 0, 0);
    for (let i = 0; i < 24 && l.r.info().zoom > view.zoom + 1e-9; i++) l.r.zoomAt(1 / 1.2, 0, 0);
    l.r.focusTile(view.cx + ORIGIN, view.cy + ORIGIN);
  }
  function applyMarks(l: Live | undefined): void {
    l?.r.setAreas(marks.map((m) => ({ tiles: m.tiles.map(([x, y]) => ({ x: x + ORIGIN, y: y + ORIGIN })), tint: m.tint, solid: m.solid })));
  }
  const loop = (): void => {
    requestAnimationFrame(loop);
    if (paused) return;
    cur?.r.render(1);
    next?.r.render(1);
  };
  requestAnimationFrame(loop);

  function drop(l: Live | undefined): void {
    if (!l) return;
    l.r.dispose();
    l.c.remove();
  }

  return {
    host,
    async setDesign(d) {
      const mine = ++generation;
      const world = worldOf(d.layout);
      if (!world) return;
      drop(next);
      next = undefined;
      const c = document.createElement('canvas');
      c.className = `absolute inset-0 block size-full ${cur ? 'invisible' : ''}`;
      host.appendChild(c);
      const r = await createRenderer(c, 'high', world.sim.world, content);
      const l: Live = { r, c, world, design: d };
      if (mine !== generation) { drop(l); return; }
      next = l;
      r.setSector(world.sim.sector.grid);
      const grid = shipGrid(world.sim, world.ship);
      if (grid) r.setGrid(grid);
      r.setBackdrop({ seed: 7, density: 0.25, body: null, bodyHash: 0 });
      r.setRoofPlayer(false);
      r.setWorldGrid(false);
      r.setShields(shields);
      r.resize();
      applyMarks(l);
      applyView(l);
      if (cur) await Promise.race([r.whenArtReady(), new Promise((res) => setTimeout(res, 4000))]);
      if (mine !== generation) return;
      const old = cur;
      cur = l;
      next = undefined;
      c.classList.remove('invisible');
      drop(old);
      applyView(cur);
    },
    resize() {
      cur?.r.resize();
      applyView(cur);
    },
    setView(v) {
      view = v;
      applyView(cur);
      applyView(next);
    },
    setMarks(m) {
      marks = m;
      applyMarks(cur);
      applyMarks(next);
    },
    setShields(on) {
      shields = on;
      cur?.r.setShields(on);
      next?.r.setShields(on);
    },
    pick(sx, sy) {
      if (!cur) return null;
      const t = cur.r.pickTileAny(sx, sy);
      if (!t) return null;
      const x = t.x - ORIGIN, y = t.y - ORIGIN;
      let module: number | null = null;
      const e = cur.r.pickModule(sx, sy);
      const m = e ? cur.world.sim.world.get(e, ModuleC) : undefined;
      if (m) {
        const i = cur.design.modules.findIndex((dm) => dm.def === m.def && dm.x === m.x - ORIGIN && dm.y === m.y - ORIGIN);
        module = i >= 0 ? i : null;
      }
      return { x, y, module };
    },
    zoom: () => cur?.r.info().zoom ?? null,
    pause(on) {
      paused = on;
    },
  };
}
