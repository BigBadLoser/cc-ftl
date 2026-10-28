import { ShipC, brushPlan, cutPlan, touchesShip, type BrushResult, type Sim } from '../sim';
import type { Renderer } from '../render/scene';
import type { UiToolState } from '../ui/api';
import type { Bridge } from './bridge';
import { MIN_SIDE, dragRect, lineTiles, mirrorTiles, rectTiles, withMirror } from './hullBrush';
import type { Tile } from './input';
import { rejectionMessage } from './messages';
import type { Writable } from './store';

const CYAN = 0x22d3ee;
const AMBER = 0xffb020;
const RED = 0xff4d4d;
const WHITE = 0xffffff;
const ORANGE = 0xffa030;
const MAGENTA = 0xff3df0;

type Brush = NonNullable<UiToolState['hull']>;
export const DEFAULT_BRUSH: Brush = { brush: 'rect', erase: false, mirror: false };
type Area = { tiles: Tile[]; tint: number; solid?: boolean };
type Stroke = { tiles: Tile[]; label: string; result: BrushResult & { reason: string | null }; end: Tile; lines: Tile[][]; idle: boolean; replacePlan: boolean };

export interface HullPlanTool {
  /** The Hull plan build tool is the current tool. */
  active(): boolean;
  /** Drag lifecycle on the sector tile under the pointer: a brush stroke that joins the plan (or leaves it) when released. */
  paint(phase: 'start' | 'move' | 'end' | 'cancel', tile: Tile | null): void;
  /** The tile under the mouse (null when it is off the grid): with no drag, the brush shows where a stroke would start. */
  setHover(tile: Tile | null): void;
  /** Redraw the ghost tiles: the plan (only with the Hull plan tool or a Shipyard tab open), the stroke being dragged and a yard order's unbuilt tiles. */
  draw(): void;
}

/**
 * The hull planner of the build tools: brushes that edit the ship's planned outer hull. The rectangle brush drags out a block (at least 3 x 3, so a
 * thinner shape cannot be drawn) that has to touch the ship or the connected plan; erase takes planned tiles out of the plan (real hull is never in
 * the plan, so it stays); the line brush cuts the plan along a straight 0, 45 or 90 degree line. Mirror repeats every stroke across the ship's long
 * axis. A stroke joins the plan on release (no confirm) unless it would leave part of the ship narrower than 3 tiles, or (rectangles) float free of the
 * ship: that shows red while it is dragged and does not apply. With no drag the brush's first footprint shows under the cursor. The plan lives in the sim
 * (`hull.plan`, saved with the ship); brushes only produce tile lists, which `brushPlan` and `cutPlan` judge and turn into the new outline.
 */
export function createHullPlanTool(sim: Sim, bridge: Bridge, deps: { tool: Writable<UiToolState>; placeHint: Writable<{ x: number; y: number; text: string } | null>; renderer(): Renderer | undefined; ship(): number }): HullPlanTool {
  let from: Tile | null = null;
  let to: Tile | null = null;
  let hover: Tile | null = null;
  const state = () => deps.tool.get();
  const brush = (): Brush => ({ ...DEFAULT_BRUSH, ...state().hull });
  const active = () => state().tool === 'build' && state().build === 'hull';
  const setNote = (note: string) => {
    if ((state().hull?.note ?? '') !== note) deps.tool.update((t) => ({ ...t, hull: { ...DEFAULT_BRUSH, ...t.hull, note } }));
  };

  /** The stroke being dragged, or (with no drag) the one a click at the cursor would start: its tiles, the text for the pointer, and the plan after it. */
  function stroke(): Stroke | null {
    const a = from ?? hover;
    const b = from ? to ?? from : hover;
    if (!a || !b) return null;
    const idle = from === null;
    const b0 = brush();
    const ship = sim.world.get(deps.ship(), ShipC);
    const mirror = (t: Tile[]): Tile[] => (b0.mirror && ship ? withMirror(t, ship) : t);
    const none = (reason: string | null): Stroke['result'] => ({ outline: [], footprint: [], removed: [], bad: [], unchanged: true, error: null, reason });
    if (b0.brush === 'line') {
      const line = lineTiles(a, b);
      const lines = b0.mirror && ship ? [line, mirrorTiles(line, ship)] : [line];
      const tiles = mirror(line);
      if (idle) return { tiles: [a], label: '', result: none(null), end: b, lines: [], idle, replacePlan: false };
      const result = cutPlan(sim, deps.ship(), tiles);
      return { tiles, label: `${line.length} tiles`, result: { ...result, reason: result.error }, end: b, lines, idle, replacePlan: false };
    }
    // The rectangle is drawn at the size it was dragged: under 3 x 3 it shows red (and does nothing on release) instead of snapping up.
    const r = dragRect(a, b, 1);
    const part = rectTiles(r);
    const tiles = mirror(part);
    const label = `${r.w} × ${r.h}`;
    if (idle) return { tiles, label, result: none(null), end: b, lines: [], idle, replacePlan: false };
    if (r.w < MIN_SIDE || r.h < MIN_SIDE) return { tiles, label, result: none('minSize'), end: b, lines: [], idle, replacePlan: false };
    if (b0.erase) {
      const result = brushPlan(sim, deps.ship(), 'erase', tiles);
      return { tiles, label, result: { ...result, reason: result.error }, end: b, lines: [], idle, replacePlan: false };
    }
    const result = brushPlan(sim, deps.ship(), 'add', tiles);
    const parts = b0.mirror && ship ? [part, mirrorTiles(part, ship)] : [part];
    // every piece of the stroke has to touch the ship (or the plan connected to it): a rectangle floating free of it is refused
    const floats = parts.some((p) => !touchesShip(sim, deps.ship(), p));
    const reason = floats ? 'mustTouch' : result.error;
    return { tiles, label, result: { ...result, reason }, end: b, lines: [], idle, replacePlan: !reason && !result.unchanged };
  }

  /**
   * The stroke as ghost tiles. Red (its offending tiles stronger) when it will not apply. An add shows what the plan will be: the hull ring in the plan
   * ghost's amber and the floor it shuts in in its cyan, where the new block merges with the plan and the ship. An erase is an outline with only the tiles
   * it takes out tinted; a line cut tints what it drops magenta (the bold line itself is drawn by the renderer). With no drag, just the outline.
   */
  function strokeAreas(s: Stroke): Area[] {
    const { tiles, result } = s;
    if (s.idle) return [{ tiles, tint: brush().erase || brush().brush === 'line' ? ORANGE : WHITE }];
    if (result.reason) return [{ tiles, tint: RED, solid: true }, { tiles: result.bad, tint: RED, solid: true }, { tiles: result.bad, tint: RED, solid: true }];
    if (brush().brush === 'line') return [{ tiles: result.removed, tint: MAGENTA, solid: true }, { tiles: result.removed, tint: MAGENTA, solid: true }];
    if (brush().erase) return [{ tiles, tint: ORANGE }, ...(result.removed.length ? [{ tiles: result.removed, tint: ORANGE, solid: true }] : [])];
    if (!s.replacePlan) return [{ tiles, tint: WHITE }];
    const ring = new Set(result.outline.map((t) => `${t.x},${t.y}`));
    return [
      { tiles: result.footprint.filter((t) => !ring.has(`${t.x},${t.y}`)), tint: CYAN },
      { tiles: result.footprint.filter((t) => ring.has(`${t.x},${t.y}`)), tint: AMBER, solid: true },
      { tiles, tint: WHITE },
    ];
  }

  function draw(): void {
    const r = deps.renderer();
    if (!r) return;
    const { plan, order, quote } = bridge.yard.get();
    const s = active() ? stroke() : null;
    const loose = new Set(plan.loose.map((t) => `${t.x},${t.y}`));
    // The plan is only drawn while it is being worked on: with the Hull plan tool open, or a shipyard's Shipyard tab (which has a quote) open.
    const shown = active() || !!quote;
    const redPlan = shown && plan.bad.length > 0 && !s?.replacePlan;
    r.setAreas([
      ...(shown && !s?.replacePlan ? [
        { tiles: plan.floor, tint: CYAN },
        { tiles: plan.connected, tint: AMBER, solid: true },
        { tiles: plan.tiles.filter((t) => loose.has(`${t.x},${t.y}`)), tint: AMBER },
      ] : []),
      ...(shown ? [{ tiles: plan.blocked, tint: RED, solid: true }] : []),
      // a plan with a part narrower than 3: the whole plan red, the offending tiles stronger (drawn twice over)
      ...(redPlan ? [{ tiles: [...plan.tiles, ...plan.floor], tint: RED, solid: true }, { tiles: plan.bad, tint: RED, solid: true }, { tiles: plan.bad, tint: RED, solid: true }] : []),
      ...(order?.live ? [{ tiles: order.floor, tint: CYAN, solid: true }, { tiles: order.walls, tint: WHITE, solid: true }] : []),
      ...(s ? strokeAreas(s) : []),
    ]);
    r.setCutLine(s && s.lines.length ? s.lines : [], s?.result.reason ? RED : MAGENTA);
    const dragging = from !== null;
    const at = s && dragging ? r.screenOf(deps.ship(), s.end.x, s.end.y) : null;
    deps.placeHint.set(s && dragging && at ? { x: at.x, y: at.y, text: s.result.reason ? `${s.label}: ${rejectionMessage(s.result.reason)}` : s.label } : null);
    if (dragging) setNote(s?.result.reason ? rejectionMessage(s.result.reason) : '');
  }

  return {
    active,
    setHover(tile) {
      hover = tile;
    },
    paint(phase, tile) {
      if (!active()) return;
      if (phase === 'start' && tile) {
        from = to = tile;
        setNote('');
      } else if (phase === 'cancel') from = to = null;
      else if (phase === 'move' && tile && from) to = tile;
      else if (phase === 'end') {
        if (tile && from) to = tile;
        const s = stroke();
        if (s && from && !s.result.reason && !s.result.unchanged) bridge.dispatch({ type: 'hull.plan', ship: deps.ship(), tiles: s.result.outline });
        const kept = s && from && s.result.reason ? rejectionMessage(s.result.reason) : '';
        from = to = null;
        deps.placeHint.set(null);
        draw();
        return setNote(kept); // the reason a stroke did not apply stays in the bar until the next one
      }
      draw();
    },
    draw,
  };
}
