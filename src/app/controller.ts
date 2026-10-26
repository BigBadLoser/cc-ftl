import { asteroidAt, inShip, shipIdAt, shipIdOf, shipGrid } from '../sim/regions';
import { AsteroidC } from '../sim/asteroids/components';
import { AboardC, AllegianceC, BodyC, DraftedC, ModuleC, PositionC, ShipC, Struct, VehicleC, footprintTiles, isBlueprintKnown, isOreTile, isSolidRock, placementError, type Sim, type SimEvent } from '../sim';
import type { Renderer } from '../render/scene';
import { ROCK_MASS_Z } from '../render/asteroidView';
import type { UiBuildKind, UiToolState } from '../ui/api';
import type { Bridge } from './bridge';
import type { InputHandlers, Tile } from './input';
import { createAlerts, type Alerts } from './alerts';
import { createEventLog, type EventLog } from './eventLog';
import { rejectionMessage } from './messages';
import { createStore, type Readable } from './store';
import { homeShip } from '../sim/index';
import { foreignShipTarget } from './tapTarget';
import { EggSacC } from '../sim/aliens/components';
import { draftedOf, moduleUnder, planOrders, type OrderPlan } from './crewOrders';
import { boxSelection, clickSelection, idsInRect, normRect, type Rect } from './selection';
import { needsMenu, type OrderChoice, type OrderId } from './orders';
import { shipById } from '../sim/combat/ships';

// dig, level and finish are builds on rock mass: Floor digs it out, Ground levels it, RockWall finishes it into a wall (the sim tells them apart by the tile)
const BUILD_STRUCT: Record<Exclude<UiBuildKind, 'module' | 'claim' | 'mine'>, number> = { wall: Struct.Wall, floor: Struct.Floor, door: Struct.Door, dig: Struct.Floor, level: Struct.Ground, finish: Struct.RockWall };
const TOAST_MS = 2500;
/** Screen px from a crew member's feet to the middle of the body, for the selection box. */
const BODY_PX = 16;

/** Tool + selection state and the translation of input gestures into commands. */
export interface Controller {
  tool: Readable<UiToolState>;
  /** Why the module being placed is invalid at the cursor, with a screen position near it. */
  placeHint: Readable<{ x: number; y: number; text: string } | null>;
  selectedCrew: Readable<number | null>;
  /** The selected crew (a click, a box or shift-adds); orders go to the drafted ones among them. */
  selectedGroup: Readable<number[]>;
  /** One of the player's shuttles picked by clicking it in the world, or null. */
  selectedShuttle: Readable<number | null>;
  /** The selection box being dragged, in canvas px, or null. */
  selectBox: Readable<Rect | null>;
  /** The menu of order choices open at the cursor, or null. */
  contextMenu: Readable<{ x: number; y: number; items: OrderChoice[] } | null>;
  /** Run a choice of the open menu (null closes it). */
  pickContext(id: OrderId | null): void;
  selectedModule: Readable<number | null>;
  /** Another ship or station picked from the node strip (a ShipC or trader entity id), or null. */
  selectedShip: Readable<number | null>;
  /** Select another ship or station and frame a ship in the camera (null clears). A station has no ship, so the camera stays. */
  selectShip(ship: number | null): void;
  /** Asteroid picked by clicking its rock or from the node strip, or null. */
  selectedAsteroid: Readable<number | null>;
  selectAsteroid(id: number | null): void;
  alerts: Alerts;
  log: EventLog;
  toast: Readable<string | null>;
  setTool(state: Partial<UiToolState>): void;
  selectCrew(id: number | null, focus?: boolean): void;
  /** Center the camera on a crew member wherever they are. */
  focusCrew(id: number): void;
  /** Order the selected drafted crew to attack a hostile crew member. */
  attack(target: number): void;
  selectModule(id: number | null): void;
  /** A module under construction (its job id), or null. */
  selectedSite: Readable<number | null>;
  selectSite(id: number | null): void;
  focusAlert(id: number): void;
  onEvents(events: SimEvent[]): void;
  /** Wire up the renderer once the canvas exists; returns handlers for attachInput. */
  attach(renderer: Renderer): InputHandlers;
}

export function createController(sim: Sim, bridge: Bridge): Controller {
  const tool = createStore<UiToolState>({ tool: 'select', build: 'module', moduleDef: null, rot: 0 });
  const placeHint = createStore<{ x: number; y: number; text: string } | null>(null);
  const modSel = createStore<number | null>(null);
  const siteSel = createStore<number | null>(null);
  const shipSel = createStore<number | null>(null);
  const astSel = createStore<number | null>(null);
  /** The player's ship (home grid 1) as a ShipC entity id. */
  const homeShipId = () => homeShip(sim);
  const alerts = createAlerts(sim);
  const log = createEventLog(sim);
  alerts.onRaised(log.defer);
  alerts.onCleared((a, _tick, replaced) => log.release(a.id, replaced));
  let modPos: Tile | null = null;
  /** The renderer is drawing a placement ghost (so it must be cleared when the mode ends). */
  let ghostOn = false;
  const crewSel = createStore<number | null>(null);
  const group = createStore<number[]>([]);
  const shuttleSel = createStore<number | null>(null);
  const boxSel = createStore<Rect | null>(null);
  const menu = createStore<{ x: number; y: number; items: OrderChoice[] } | null>(null);
  let plan: OrderPlan | null = null;
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

  /** Hand the renderer the stuck sites (amber) and the selected one. */
  const pushSites = () => r?.setSites(new Set(bridge.sites.get().filter((s) => s.state === 'blocked').map((s) => s.id)), siteSel.get());
  /** Hand the renderer the rings: the selected group, and the crew member being inspected. */
  const pushRings = () => {
    const c = crewSel.get();
    r?.setSelectedCrew(c === null || group.get().includes(c) ? group.get() : [...group.get(), c]);
  };
  const clearCrew = () => {
    crewSel.set(null);
    group.set([]);
    shuttleSel.set(null);
    menu.set(null);
    plan = null;
    bridge.watchCrew(null);
    pushRings();
  };
  const selectTile = (t: Tile | null, ship = homeShipId()) => {
    shipSel.set(null);
    astSel.set(null);
    clearCrew();
    modSel.set(null);
    siteSel.set(null);
    pushSites();
    r?.setSelection(t, ship);
    bridge.setSelected(t ? { ship, ...t } : null);
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
  /** Select crew: own crew join the group (alone, or as the whole box), an enemy is only inspected and the group keeps its place. */
  const selectCrews = (ids: readonly number[], focus = false) => {
    const first = ids[0];
    if (first === undefined) return selectTile(null);
    modSel.set(null);
    shipSel.set(null);
    astSel.set(null);
    siteSel.set(null);
    shuttleSel.set(null);
    menu.set(null);
    pushSites();
    if (isPlayerCrew(first)) group.set([...ids]);
    crewSel.set(ids.length === 1 ? first : null);
    r?.setSelection(null);
    bridge.setSelected(null);
    bridge.watchCrew(ids.length === 1 ? first : null);
    pushRings();
    if (focus) focusCrew(first);
  };
  const selectCrew = (id: number | null, focus = false) => (id === null ? selectTile(null) : selectCrews([id], focus));
  const attack = (target: number) => {
    const ids = draftedOf(sim, group.get());
    if (!ids.length) return showToast('Select drafted crew first');
    for (const id of ids) sim.enqueue({ type: 'crew.attack', id, target });
  };

  const selectModule = (id: number | null) => {
    const m = id === null ? undefined : sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (id === null || !m || !def) return selectTile(null);
    clearCrew();
    shipSel.set(null);
    astSel.set(null);
    siteSel.set(null);
    pushSites();
    bridge.setSelected(null);
    modSel.set(id);
    r?.setSelection(footprintTiles(def, m.x, m.y, m.rot));
  };

  const selectSite = (id: number | null) => {
    const s = id === null ? undefined : bridge.sites.get().find((x) => x.id === id);
    if (id === null || !s) return selectTile(null);
    clearCrew();
    shipSel.set(null);
    astSel.set(null);
    modSel.set(null);
    bridge.setSelected(null);
    siteSel.set(id);
    pushSites();
    r?.setSelection(null); // the site draws its own outline, on the floor under everything
  };
  const isMineTool = () => {
    const t = tool.get();
    return t.tool === 'build' && t.build === 'mine';
  };
  /** The asteroid whose ore sits on this sector tile, or 0. */
  const oreAsteroid = (x: number, y: number): number => {
    const a = asteroidAt(sim, x, y);
    return a && isOreTile(sim, a, x, y) ? a : 0;
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
    // The player region under the cursor (a claimed base), else the home ship (whose error then says why it does not fit).
    const ship = mineAt(at.x, at.y) || homeShipId();
    return { tiles: footprintTiles(def, at.x, at.y, t.rot), at, ship, def: t.moduleDef, error: isBlueprintKnown(sim, t.moduleDef) ? placementError(sim, ship, t.moduleDef, at.x, at.y, t.rot) : 'unknownBlueprint' };
  };

  /** Tiles covered by the current drag: a line for wall/door, a rectangle otherwise. */
  const shape = (): Tile[] => {
    if (!paintStart || !paintEnd) return [];
    const { x: sx, y: sy } = paintStart;
    let { x: ex, y: ey } = paintEnd;
    const t = tool.get();
    if (t.tool === 'build' && t.build !== 'floor' && t.build !== 'dig' && t.build !== 'level' && t.build !== 'finish' && t.build !== 'claim' && t.build !== 'mine') {
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
      ghostOn = true;
      r?.setModuleGhost(plan ? { def: plan.def, x: plan.at.x, y: plan.at.y, rot: tool.get().rot, valid: plan.error === null } : null);
      const at = plan?.error && r ? r.screenOf(plan.ship, plan.at.x, plan.at.y) : null;
      placeHint.set(plan?.error && at ? { x: at.x, y: at.y, text: rejectionMessage(plan.error) } : null);
      return;
    }
    placeHint.set(null);
    if (ghostOn) r?.setModuleGhost(null);
    ghostOn = false;
    if (isMineTool()) {
      // Only the ore tiles show: those are what the pods will cut.
      const covered = paintStart ? shape() : hover ? [hover] : [];
      // Drawn on the top of the rock block (the rock is ROCK_MASS_Z tall); ground ore stays flat.
      return r?.setPreview(covered.filter((p) => oreAsteroid(p.x, p.y)).map((p) => ({ ...p, ...(isSolidRock(sim.sector.grid.get('struct', p.x, p.y)) ? { lift: ROCK_MASS_Z } : {}) })), true);
    }
    r?.setPreview(paintStart ? shape() : active && hover ? [hover] : []);
  };
  const setTool = (state: Partial<UiToolState>) => {
    // A module whose blueprint is not known cannot be picked for placement (the catalog shows it locked).
    const s = state.moduleDef && !isBlueprintKnown(sim, state.moduleDef) ? { ...state, moduleDef: tool.get().moduleDef } : state;
    tool.update((cur) => ({ ...cur, ...s }));
    if (s.tool === 'select') modPos = null;
    paintStart = paintEnd = null;
    refreshPreview();
  };
  /** The player's region (home ship or a claimed base) whose rectangle holds the tile, or 0. */
  const mineAt = (x: number, y: number): number => {
    const id = shipIdAt(sim, x, y);
    return id && sim.world.get(id, ShipC)?.faction === 'player' && inShip(sim, id, x, y) ? id : 0;
  };
  const commit = () => {
    const { tool: t, build } = tool.get();
    if (t === 'build' && build === 'module') return;
    if (t === 'build' && build === 'mine') {
      const ore = shape().filter((p) => oreAsteroid(p.x, p.y));
      const asteroid = ore[0] ? oreAsteroid(ore[0].x, ore[0].y) : 0;
      const tiles = ore.filter((p) => oreAsteroid(p.x, p.y) === asteroid);
      const chosen = tool.get().pods ?? [];
      const pods = (chosen.length ? chosen : [...sim.world.query(VehicleC)]).filter((id) => {
        const v = sim.world.get(id, VehicleC);
        return !!v && !!sim.content.vehicles?.[v.def]?.mining && shipById(sim, v.homeShip)?.faction === 'player';
      });
      if (!asteroid) showToast('No ore in that rectangle');
      else if (!pods.length) showToast('No mining pod to send');
      else for (const pod of pods) sim.enqueue({ type: 'mining.order', pod, asteroid, tiles });
      paintStart = paintEnd = null;
      return refreshPreview();
    }
    if (t === 'build' && build === 'claim') {
      const tiles = shape();
      const at = tiles.find((p) => asteroidAt(sim, p.x, p.y));
      const asteroid = at ? asteroidAt(sim, at.x, at.y) : 0;
      if (!asteroid || !paintStart || !paintEnd) showToast('Drag over an asteroid');
      else {
        const x = Math.min(paintStart.x, paintEnd.x), y = Math.min(paintStart.y, paintEnd.y);
        sim.enqueue({ type: 'asteroid.claim', asteroid, x, y, w: Math.abs(paintEnd.x - paintStart.x) + 1, h: Math.abs(paintEnd.y - paintStart.y) + 1 });
      }
      paintStart = paintEnd = null;
      return refreshPreview();
    }
    for (const { x, y } of shape()) {
      const ship = mineAt(x, y);
      if (!ship) continue;
      if (t === 'build') sim.enqueue({ type: 'job.build', ship, x, y, struct: BUILD_STRUCT[build as keyof typeof BUILD_STRUCT] });
      else if (t === 'deconstruct') sim.enqueue({ type: 'job.deconstruct', ship, x, y });
      else if (t === 'cancel') sim.enqueue({ type: 'job.cancel', ship, x, y });
    }
    paintStart = paintEnd = null;
    refreshPreview();
  };
  /** R: draft the selected crew, or stand them all down when every one is already drafted. */
  const toggleDraft = () => {
    const ids = group.get().filter(isPlayerCrew);
    const all = ids.length > 0 && ids.every((id) => sim.world.has(id, DraftedC));
    for (const id of ids) sim.enqueue({ type: 'crew.draft', id, drafted: !all });
  };

  const placeModule = () => {
    const plan = modulePlan();
    if (!plan) return;
    if (plan.error) showToast(rejectionMessage(plan.error));
    else sim.enqueue({ type: 'job.buildModule', ship: plan.ship, x: plan.at.x, y: plan.at.y, def: plan.def, rot: tool.get().rot });
  };
  const rotate = (back = false) => setTool({ rot: (tool.get().rot + (back ? 3 : 1)) % 4 });
  /**
   * Right-click / Escape in build mode: first drop the placement (the catalog stays open with nothing selected), then
   * leave build mode. 'module' with no def is the "nothing selected" state.
   */
  const back = () => {
    const t = tool.get();
    if (t.tool === 'build' && !(t.build === 'module' && t.moduleDef === null)) setTool({ build: 'module', moduleDef: null });
    else setTool({ tool: 'select' });
  };

  const selectShuttle = (id: number) => {
    selectTile(null);
    shuttleSel.set(id);
  };
  const selectShip = (ship: number | null, frame = true) => {
    selectTile(null);
    if (ship === null) return;
    shipSel.set(ship);
    if (frame && ship > 0) r?.frameShips([ship]);
  };
  const selectAsteroid = (id: number | null) => {
    selectTile(null);
    const a = id === null ? undefined : sim.world.get(id, AsteroidC);
    if (id === null || !a) return;
    astSel.set(id);
    r?.focusSector(a.x + a.width / 2, a.y + a.height / 2);
  };

  return {
    tool,
    placeHint,
    alerts,
    log,
    selectedModule: modSel,
    selectedShip: shipSel,
    selectShip,
    selectedAsteroid: astSel,
    selectAsteroid,
    selectedCrew: crewSel,
    selectedGroup: group,
    selectedShuttle: shuttleSel,
    selectBox: boxSel,
    contextMenu: menu,
    pickContext(id) {
      const p = plan;
      menu.set(null);
      plan = null;
      if (id !== null) p?.run(id);
    },
    selectModule,
    selectedSite: siteSel,
    selectSite,
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
      alerts.syncIncoming();
      log.onEvents(events, alerts.covers);
    },
    attach(renderer) {
      r = renderer;
      bridge.sites.subscribe(() => {
        pushSites();
        const id = siteSel.get();
        if (id !== null && !bridge.sites.get().some((s) => s.id === id)) siteSel.set(null); // built or cancelled
      });
      return {
        onTap(sx, sy, shift = false) {
          if (menu.get()) {
            menu.set(null); // a click away from the menu only closes it
            plan = null;
            return;
          }
          const crewId = renderer.pickCrew(sx, sy);
          if (crewId !== null && !sim.world.has(crewId, EggSacC)) {
            // Your own crew join the selection (shift adds or removes); an enemy is only inspected, and the selection stays to order it.
            if (!isPlayerCrew(crewId)) return selectCrews([crewId]);
            const next = clickSelection(group.get(), crewId, shift);
            return next.length ? selectCrews(next) : selectTile(null);
          }
          const shuttle = renderer.pickShuttle(sx, sy);
          const sv = shuttle === null ? undefined : sim.world.get(shuttle, VehicleC);
          if (shuttle !== null && sv && shipById(sim, sv.homeShip)?.faction === 'player') return selectShuttle(shuttle);
          const tile = renderer.pickTile(sx, sy);
          const modId = moduleUnder(sim, renderer, sx, sy, tile, homeShipId());
          if (modId) return selectModule(modId);
          // a module under construction: its ghost, or any tile of its footprint
          const sites = bridge.sites.get();
          const siteHit = renderer.pickSite(sx, sy) ?? (tile ? sites.find((s) => tile.x >= s.x && tile.x < s.x + s.w && tile.y >= s.y && tile.y < s.y + s.h)?.id : undefined);
          if (siteHit !== undefined && siteHit !== null && sites.some((s) => s.id === siteHit)) return selectSite(siteHit);
          const any = renderer.pickTileAny(sx, sy);
          const ag = any && shipGrid(sim, any.shipId);
          const jammed = !!any && !!ag && ag.get('struct', any.x, any.y) === Struct.Door && ag.get('jam', any.x, any.y) !== 0;
          if (any && (jammed || (!tile && any.shipId !== homeShipId() && sim.world.get(any.shipId, ShipC)?.state === 'wreck'))) {
            // A derelict tile selects like one of your own (its panel offers Force door on jammed doors); the ship panel is on the node strip.
            selectTile({ x: any.x, y: any.y }, any.shipId);
          } else if (any && foreignShipTarget(sim, any.shipId, homeShipId()) !== null) {
            // A station or another ship: its inspector (the same panel as its node-strip button), without moving the camera.
            selectShip(any.shipId, false);
          } else if (!tile && !any && asteroidAt(sim, renderer.pickSector(sx, sy).x, renderer.pickSector(sx, sy).y)) {
            // plain asteroid rock (or a hidden base under it): the asteroid's panel
            const st = renderer.pickSector(sx, sy);
            selectAsteroid(asteroidAt(sim, st.x, st.y));
          } else selectTile(tile);
        },
        onBox(phase, a, b, shift) {
          if (phase === 'cancel') return boxSel.set(null);
          const rect = normRect(a, b);
          if (phase !== 'end') return boxSel.set(rect);
          boxSel.set(null);
          // Your drafted crew whose feet or body fall in the box (aboard shuttles they have no position, so they are out).
          const pts: { id: number; x: number; y: number }[] = [];
          for (const id of draftedOf(sim, [...sim.world.query(DraftedC)])) {
            const p = sim.world.get(id, PositionC);
            if (!p) continue;
            const at = renderer.screenOf(0, p.x + (p.toX - p.x) * p.progress, p.y + (p.toY - p.y) * p.progress);
            pts.push({ id, x: at.x, y: at.y }, { id, x: at.x, y: at.y - BODY_PX });
          }
          const next = boxSelection(group.get(), [...new Set(idsInRect(rect, pts))], shift);
          if (next.length) selectCrews(next);
          else if (!shift) selectTile(null);
        },
        onContext(sx, sy) {
          if (menu.get()) {
            menu.set(null);
            plan = null;
          }
          if (tool.get().tool !== 'select') return back();
          const ids = group.get();
          if (!ids.length) return;
          if (!draftedOf(sim, ids).length) return showToast(rejectionMessage('notDrafted'));
          const p = planOrders(sim, renderer, sx, sy, ids);
          const only = p.choices[0];
          if (!only) return showToast('Nothing to order there for the selected crew');
          if (!needsMenu(p.choices)) return p.run(only.id);
          plan = p;
          menu.set({ x: sx, y: sy, items: p.choices });
        },
        onHover(t) {
          hover = t;
          if (!paintStart) modPos = null;
          bridge.setHovered(t && inShip(sim, homeShipId(), t.x, t.y) ? { ship: homeShipId(), ...t } : null);
          refreshPreview();
        },
        paintMode: () => tool.get().tool !== 'select',
        pickLift: () => (isMineTool() ? ROCK_MASS_Z : 0),
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
        onKey(key, shift) {
          if (menu.get()) {
            menu.set(null);
            plan = null;
          } else if (key === 'r') {
            if (moduleMode()) rotate(shift);
            else toggleDraft();
          }
          else if (tool.get().tool !== 'select') back();
          else selectTile(null);
        },
      };
    },
  };
}
