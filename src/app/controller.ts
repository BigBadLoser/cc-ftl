import { DraftedC, ModuleC, PositionC, Struct, footprintTiles, isWalkable, placementError, type Sim, type SimEvent } from '../sim';
import type { Renderer } from '../render/scene';
import type { UiBuildKind, UiToolState } from '../ui/api';
import type { Bridge } from './bridge';
import type { InputHandlers, Tile } from './input';
import { createAlerts, type Alerts } from './alerts';
import { rejectionMessage } from './messages';
import { createStore, type Readable } from './store';

const GRID = 1;
const BUILD_STRUCT: Record<Exclude<UiBuildKind, 'module'>, number> = { wall: Struct.Wall, floor: Struct.Floor, door: Struct.Door };
const TOAST_MS = 2500;

/** Tool + selection state and the translation of input gestures into commands. */
export interface Controller {
  tool: Readable<UiToolState>;
  selectedCrew: Readable<number | null>;
  selectedModule: Readable<number | null>;
  alerts: Alerts;
  toast: Readable<string | null>;
  setTool(state: Partial<UiToolState>): void;
  selectCrew(id: number | null, focus?: boolean): void;
  selectModule(id: number | null): void;
  focusAlert(id: number): void;
  onEvents(events: SimEvent[]): void;
  /** Wire up the renderer once the canvas exists; returns handlers for attachInput. */
  attach(renderer: Renderer): InputHandlers;
}

export function createController(sim: Sim, bridge: Bridge): Controller {
  const tool = createStore<UiToolState>({ tool: 'select', build: 'wall', moduleDef: null, rot: 0 });
  const modSel = createStore<number | null>(null);
  const alerts = createAlerts(sim);
  let modPos: Tile | null = null;
  const crewSel = createStore<number | null>(null);
  const toast = createStore<string | null>(null);
  let r: Renderer | undefined;
  let hover: Tile | null = null;
  let paintStart: Tile | null = null;
  let paintEnd: Tile | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  const showToast = (msg: string) => {
    toast.set(msg);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.set(null), TOAST_MS);
  };

  const selectTile = (t: Tile | null) => {
    crewSel.set(null);
    modSel.set(null);
    r?.setSelectedCrew(null);
    r?.setSelection(t);
    bridge.setSelected(t ? { gridId: GRID, ...t } : null);
  };
  const selectCrew = (id: number | null, focus = false) => {
    if (id === null) return selectTile(null);
    modSel.set(null);
    crewSel.set(id);
    r?.setSelection(null);
    bridge.setSelected(null);
    r?.setSelectedCrew(id);
    const p = sim.world.get(id, PositionC);
    if (focus && p) r?.focusTile(p.x + (p.toX - p.x) * p.progress + 0.5, p.y + (p.toY - p.y) * p.progress + 0.5);
  };

  const selectModule = (id: number | null) => {
    const m = id === null ? undefined : sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (id === null || !m || !def) return selectTile(null);
    crewSel.set(null);
    r?.setSelectedCrew(null);
    bridge.setSelected(null);
    modSel.set(id);
    r?.setSelection(footprintTiles(def, m.x, m.y, m.rot));
  };

  const moduleMode = () => {
    const t = tool.get();
    return t.tool === 'build' && t.build === 'module' && t.moduleDef !== null;
  };
  /** Footprint tiles and validity of the module being placed at the cursor, or null. */
  const modulePlan = () => {
    const t = tool.get();
    const at = modPos ?? hover;
    const def = t.moduleDef ? sim.content.modules[t.moduleDef] : undefined;
    if (!at || !def || !t.moduleDef) return null;
    return { tiles: footprintTiles(def, at.x, at.y, t.rot), at, def: t.moduleDef, error: placementError(sim, GRID, t.moduleDef, at.x, at.y, t.rot) };
  };

  /** Tiles covered by the current drag: a line for wall/door, a rectangle otherwise. */
  const shape = (): Tile[] => {
    if (!paintStart || !paintEnd) return [];
    const { x: sx, y: sy } = paintStart;
    let { x: ex, y: ey } = paintEnd;
    const t = tool.get();
    if (t.tool === 'build' && t.build !== 'floor') {
      if (Math.abs(ex - sx) >= Math.abs(ey - sy)) ey = sy;
      else ex = sx;
    }
    const out: Tile[] = [];
    for (let y = Math.min(sy, ey); y <= Math.max(sy, ey); y++) {
      for (let x = Math.min(sx, ex); x <= Math.max(sx, ex); x++) out.push({ x, y });
    }
    return out;
  };
  const refreshPreview = () => {
    const active = tool.get().tool !== 'select';
    r?.setHover(active ? null : hover);
    if (moduleMode()) {
      const plan = modulePlan();
      r?.setPreview(plan?.tiles ?? [], plan ? plan.error === null : true);
      return;
    }
    r?.setPreview(paintStart ? shape() : active && hover ? [hover] : []);
  };
  const setTool = (s: Partial<UiToolState>) => {
    tool.update((cur) => ({ ...cur, ...s }));
    if (s.tool === 'select') modPos = null;
    paintStart = paintEnd = null;
    refreshPreview();
  };
  const commit = () => {
    const { tool: t, build } = tool.get();
    if (t === 'build' && build === 'module') return;
    for (const { x, y } of shape()) {
      if (t === 'build' && build !== 'module') sim.enqueue({ type: 'job.build', gridId: GRID, x, y, struct: BUILD_STRUCT[build] });
      else if (t === 'deconstruct') sim.enqueue({ type: 'job.deconstruct', gridId: GRID, x, y });
      else if (t === 'cancel') sim.enqueue({ type: 'job.cancel', gridId: GRID, x, y });
    }
    paintStart = paintEnd = null;
    refreshPreview();
  };
  const toggleDraft = () => {
    const id = crewSel.get();
    if (id !== null) sim.enqueue({ type: 'crew.draft', id, drafted: !sim.world.has(id, DraftedC) });
  };

  const placeModule = () => {
    const plan = modulePlan();
    if (!plan) return;
    if (plan.error) showToast(rejectionMessage(plan.error));
    else sim.enqueue({ type: 'job.buildModule', gridId: GRID, x: plan.at.x, y: plan.at.y, def: plan.def, rot: tool.get().rot });
  };
  const rotate = () => setTool({ rot: (tool.get().rot + 1) % 4 });

  return {
    tool,
    alerts,
    selectedModule: modSel,
    selectedCrew: crewSel,
    selectModule,
    focusAlert(id) {
      const at = alerts.get(id)?.at;
      if (at) r?.focusTile(at.x, at.y);
    },
    toast,
    setTool,
    selectCrew,
    onEvents(events) {
      for (const e of events) if (e.type === 'command.rejected') showToast(rejectionMessage(e.reason));
      alerts.onEvents(events);
    },
    attach(renderer) {
      r = renderer;
      return {
        onTap(sx, sy) {
          const crewId = renderer.pickCrew(sx, sy);
          if (crewId !== null) return selectCrew(crewId);
          const tile = renderer.pickTile(sx, sy);
          const grid0 = sim.grids.get(GRID);
          const modHere = tile && grid0 ? grid0.get('module', tile.x, tile.y) : 0;
          const modId = modHere || (renderer.pickModule(sx, sy) ?? 0);
          if (modId) return selectModule(modId);
          const sel = crewSel.get();
          const grid = sim.grids.get(GRID);
          if (tile && sel !== null && sim.world.has(sel, DraftedC) && grid && isWalkable(grid.get('struct', tile.x, tile.y))) {
            sim.enqueue({ type: 'crew.moveTo', id: sel, x: tile.x, y: tile.y });
          } else selectTile(tile);
        },
        onHover(t) {
          hover = t;
          if (!paintStart) modPos = null;
          bridge.setHovered(t ? { gridId: GRID, ...t } : null);
          refreshPreview();
        },
        paintMode: () => tool.get().tool !== 'select',
        onPaint(phase, t) {
          if (moduleMode()) {
            if (phase === 'cancel') modPos = null;
            else {
              if (t) modPos = t;
              if (phase === 'end') {
                placeModule();
                modPos = null;
              }
            }
            return refreshPreview();
          }
          if (phase === 'start') paintStart = paintEnd = t;
          else if (phase === 'cancel') paintStart = paintEnd = null;
          else if (paintStart) {
            if (t) paintEnd = t;
            if (phase === 'end') return commit();
          }
          refreshPreview();
        },
        onBack: () => setTool({ tool: 'select' }),
        onKey(key) {
          if (key === 'r') {
            if (moduleMode()) rotate();
            else toggleDraft();
          }
          else if (tool.get().tool !== 'select') setTool({ tool: 'select' });
          else selectTile(null);
        },
      };
    },
  };
}
