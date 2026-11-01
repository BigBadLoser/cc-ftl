import { content } from '../../content';
import { createRenderer, type Renderer } from '../../render/scene';

type CrewLook = Parameters<Renderer['portraitOf']>[0];
import { homeShip, newGame } from '../../sim';
import { shipGrid } from '../../sim/regions';
import { backdropSpecOf } from '../backdropSpec';
import { setAnimPaused } from '../../render/animClock';

/**
 * The title screen's backdrop: a throwaway sim with only the starter ship (ticked slowly, nothing is saved from it), drawn by the real
 * renderer over the space backdrop at a fixed zoom, with the camera drifting slowly. The ship sits right of centre, clear of the menu.
 */
export interface Stage {
  dispose(): void;
  /** A crew portrait from a look, drawn with the stage renderer's art (null while its sheets load). */
  portrait(look: CrewLook): string | null;
}

/**
 * Peak drift from the framed position, in CSS px, and its periods in ms (#264: periods doubled from 17 s / 23 s, half the speed). The drift
 * adds to the camera's unsnapped centre; the camera draws on whole device px (`originX/originY` are rounded), so the ship only
 * ever moves by whole pixels.
 */
const DRIFT = { x: 46, y: 16, px: 34_000, py: 46_000 };
/** The ship's offset right of the screen centre, as a share of the width. */
const SHIFT = 0.16;

export async function startStage(canvas: HTMLCanvasElement, ship: string, seed = 7): Promise<Stage> {
  const sim = newGame(seed, content, ship, false);
  const r: Renderer = await createRenderer(canvas, 'high', sim.world, content);
  setAnimPaused(false);
  r.setSector(sim.sector.grid);
  r.setBackdrop(backdropSpecOf(sim));
  const step = (): void => {
    sim.step();
    r.onEvents(sim.events.drain());
  };
  step();
  const grid = shipGrid(sim, homeShip(sim));
  if (grid) r.setGrid(grid);
  let at = { x: 0, y: 0 };
  const frame = (): void => {
    r.frameShips([homeShip(sim)]);
    r.pan(innerWidth * SHIFT, 0);
    at = { x: 0, y: 0 };
  };
  const onResize = (): void => {
    r.resize();
    frame();
  };
  onResize();
  let raf = 0;
  let dead = false;
  let n = 0;
  const loop = (t: number): void => {
    if (dead) return;
    if (n++ % 12 === 0) step(); // a slow heartbeat: the crew move about, the sim is otherwise still
    const to = { x: Math.sin(t / DRIFT.px * Math.PI * 2) * DRIFT.x, y: Math.cos(t / DRIFT.py * Math.PI * 2) * DRIFT.y };
    if (n === 20 || n === 150) {
      frame();
    }
    r.pan(to.x - at.x, to.y - at.y);
    at = to;
    r.render(0);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  addEventListener('resize', onResize);
  return {
    portrait: (look) => (dead ? null : r.portraitOf(look)),
    dispose() {
      dead = true;
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
      r.dispose();
    },
  };
}
