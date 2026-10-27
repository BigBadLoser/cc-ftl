import { inShip, planStroke, type Sim } from '../sim';
import type { Renderer } from '../render/scene';
import type { UiToolState } from '../ui/api';
import { CORNERS, NO_CHAMFER, chamferFromDrag, handleAt, handleTiles, rectOf, shapeTiles, type Chamfers, type Corner, type ShapeRect } from './hullShape';
import type { Tile } from './input';
import { rejectionMessage } from './messages';
import type { Writable } from './store';

const CYAN = 0x22d3ee;
const ORANGE = 0xffa030;
const RED = 0xff3b3b;
const HANDLE = 0xffffff;

export interface HullShapeTool {
  /** The Hull shape build tool is the current tool. */
  active(): boolean;
  /** A rectangle is placed (being dragged or waiting to be confirmed). */
  hasShape(): boolean;
  /** Pointer lifecycle on the sector tile under it: drag a rectangle, or drag a corner handle inward. */
  paint(phase: 'start' | 'move' | 'end' | 'cancel', tile: Tile | null): void;
  /** Redraw the preview and report its state to the tool bar. */
  draw(): void;
  /** Send the shape as one command (only when it is valid), or drop it. */
  act(action: 'confirm' | 'cancel'): void;
}

type Drag = { kind: 'rect'; from: Tile } | { kind: 'handle'; corner: Corner };

/**
 * The hull shape tool: drag out a rectangle of hull to add (or to remove), then pull a corner handle inward to cut a 45 degree
 * chamfer. The preview is the resulting tile set, judged by the same stroke check as the command (width rule, queued jobs counted):
 * red when it fails, with the offending tiles stronger. Confirm sends one `job.buildArea` / `job.clearArea` for the stroke.
 * Everything here works on pointer events, so touch and mouse behave the same. It only ever sees a tile list, so a later freehand
 * outline tool can reuse the preview and the check.
 */
export function createHullShapeTool(sim: Sim, deps: { tool: Writable<UiToolState>; renderer(): Renderer | undefined; ship(): number }): HullShapeTool {
  let rect: ShapeRect | null = null;
  let ch: Chamfers = { ...NO_CHAMFER };
  let drag: Drag | null = null;
  const active = () => deps.tool.get().tool === 'build' && deps.tool.get().build === 'shape';
  const remove = () => !!deps.tool.get().shape?.remove;

  const tiles = (): Tile[] => (rect ? shapeTiles(rect, ch) : []);
  const judge = () => {
    const all = tiles();
    const ship = deps.ship();
    const outside = all.filter((t) => !inShip(sim, ship, t.x, t.y));
    if (outside.length) return { all, todo: [] as Tile[], bad: outside, error: 'outOfBounds' as string | null };
    const plan = planStroke(sim, ship, remove() ? 'clear' : 'build', all);
    return { all, ...plan };
  };
  const report = (state: 'none' | 'ok' | 'red', count: number, message: string) => {
    const cur = deps.tool.get().shape;
    if (cur && cur.state === state && cur.tiles === count && cur.message === message) return;
    deps.tool.update((t) => ({ ...t, shape: { remove: !!t.shape?.remove, state, tiles: count, message } }));
  };

  function draw(): void {
    const r = deps.renderer();
    if (!r) return;
    if (!active() || !rect) {
      if (active()) report('none', 0, '');
      r.setPreview([]);
      r.setAreas([]);
      return;
    }
    const j = judge();
    const red = !!j.error && (j.error === 'narrowHull' || j.todo.length > 0 || j.bad.length > 0);
    const handles = CORNERS.flatMap((c) => handleTiles(rect as ShapeRect, c));
    const fill = remove() ? ORANGE : CYAN;
    r.setPreview(remove() && !red ? [] : j.all, !red); // a valid removal shows in orange only
    r.setAreas([
      { tiles: j.all, tint: red ? RED : fill, solid: true },
      ...(red ? [{ tiles: j.bad, tint: RED, solid: true }, { tiles: j.bad, tint: RED, solid: true }] : []),
      { tiles: handles, tint: HANDLE, solid: true },
      { tiles: handles, tint: HANDLE, solid: true }, // twice over: a handle is a target to grab, so it reads brighter than the fill
    ]);
    if (red) report('red', j.todo.length, rejectionMessage(j.error as string));
    else if (j.error) report('none', 0, rejectionMessage(j.error));
    else report('ok', j.todo.length, '');
  }

  return {
    active,
    hasShape: () => rect !== null,
    paint(phase, t) {
      if (!active()) return;
      if (phase === 'start' && t) {
        const corner = rect ? handleAt(rect, t) : null;
        drag = corner ? { kind: 'handle', corner } : { kind: 'rect', from: t };
        if (!corner) {
          rect = rectOf(t, t);
          ch = { ...NO_CHAMFER };
        }
      } else if (phase === 'cancel') {
        drag = null;
      } else if (drag && t) {
        if (drag.kind === 'rect') {
          rect = rectOf(drag.from, t);
          ch = { ...NO_CHAMFER };
        } else if (rect) ch = { ...ch, [drag.corner]: chamferFromDrag(rect, drag.corner, t) };
        if (phase === 'end') drag = null;
      } else if (phase === 'end') drag = null;
      draw();
    },
    draw,
    act(action) {
      if (action === 'confirm' && rect) {
        const j = judge();
        if (j.error || !j.todo.length) return;
        sim.enqueue({ type: remove() ? 'job.clearArea' : 'job.buildArea', ship: deps.ship(), tiles: j.todo });
      }
      rect = null;
      ch = { ...NO_CHAMFER };
      drag = null;
      draw();
    },
  };
}
