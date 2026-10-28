import { ShipC, brushPlan, type BrushResult, type Sim } from '../sim';
import type { Renderer } from '../render/scene';
import type { UiToolState } from '../ui/api';
import type { Bridge } from './bridge';
import { dragRect, rectTiles, stairSize, stairTiles, withMirror } from './hullBrush';
import type { Tile } from './input';
import { rejectionMessage } from './messages';
import type { Writable } from './store';

const CYAN = 0x22d3ee;
const AMBER = 0xffb020;
const RED = 0xff4d4d;
const WHITE = 0xffffff;
const ORANGE = 0xffa030;

type Brush = NonNullable<UiToolState['hull']>;
export const DEFAULT_BRUSH: Brush = { brush: 'rect', erase: false, mirror: false };

export interface HullPlanTool {
  /** The Hull plan build tool is the current tool. */
  active(): boolean;
  /** Drag lifecycle on the sector tile under the pointer: a brush stroke that joins the plan (or leaves it) when released. */
  paint(phase: 'start' | 'move' | 'end' | 'cancel', tile: Tile | null): void;
  /** Redraw the ghost tiles: the plan (only with the Hull plan tool or a Shipyard tab open), the stroke being dragged and a yard order's unbuilt tiles. */
  draw(): void;
}

/**
 * The hull planner of the build tools: brushes that edit the ship's planned outer hull. The rectangle brush drags out a block (at least 3 x 3, so a
 * thinner shape cannot be drawn), the diagonal brush stamps a 45 degree staircase along the drag, and either one adds to the plan or erases from it
 * (erase only takes planned tiles out: real hull stays). Mirror repeats every stroke across the ship's long axis. A stroke joins the plan on release
 * (no confirm) unless it would leave part of the ship narrower than 3 tiles: that shows red while it is dragged and does not apply. The plan lives
 * in the sim (`hull.plan`, saved with the ship); brushes only produce tile lists, which `brushPlan` judges and turns into the new outline.
 */
export function createHullPlanTool(sim: Sim, bridge: Bridge, deps: { tool: Writable<UiToolState>; placeHint: Writable<{ x: number; y: number; text: string } | null>; renderer(): Renderer | undefined; ship(): number }): HullPlanTool {
  let from: Tile | null = null;
  let to: Tile | null = null;
  const state = () => deps.tool.get();
  const brush = (): Brush => ({ ...DEFAULT_BRUSH, ...state().hull });
  const active = () => state().tool === 'build' && state().build === 'hull';
  const setNote = (note: string) => {
    if ((state().hull?.note ?? '') !== note) deps.tool.update((t) => ({ ...t, hull: { ...DEFAULT_BRUSH, ...t.hull, note } }));
  };

  /** The tiles of the stroke being dragged, the text to read next to the pointer, and the plan after it. */
  function stroke(): { tiles: Tile[]; label: string; result: BrushResult } | null {
    if (!from || !to) return null;
    const b = brush();
    const ship = sim.world.get(deps.ship(), ShipC);
    let tiles: Tile[];
    let label: string;
    if (b.brush === 'rect') {
      const r = dragRect(from, to);
      tiles = rectTiles(r);
      label = `${r.w} × ${r.h}`;
    } else {
      tiles = stairTiles(from, to);
      const n = stairSize(from, to);
      label = `${n}-step diagonal`;
    }
    if (b.mirror && ship) tiles = withMirror(tiles, ship);
    return { tiles, label, result: brushPlan(sim, deps.ship(), b.erase ? 'erase' : 'add', tiles) };
  }

  function draw(): void {
    const r = deps.renderer();
    if (!r) return;
    const { plan, order, quote } = bridge.yard.get();
    const s = active() ? stroke() : null;
    const loose = new Set(plan.loose.map((t) => `${t.x},${t.y}`));
    // The plan is only drawn while it is being worked on: with the Hull plan tool open, or a shipyard's Shipyard tab (which has a quote) open.
    const shown = active() || !!quote;
    const redPlan = shown && plan.bad.length > 0;
    r.setAreas([
      ...(shown ? [
        { tiles: plan.floor, tint: CYAN },
        { tiles: plan.connected, tint: AMBER, solid: true },
        { tiles: plan.tiles.filter((t) => loose.has(`${t.x},${t.y}`)), tint: AMBER },
        { tiles: plan.blocked, tint: RED, solid: true },
      ] : []),
      // a plan with a part narrower than 3: the whole plan red, the offending tiles stronger (drawn twice over)
      ...(redPlan ? [{ tiles: [...plan.tiles, ...plan.floor], tint: RED, solid: true }, { tiles: plan.bad, tint: RED, solid: true }, { tiles: plan.bad, tint: RED, solid: true }] : []),
      ...(order?.live ? [{ tiles: order.floor, tint: CYAN, solid: true }, { tiles: order.walls, tint: WHITE, solid: true }] : []),
      ...(s ? strokeAreas(s.tiles, s.result, brush().erase) : []),
    ]);
    const rr = deps.renderer();
    const at = s && to && rr ? rr.screenOf(deps.ship(), to.x, to.y) : null;
    deps.placeHint.set(s && at ? { x: at.x, y: at.y, text: s.result.error ? `${s.label}: ${rejectionMessage(s.result.error)}` : s.label } : null);
    setNote(s?.result.error ? rejectionMessage(s.result.error) : '');
  }

  return {
    active,
    paint(phase, tile) {
      if (!active()) return;
      if (phase === 'start' && tile) from = to = tile;
      else if (phase === 'cancel') from = to = null;
      else if (phase === 'move' && tile && from) to = tile;
      else if (phase === 'end') {
        if (tile && from) to = tile;
        const s = stroke();
        if (s && !s.result.error && !s.result.unchanged) bridge.dispatch({ type: 'hull.plan', ship: deps.ship(), tiles: s.result.outline });
        const kept = s?.result.error ? rejectionMessage(s.result.error) : '';
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

/** The stroke as ghost tiles: what it would add (white) or take out (orange), or red with its offending tiles stronger when it would break the rule. */
function strokeAreas(tiles: Tile[], result: BrushResult, erase: boolean): { tiles: Tile[]; tint: number; solid?: boolean }[] {
  if (result.error) return [{ tiles, tint: RED, solid: true }, { tiles: result.bad, tint: RED, solid: true }, { tiles: result.bad, tint: RED, solid: true }];
  return [{ tiles, tint: erase ? ORANGE : WHITE, solid: erase }];
}
