import type { Container, Renderer } from 'pixi.js';
import type { Atlas } from '../../src/render/assets/loader';

/** What a panel gets to build its cells from. */
export interface LabCtx {
  atlas: Atlas;
  renderer: Renderer;
  /** The page's query string: panels read their own options from it (`?panel=sprites&ids=fx.shield_`). */
  params: URLSearchParams;
}

/**
 * One frame of the grid: a visual drawn in its own box (world px, the game's zoom-1 units) and pinned to a time, so a still
 * shows exactly that moment. `mount` builds the display objects once and returns the function that sets them to a time.
 */
export interface LabCell {
  /** Shown above the cell: what it is ("laser hit", "frame 3"). */
  label: string;
  /** Second line, small: the time or the parameters it shows. */
  note?: string;
  w: number;
  h: number;
  /** Seconds into its animation this cell shows in a still. */
  at?: number;
  /** In `&play` mode the cell loops 0..loop seconds (default: it stays at `at`). */
  loop?: number;
  /** Start a new grid row before this cell. */
  newRow?: boolean;
  mount(root: Container, ctx: LabCtx): (t: number) => void;
}

/** A page of the lab: one kind of visual (a sprite family, the shield dome, ...) laid out as cells. */
export interface LabPanel {
  id: string;
  title: string;
  /** One line on what it shows and the query options it reads. */
  help: string;
  /** Css px per world px when the page gives no `zoom` (default 1). At 2x, 0.25 still draws one art px as one device px. */
  zoom?: number;
  /** Colour behind each cell (default deep space). */
  bg?: number;
  cells(ctx: LabCtx): LabCell[] | Promise<LabCell[]>;
}

/** Times `n` evenly spread through an effect of `sec` seconds, first frame to the last (for a strip of stills). */
export function strip(sec: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => (n === 1 ? 0 : (i / (n - 1)) * sec * 0.999));
}
