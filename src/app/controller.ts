import { asteroidAt, shipIdOf, shipGrid } from '../sim/regions';
import { AsteroidC } from '../sim/asteroids/components';
import { AboardC, AllegianceC, BodyC, DraftedC, ModuleC, PositionC, ShipC, Struct, VehicleC, footprintTiles, type Sim, type SimEvent } from '../sim';
import type { Renderer } from '../render/scene';
import type { UiFightReport, UiSubject, UiToolState } from '../ui/api';
import type { Bridge } from './bridge';
import type { InputHandlers, Tile } from './input';
import { createPaintTools } from './paintTools';
import { createAlerts, type Alerts } from './alerts';
import { createFightReporter } from './fightReport';
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
import { createAiming, type Aiming } from './aiming';

const TOAST_MS = 2500;
/** Screen px from a crew member's feet to the middle of the body, for the selection box. */
const BODY_PX = 16;

/** Tool + selection state and the translation of input gestures into commands. */
export interface Controller {
  tool: Readable<UiToolState>;
  /** Why the module being placed is invalid at the cursor, with a screen position near it. */
  placeHint: Readable<{ x: number; y: number; text: string; ok?: boolean } | null>;
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
  /** "Target in view": the armed aim and how to arm it. */
  aiming: Aiming;
  alerts: Alerts;
  /** The post-fight breakdown card: `open` holds its data while it is showing. */
  fightReport: { open: Readable<UiFightReport | null>; show(alertId?: number): void; close(): void };
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
  focusSubject(subject: UiSubject): void;
  /** Per-frame upkeep: alerts whose condition resolved clear themselves, and credits that arrived without an event get logged. */
  upkeep(): void;
  onEvents(events: SimEvent[]): void;
  /** Wire up the renderer once the canvas exists; returns handlers for attachInput. */
  attach(renderer: Renderer): InputHandlers;
}

export function createController(sim: Sim, bridge: Bridge): Controller {
  const tool = createStore<UiToolState>({ tool: 'select', build: 'module', moduleDef: null, rot: 0 });
  const placeHint = createStore<{ x: number; y: number; text: string; ok?: boolean } | null>(null);
  const modSel = createStore<number | null>(null);
  const siteSel = createStore<number | null>(null);
  const shipSel = createStore<number | null>(null);
  const astSel = createStore<number | null>(null);
  /** The player's ship (home grid 1) as a ShipC entity id. */
  const homeShipId = () => homeShip(sim);
  const alerts = createAlerts(sim);
  const log = createEventLog(sim);
  const reporter = createFightReporter(sim);
  let lastReport: UiFightReport | null = null;
  const reportOpen = createStore<UiFightReport | null>(null);
  const crewSel = createStore<number | null>(null);
  const group = createStore<number[]>([]);
  const shuttleSel = createStore<number | null>(null);
  const boxSel = createStore<Rect | null>(null);
  const menu = createStore<{ x: number; y: number; items: OrderChoice[] } | null>(null);
  let plan: OrderPlan | null = null;
  const toast = createStore<string | null>(null);
  let r: Renderer | undefined;
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
  const paint = createPaintTools(sim, bridge, { tool, placeHint, renderer: () => r, showToast, homeShipId });
  const { setTool } = paint;
  /** "Target in view" (a weapon armed from the main view): its left-click aim, cancelled by right-click or Esc before anything else. */
  let wasFighting = sim.sector.inCombat;
  const aiming = createAiming(sim, () => homeShip(sim), () => r?.setAimHover(null));
  const back = () => {
    if (aiming.aiming.get()) return aiming.set(null);
    paint.back();
  };
  /** R: draft the selected crew, or stand them all down when every one is already drafted. */
  const toggleDraft = () => {
    const ids = group.get().filter(isPlayerCrew);
    const all = ids.length > 0 && ids.every((id) => sim.world.has(id, DraftedC));
    for (const id of ids) sim.enqueue({ type: 'crew.draft', id, drafted: !all });
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
  /** Jump to what a log entry or alert is about. A node is for the UI to open on the starmap. */
  const focusSubject = (s: UiSubject) => {
    if (s.kind === 'tile') r?.focusTile(s.x, s.y);
    else if (s.kind === 'crew') selectCrew(s.id, true);
    else if (s.kind === 'ship') selectShip(s.id);
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
    fightReport: {
      open: reportOpen,
      show(alertId) {
        if (alertId !== undefined) alerts.dismiss(alertId);
        else alerts.clear('fr');
        reportOpen.set(lastReport);
      },
      close() {
        alerts.clear('fr');
        reportOpen.set(null);
      },
    },
    log,
    selectedModule: modSel,
    selectedShip: shipSel,
    selectShip,
    selectedAsteroid: astSel,
    selectAsteroid,
    aiming,
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
      const s = alerts.get(id)?.subject;
      if (s) focusSubject(s);
    },
    focusSubject,
    upkeep() {
      // A fight starting drops any build / deconstruct tool (its UI is hidden), so canvas clicks reach weapon targeting.
      const fighting = sim.sector.inCombat;
      if (fighting && !wasFighting && tool.get().tool !== 'select') paint.endTools();
      wasFighting = fighting;
      alerts.sync();
      log.sync();
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
      // Arriving at a node: the old node's tile, ship and crew selection means nothing there.
      if (events.some((e) => e.type === 'sector.deployed')) selectTile(null);
      if (events.some((e) => e.type === 'combat.started')) {
        // The next fight closes the last one's card and its alert.
        alerts.clear('fr');
        reportOpen.set(null);
      }
      const done = reporter.onEvents(events);
      if (done) {
        lastReport = done.report;
        alerts.post({ kind: 'fight.report', key: 'fr', text: done.summary.text, report: true });
      }
      alerts.onEvents(events);
      alerts.syncIncoming();
      log.onEvents(events);
      if (done) log.note(done.summary); // after the per-module lines, so the summary reads last
    },
    attach(renderer) {
      r = renderer;
      bridge.yard.subscribe(() => paint.drawPlan()); // the hull plan's ghost tiles follow the plan and the yard order
      bridge.sites.subscribe(() => {
        pushSites();
        const id = siteSel.get();
        if (id !== null && !bridge.sites.get().some((s) => s.id === id)) siteSel.set(null); // built or cancelled
      });
      return {
        onTap(sx, sy, shift = false) {
          if (aiming.tap(renderer, sx, sy)) return;
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
          if (aiming.aiming.get() || tool.get().tool !== 'select') return back();
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
        onHover: paint.onHover,
        onPointer: (sx, sy) => aiming.hover(renderer, sx, sy),
        paintMode: () => !sim.sector.inCombat && paint.paintMode(),
        pickLift: paint.pickLift,
        onPaint: (phase, t) => (sim.sector.inCombat ? paint.onPaint('cancel', null) : paint.onPaint(phase, t)),
        onKey(key, shift) {
          if (menu.get()) {
            menu.set(null);
            plan = null;
          } else if (key === 'r') {
            if (paint.moduleMode()) paint.rotate(shift);
            else toggleDraft();
          }
          else if (aiming.aiming.get() || tool.get().tool !== 'select') back();
          else selectTile(null);
        },
      };
    },
  };
}
