import type { Renderer } from '../render/scene';
import type { UiToolState } from '../ui/api';
import { createAreaPaint, type AreaPaint } from './areaPaint';
import type { Bridge } from './bridge';
import type { Tile } from './input';
import type { Writable } from './store';

const CYAN = 0x22d3ee;
const AMBER = 0xffb020;
const RED = 0xff4d4d;
const WHITE = 0xffffff;

export interface HullPlanTool {
  /** The Hull plan build tool is the current tool. */
  active(): boolean;
  /** Drag lifecycle on the sector tile under the pointer: a rectangle's outline added, or the tiles in it erased. */
  paint(phase: 'start' | 'move' | 'end' | 'cancel', tile: Tile | null): void;
  /** Redraw the ghost tiles: the plan (only with the Hull plan tool or a Shipyard tab open), the drag and a yard order's unbuilt tiles. */
  draw(): void;
}

/**
 * The hull planner of the build tools: drag a rectangle to plan its outline as the ship's outer hull (erase takes planned tiles out). Free and at any
 * time. The plan lives in the sim (`hull.plan`, saved with the ship); this tool only paints it with `AreaPaint` (which the construction pod will
 * reuse) and draws it as ghost tiles: the hull a yard could build from the ship now (amber), planned hull floating off the ship (outline), tiles in the
 * way (red) and the floor it would shut in (cyan outline).
 */
export function createHullPlanTool(bridge: Bridge, deps: { tool: Writable<UiToolState>; renderer(): Renderer | undefined; ship(): number }): HullPlanTool {
  const area: AreaPaint = createAreaPaint('add', 'outline');
  const state = () => deps.tool.get();
  const active = () => state().tool === 'build' && state().build === 'hull';
  function draw(): void {
    const r = deps.renderer();
    if (!r) return;
    const { plan, order, quote } = bridge.yard.get();
    const dragging = active() ? area.dragging() : [];
    const loose = new Set(plan.loose.map((t) => `${t.x},${t.y}`));
    // The plan is only drawn while it is being worked on: with the Hull plan tool open, or a shipyard's Shipyard tab (which has a quote) open.
    const shown = active() || !!quote;
    r.setAreas([
      ...(shown ? [
        { tiles: plan.floor, tint: CYAN },
        { tiles: plan.connected, tint: AMBER, solid: true },
        { tiles: plan.tiles.filter((t) => loose.has(`${t.x},${t.y}`)), tint: AMBER },
        { tiles: plan.blocked, tint: RED, solid: true },
      ] : []),
      ...(order?.live ? [{ tiles: order.floor, tint: CYAN, solid: true }, { tiles: order.walls, tint: WHITE, solid: true }] : []),
      { tiles: dragging, tint: area.mode() === 'erase' ? RED : WHITE },
    ]);
  }
  return {
    active,
    paint(phase, tile) {
      if (!active()) return;
      area.setMode(state().hull?.erase ? 'erase' : 'add');
      if (phase === 'start' && tile) {
        area.set(bridge.yard.get().plan.tiles);
        area.begin(tile);
      } else if (phase === 'cancel') area.cancel();
      else if (phase === 'move' && tile) area.drag(tile);
      else if (phase === 'end') {
        if (tile) area.drag(tile);
        if (area.end()) bridge.dispatch({ type: 'hull.plan', ship: deps.ship(), tiles: area.tiles() });
      }
      draw();
    },
    draw,
  };
}
