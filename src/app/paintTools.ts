import { asteroidAt, inShip, shipIdAt } from '../sim/regions';
import { ShipC, Struct, VehicleC, footprintTiles, isBlueprintKnown, isOreTile, isSolidRock, placementError, type Sim } from '../sim';
import { shipById } from '../sim/combat/ships';
import type { Renderer } from '../render/scene';
import { ROCK_MASS_Z } from '../render/asteroidView';
import type { UiBuildKind, UiToolState } from '../ui/api';
import type { Bridge } from './bridge';
import type { InputHandlers, Tile } from './input';
import { rejectionMessage } from './messages';
import type { Writable } from './store';
import { createYardTool } from './yardTool';

// dig, level and finish are builds on rock mass: Floor digs it out, Ground levels it, RockWall finishes it into a wall (the sim tells them apart by the tile)
const BUILD_STRUCT: Record<Exclude<UiBuildKind, 'module' | 'claim' | 'mine'>, number> = { wall: Struct.Wall, floor: Struct.Floor, door: Struct.Door, dig: Struct.Floor, level: Struct.Ground, finish: Struct.RockWall };

export interface PaintDeps {
  tool: Writable<UiToolState>;
  placeHint: Writable<{ x: number; y: number; text: string } | null>;
  renderer(): Renderer | undefined;
  showToast(msg: string): void;
  homeShipId(): number;
}

/** The build, deconstruct, cancel, mine and module-placement tools: previews while hovering and dragging, and the commands they send on release. */
export function createPaintTools(sim: Sim, bridge: Bridge, deps: PaintDeps): Pick<InputHandlers, 'onHover' | 'paintMode' | 'pickLift' | 'onPaint'> & {
  setTool(state: Partial<UiToolState>): void;
  /** Forget the painted shipyard hull. */
  clearYard(): void;
  moduleMode(): boolean;
  rotate(back?: boolean): void;
  /** Right-click / Escape in a tool mode: drop the placement, then leave build mode. */
  back(): void;
} {
  const { tool, placeHint, showToast, homeShipId } = deps;
  const yard = createYardTool(bridge, { tool, renderer: deps.renderer });
  let modPos: Tile | null = null;
  /** The renderer is drawing a placement ghost (so it must be cleared when the mode ends). */
  let ghostOn = false;
  let hover: Tile | null = null;
  let paintStart: Tile | null = null;
  let paintEnd: Tile | null = null;
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
    if (yard.active()) {
      deps.renderer()?.setHover(null);
      deps.renderer()?.setPreview([]);
      placeHint.set(null);
      return yard.draw();
    }
    const active = tool.get().tool !== 'select';
    deps.renderer()?.setHover(active ? null : hover);
    if (moduleMode()) {
      const plan = modulePlan();
      deps.renderer()?.setPreview(plan?.tiles ?? [], plan ? plan.error === null : true);
      ghostOn = true;
      deps.renderer()?.setModuleGhost(plan ? { def: plan.def, x: plan.at.x, y: plan.at.y, rot: tool.get().rot, valid: plan.error === null } : null);
      const rr = deps.renderer();
      const at = plan?.error && rr ? rr.screenOf(plan.ship, plan.at.x, plan.at.y) : null;
      placeHint.set(plan?.error && at ? { x: at.x, y: at.y, text: rejectionMessage(plan.error) } : null);
      return;
    }
    placeHint.set(null);
    if (ghostOn) deps.renderer()?.setModuleGhost(null);
    ghostOn = false;
    if (isMineTool()) {
      // Only the ore tiles show: those are what the pods will cut.
      const covered = paintStart ? shape() : hover ? [hover] : [];
      // Drawn on the top of the rock block (the rock is ROCK_MASS_Z tall); ground ore stays flat.
      return deps.renderer()?.setPreview(covered.filter((p) => oreAsteroid(p.x, p.y)).map((p) => ({ ...p, ...(isSolidRock(sim.sector.grid.get('struct', p.x, p.y)) ? { lift: ROCK_MASS_Z } : {}) })), true);
    }
    deps.renderer()?.setPreview(paintStart ? shape() : active && hover ? [hover] : []);
  };
  const setTool = (state: Partial<UiToolState>) => {
    // A module whose blueprint is not known cannot be picked for placement (the catalog shows it locked).
    const s = state.moduleDef && !isBlueprintKnown(sim, state.moduleDef) ? { ...state, moduleDef: tool.get().moduleDef } : state;
    tool.update((cur) => ({ ...cur, ...s }));
    yard.sync();
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

  return {
    setTool,
    clearYard: () => yard.clear(),
    moduleMode,
    rotate,
    back,
        onHover(t) {
          hover = t;
          if (!paintStart) modPos = null;
          bridge.setHovered(t && inShip(sim, homeShipId(), t.x, t.y) ? { ship: homeShipId(), ...t } : null);
          refreshPreview();
        },
        paintMode: () => tool.get().tool !== 'select',
        pickLift: () => (isMineTool() ? ROCK_MASS_Z : 0),
        onPaint(phase, t) {
          if (yard.active()) return yard.paint(phase, t);
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
  };
}
