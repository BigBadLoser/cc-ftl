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

export interface YardTool {
  /** The yard tool is the current tool. */
  active(): boolean;
  /** Drag lifecycle on the sector tile under the pointer (rectangle add or erase). */
  paint(phase: 'start' | 'move' | 'end' | 'cancel', tile: Tile | null): void;
  /** Redraw the overlay (the plan changed, or the drag moved). */
  draw(): void;
  /** Forget the painted hull and the overlay. */
  clear(): void;
  /** The tool state changed: leaving the tool clears, a new station starts afresh. */
  sync(): void;
}

/**
 * The shipyard's planning view on the map: drag rectangles of new hull against the ship (the erase switch takes tiles out again). The painted set
 * goes to the bridge, which asks the sim to check and price it (`planYard`); the overlay shows the floor, the walls the yard will add, and what is
 * in the way. The painting itself is `AreaPaint`, which the construction pod will reuse.
 */
export function createYardTool(bridge: Bridge, deps: { tool: Writable<UiToolState>; renderer(): Renderer | undefined }): YardTool {
  const area: AreaPaint = createAreaPaint();
  let station = 0;
  const state = () => deps.tool.get();
  const active = () => state().tool === 'yard' && !!state().yard;
  const push = () => {
    bridge.setYardPaint(station, area.tiles());
    draw();
  };
  function draw(): void {
    const r = deps.renderer();
    if (!r) return;
    if (!active()) {
      // A running order keeps its unbuilt tiles drawn, so the work can be followed.
      const o = bridge.yard.get().order;
      return r.setAreas(o?.live ? [{ tiles: o.floor, tint: CYAN }, { tiles: o.walls, tint: AMBER }] : []);
    }
    const plan = bridge.yard.get().plan;
    const painted = area.tiles();
    const key = (t: Tile) => `${t.x},${t.y}`;
    const bad = new Set((plan?.bad ?? []).map(key));
    const wrong = !!plan?.error && bad.size === 0 && plan.error !== 'noTiles';
    r.setAreas([
      { tiles: plan?.walls ?? [], tint: AMBER, solid: true },
      { tiles: painted.filter((t) => !bad.has(key(t)) && !wrong), tint: CYAN, solid: true },
      { tiles: painted.filter((t) => bad.has(key(t)) || wrong), tint: RED, solid: true },
      { tiles: area.dragging(), tint: area.mode() === 'erase' ? RED : WHITE },
    ]);
  }
  return {
    active,
    paint(phase, tile) {
      if (!active()) return;
      area.setMode(state().yard?.erase ? 'erase' : 'add');
      if (phase === 'start' && tile) area.begin(tile);
      else if (phase === 'cancel') area.cancel();
      else if (phase === 'move' && tile) area.drag(tile);
      else if (phase === 'end') {
        if (tile) area.drag(tile);
        if (area.end()) return push();
      }
      draw();
    },
    draw,
    clear() {
      if (!station && area.tiles().length === 0) return; // nothing planned: leave the bridge and the overlay alone
      area.clear();
      area.cancel();
      station = 0;
      bridge.setYardPaint(0, []);
      deps.renderer()?.setAreas([]);
    },
    sync() {
      const s = state();
      if (s.tool !== 'yard' || !s.yard) return this.clear();
      if (s.yard.station !== station) {
        area.clear();
        station = s.yard.station;
        push();
      } else draw();
    },
  };
}
