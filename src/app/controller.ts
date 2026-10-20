import { shipIdOf, shipGrid } from '../sim/regions';
import { AboardC, AllegianceC, BodyC, CrewC, DraftedC, ModuleC, PositionC, ShipC, Struct, footprintTiles, isWalkable, placementError, rotatedSize, type Sim, type SimEvent } from '../sim';
import type { Renderer } from '../render/scene';
import type { UiBuildKind, UiToolState } from '../ui/api';
import type { Bridge } from './bridge';
import type { InputHandlers, Tile } from './input';
import { createAlerts, type Alerts } from './alerts';
import { createEventLog, type EventLog } from './eventLog';
import { rejectionMessage } from './messages';
import { createStore, type Readable } from './store';
import { homeShip } from '../sim/index';

const BUILD_STRUCT: Record<Exclude<UiBuildKind, 'module'>, number> = { wall: Struct.Wall, floor: Struct.Floor, door: Struct.Door };
const TOAST_MS = 2500;

/** Tool + selection state and the translation of input gestures into commands. */
export interface Controller {
  tool: Readable<UiToolState>;
  selectedCrew: Readable<number | null>;
  selectedModule: Readable<number | null>;
  /** Another ship or station picked from the node strip (a ShipC or trader entity id), or null. */
  selectedShip: Readable<number | null>;
  /** Select another ship or station and frame a ship in the camera (null clears). A station has no ship, so the camera stays. */
  selectShip(ship: number | null): void;
  alerts: Alerts;
  log: EventLog;
  toast: Readable<string | null>;
  setTool(state: Partial<UiToolState>): void;
  selectCrew(id: number | null, focus?: boolean): void;
  /** Center the camera on a crew member wherever they are. */
  focusCrew(id: number): void;
  /** Order drafted crew (the selected one, else all) to attack a hostile crew member. */
  attack(target: number): void;
  selectModule(id: number | null): void;
  focusAlert(id: number): void;
  onEvents(events: SimEvent[]): void;
  /** Wire up the renderer once the canvas exists; returns handlers for attachInput. */
  attach(renderer: Renderer): InputHandlers;
}

export function createController(sim: Sim, bridge: Bridge): Controller {
  const tool = createStore<UiToolState>({ tool: 'select', build: 'wall', moduleDef: null, rot: 0 });
  const modSel = createStore<number | null>(null);
  const shipSel = createStore<number | null>(null);
  /** The player's ship (home grid 1) as a ShipC entity id. */
  const homeShipId = () => homeShip(sim);
  const alerts = createAlerts(sim);
  const log = createEventLog(sim);
  let modPos: Tile | null = null;
  const crewSel = createStore<number | null>(null);
  const toast = createStore<string | null>(null);
  let r: Renderer | undefined;
  let hover: Tile | null = null;
  let paintStart: Tile | null = null;
  let paintEnd: Tile | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  const showToast = (msg: string, ms = TOAST_MS) => {
    toast.set(msg);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.set(null), ms);
  };

  const selectTile = (t: Tile | null) => {
    shipSel.set(null);
    crewSel.set(null);
    modSel.set(null);
    r?.setSelectedCrew(null);
    r?.setSelection(t);
    bridge.setSelected(t ? { ship: homeShipId(), ...t } : null);
  };
  /** Center the camera on a crew member: on their ship, or on the shuttle they ride. */
  const focusCrew = (id: number) => {
    const p = sim.world.get(id, PositionC);
    if (p) {
      if (sim.world.has(shipIdOf(sim, p), ShipC)) return r?.focusSector(p.x + (p.toX - p.x) * p.progress + 0.5, p.y + (p.toY - p.y) * p.progress + 0.5);
    }
    const b = sim.world.get(sim.world.get(id, AboardC)?.vehicle ?? 0, BodyC);
    if (b) r?.focusSector(b.x, b.y);
  };
  const isPlayerCrew = (id: number) => sim.world.get(id, AllegianceC)?.faction === 'player';
  const selectCrew = (id: number | null, focus = false) => {
    if (id === null) return selectTile(null);
    modSel.set(null);
    shipSel.set(null);
    crewSel.set(id);
    r?.setSelection(null);
    bridge.setSelected(null);
    r?.setSelectedCrew(id);
    if (focus) focusCrew(id);
  };
  const attack = (target: number) => {
    const sel = crewSel.get();
    const ids = sel !== null && sim.world.has(sel, DraftedC) && isPlayerCrew(sel) ? [sel] : [...sim.world.query(CrewC, DraftedC)].filter(isPlayerCrew);
    if (!ids.length) return showToast('Draft crew first');
    for (const id of ids) sim.enqueue({ type: 'crew.attack', id, target });
  };

  const selectModule = (id: number | null) => {
    const m = id === null ? undefined : sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (id === null || !m || !def) return selectTile(null);
    crewSel.set(null);
    shipSel.set(null);
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
    return { tiles: footprintTiles(def, at.x, at.y, t.rot), at, def: t.moduleDef, error: placementError(sim, homeShip(sim), t.moduleDef, at.x, at.y, t.rot) };
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
      if (t === 'build' && build !== 'module') sim.enqueue({ type: 'job.build', ship: homeShipId(), x, y, struct: BUILD_STRUCT[build] });
      else if (t === 'deconstruct') sim.enqueue({ type: 'job.deconstruct', ship: homeShipId(), x, y });
      else if (t === 'cancel') sim.enqueue({ type: 'job.cancel', ship: homeShipId(), x, y });
    }
    paintStart = paintEnd = null;
    refreshPreview();
  };
  const toggleDraft = () => {
    const id = crewSel.get();
    if (id !== null && isPlayerCrew(id)) sim.enqueue({ type: 'crew.draft', id, drafted: !sim.world.has(id, DraftedC) });
  };

  const placeModule = () => {
    const plan = modulePlan();
    if (!plan) return;
    if (plan.error) showToast(rejectionMessage(plan.error));
    else sim.enqueue({ type: 'job.buildModule', ship: homeShipId(), x: plan.at.x, y: plan.at.y, def: plan.def, rot: tool.get().rot });
  };
  const rotate = () => setTool({ rot: (tool.get().rot + 1) % 4 });

  return {
    tool,
    alerts,
    log,
    selectedModule: modSel,
    selectedShip: shipSel,
    selectShip(ship) {
      selectTile(null);
      if (ship === null) return;
      shipSel.set(ship);
      const shipId = ship; // a station has no ship component, so no grid
      if (shipId > 0) r?.frameShips([shipId]);
    },
    selectedCrew: crewSel,
    selectModule,
    focusAlert(id) {
      const at = alerts.get(id)?.at;
      if (at) r?.focusTile(at.x, at.y);
    },
    toast,
    setTool,
    selectCrew,
    focusCrew,
    attack,
    onEvents(events) {
      for (const e of events) {
        if (e.type === 'command.rejected') showToast(rejectionMessage(e.reason));
        else if (e.type === 'ship.captured') showToast(e.by === 'player' ? 'Ship captured! It is now a prize.' : 'Your ship was captured!', 8000);
      }
      alerts.onEvents(events);
      log.onEvents(events);
    },
    attach(renderer) {
      r = renderer;
      return {
        onTap(sx, sy) {
          const crewId = renderer.pickCrew(sx, sy);
          if (crewId !== null) return isPlayerCrew(crewId) ? selectCrew(crewId) : crewSel.get() !== null && sim.world.has(crewSel.get() as number, DraftedC) ? attack(crewId) : selectCrew(crewId);
          const tile = renderer.pickTile(sx, sy);
          const grid0 = shipGrid(sim, homeShip(sim));
          const modHere = tile && grid0 ? grid0.get('module', tile.x, tile.y) : 0;
          let modId = modHere;
          if (!modId && tile) {
            // Tall sprites cover tiles behind them; a tile in front of the module's front tile never selects it.
            const hit = renderer.pickModule(sx, sy) ?? 0;
            const m = hit ? sim.world.get(hit, ModuleC) : undefined;
            const def = m && sim.content.modules[m.def];
            if (m && def) {
              const [w, h] = rotatedSize(def, m.rot);
              if (tile.x <= m.x + w - 1 && tile.y <= m.y + h - 1) modId = hit;
            }
          }
          if (modId) return selectModule(modId);
          const sel = crewSel.get();
          const any = renderer.pickTileAny(sx, sy);
          const ag = any && shipGrid(sim, any.shipId);
          if (any && ag && sel !== null && sim.world.has(sel, DraftedC) && isWalkable(ag.get('struct', any.x, any.y))) {
            const here = shipIdOf(sim, sim.world.get(sel, PositionC));
            sim.enqueue({ type: 'crew.moveTo', id: sel, x: any.x, y: any.y, ...(here !== any.shipId ? { ship: any.shipId } : {}) });
          } else selectTile(tile);
        },
        onHover(t) {
          hover = t;
          if (!paintStart) modPos = null;
          bridge.setHovered(t ? { ship: homeShipId(), ...t } : null);
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
