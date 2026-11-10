/**
 * The preview: the game's renderer over a sim built from the design and never ticked, so it shows the real art and nothing moves.
 * One host element lives for the page (panes move it between docks and floating windows); a new design swaps in a fresh canvas,
 * renderer and sim. The renderer only reads the sim; nothing here writes to it after the ship is stamped.
 */
import { content } from '../../src/content';
import { createRenderer, type Renderer } from '../../src/render/scene';
import { ModuleC, Sim, shipGrid, spawnShip, type ShipTemplate } from '../../src/sim';
import { powerSystem } from '../../src/sim/systems/power';
import { ORIGIN, type View } from './camera';
import type { Design } from './design';

export interface Mark { tiles: readonly [number, number][]; tint: number; solid?: boolean }
export interface Preview {
  /** The element panes mount; it holds the canvas. */
  host: HTMLElement;
  setDesign(d: Design): Promise<void>;
  /** Resize to the host's box (call when it changes size or moves). */
  resize(): void;
  setView(v: View): void;
  setMarks(marks: readonly Mark[]): void;
  /** The design tile under a host-relative css px position, and the module there if the pointer is on one. */
  pick(sx: number, sy: number): { x: number; y: number; module: number | null } | null;
  /** The renderer's current zoom level (null before it exists). */
  zoom(): number | null;
  /** Stop drawing (a minimised preview). */
  pause(on: boolean): void;
}

const noCrew = (t: ShipTemplate): ShipTemplate => ({ ...t, crew: [] });

export function createPreview(): Preview {
  const host = document.createElement('div');
  host.className = 'relative size-full overflow-hidden bg-black';
  let renderer: Renderer | undefined;
  let canvas: HTMLCanvasElement | undefined;
  let sim: Sim | undefined;
  let design: Design | undefined;
  let view: View | undefined;
  let marks: readonly Mark[] = [];
  let paused = false;
  let generation = 0;

  function applyView(): void {
    if (!renderer || !view) return;
    for (let i = 0; i < 24 && renderer.info().zoom < view.zoom - 1e-9; i++) renderer.zoomAt(1.2, 0, 0);
    for (let i = 0; i < 24 && renderer.info().zoom > view.zoom + 1e-9; i++) renderer.zoomAt(1 / 1.2, 0, 0);
    renderer.focusTile(view.cx + ORIGIN, view.cy + ORIGIN);
  }
  function applyMarks(): void {
    renderer?.setAreas(marks.map((m) => ({ tiles: m.tiles.map(([x, y]) => ({ x: x + ORIGIN, y: y + ORIGIN })), tint: m.tint, solid: m.solid })));
  }
  const loop = (): void => {
    requestAnimationFrame(loop);
    if (!paused) renderer?.render(1);
  };
  requestAnimationFrame(loop);

  function dispose(): void {
    renderer?.dispose();
    canvas?.remove();
    renderer = canvas = undefined;
  }

  return {
    host,
    async setDesign(d) {
      const mine = ++generation;
      dispose();
      design = d;
      const s = new Sim(1, content);
      s.sector.width = Math.max(s.sector.width, ORIGIN + d.width + 8);
      s.sector.height = Math.max(s.sector.height, ORIGIN + d.height + 8);
      const id = spawnShip(s, noCrew(d.template), { faction: 'player', x: ORIGIN, y: ORIGIN });
      // Modules spawn unpowered: allocate power once, as a new game does, so lights and screens show as they would at the start (nothing is stepped).
      powerSystem(s);
      sim = s;
      const c = document.createElement('canvas');
      c.className = 'block size-full';
      host.appendChild(c);
      const r = await createRenderer(c, 'high', s.world, content);
      if (mine !== generation) { r.dispose(); c.remove(); return; }
      canvas = c;
      renderer = r;
      r.setSector(s.sector.grid);
      const grid = shipGrid(s, id);
      if (grid) r.setGrid(grid);
      r.setBackdrop({ seed: 7, density: 0.25, body: null, bodyHash: 0 });
      r.setRoofPlayer(false);
      r.setWorldGrid(false);
      applyMarks();
      applyView();
    },
    resize() {
      renderer?.resize();
      applyView();
    },
    setView(v) {
      view = v;
      applyView();
    },
    setMarks(m) {
      marks = m;
      applyMarks();
    },
    pick(sx, sy) {
      if (!renderer || !sim || !design) return null;
      const t = renderer.pickTileAny(sx, sy);
      if (!t) return null;
      const x = t.x - ORIGIN, y = t.y - ORIGIN;
      let module: number | null = null;
      const e = renderer.pickModule(sx, sy);
      const m = e ? sim.world.get(e, ModuleC) : undefined;
      if (m) module = design.modules.findIndex((dm) => dm.def === m.def && dm.x === m.x - ORIGIN && dm.y === m.y - ORIGIN);
      return { x, y, module: module !== null && module >= 0 ? module : null };
    },
    zoom: () => renderer?.info().zoom ?? null,
    pause(on) {
      paused = on;
    },
  };
}
