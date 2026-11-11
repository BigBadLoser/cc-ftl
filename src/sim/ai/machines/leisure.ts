import { BreakdownC } from '../../crew/breakTypes';
import { bondedPeers, socialCost } from '../../crew/bondSpot';
import type { ShipGrid } from '../../shipGrid';
import { CrewC, DeadC, PathC, PositionC, type Crew, type Path, type Position } from '../../crew/components';
import { clearPath, isSettled, origin } from '../../crew/helpers';
import { hasMood, noteLeisure } from '../../crew/mood';
import { findPath, type Tile } from '../../crew/pathfind';
import { walkOpts } from '../../eva/route';
import { ModuleC } from '../../modules/components';
import { accessTile } from '../../modules/footprint';
import { isTileWalkable } from '../../modules/walk';
import { shipGrid, shipIdOf } from '../../regions';
import type { Sim } from '../../sim';
import { TICK_HZ } from '../../time';
import { BOND_SPOT_SAMPLES, LEISURE_PLAY_BONUS_TILES, LEISURE_SEC } from '../../tuning';
import { TaskC } from '../components';
import { freeSpots, leisureLean } from './leisureSpots';
import { safePathBeside, unsafeFor } from '../hazard';
import { clearJoblessTask, setJoblessTask, setState } from '../task';

/**
 * The leisure machine (docs/CREW_AI.md section 6, Phase 3): a crew member with nothing to do whose mood is low takes a break.
 * `Walk` to a spot with company (a tile in the mess, the room of the nearest working galley, else beside the nearest crew
 * member with a mood; never a tile that harms them), then `Relax` there for LEISURE_SEC; the break lifts their mood for a while (`noteLeisure`). It runs only
 * in the scheduler's idle turn, after the job scheduler found the crew member nothing, so a break never keeps anyone from work;
 * a job found later replaces it (the walk and the rest are class `any`).
 */

/** Look for a spot once a second, not every tick. */
const LOOK_EVERY = 20;
/** How many of the nearest free game stands are path-checked per look. */
const GAME_LOOKS = 4;
/** Tiles a spot is drawn from around the mess's galley. */
const MESS_RADIUS = 3;

/** The leisure drive's idle turn: true while the crew member is on a break, false to idle as usual. */
export function leisureTurn(sim: Sim, id: number, crew: Crew, pos: Position): boolean {
  const task = sim.world.get(id, TaskC);
  const path = sim.world.get(id, PathC) as Path;
  if (task?.machine === 'leisure') {
    if (path.steps.length > 0 || !isSettled(pos)) return true; // still walking
    if (task.state === 'Walk') {
      setState(sim, id, task, 'Relax');
      task.bb.deadline = sim.tick + Math.round(LEISURE_SEC * TICK_HZ);
      return true;
    }
    if (sim.tick < (task.bb.deadline ?? 0)) return true;
    noteLeisure(sim, id, !!task.bb.target);
    clearJoblessTask(sim, id);
    return false;
  }
  if (!isSettled(pos) || path.steps.length > 0 || (sim.tick + id) % LOOK_EVERY !== 0) return false;
  const pick = spot(sim, id, pos);
  if (!pick) return false;
  const steps = pick.steps;
  if (crew.activity !== 'idle') crew.activity = 'idle';
  if (steps.length === 0) clearPath(sim, id);
  else path.steps = steps;
  const end = steps[steps.length - 1] ?? origin(pos);
  setJoblessTask(sim, id, 'leisure', 'leisure', 'Walk', { tile: { x: end.x, y: end.y }, ...(pick.module ? { target: pick.module } : {}) });
  return true;
}

/** A walk to a break spot, or null when there is none to reach. `module`: the game spot it ends at (absent = the mess or a seat beside someone). */
interface Pick { steps: Tile[]; module?: number }

/**
 * Where to take a break: the quiet room for an isolation break, else the best of the mess and the free game spots (the table, the arcade) by
 * walking distance, less the lean of the crew member's trait (`leisureLean`) and a small bonus for a game; else someone to sit with.
 */
function spot(sim: Sim, id: number, pos: Position): Pick | null {
  const ship = shipIdOf(sim, pos);
  const from = origin(pos);
  const grid = shipGrid(sim, ship);
  if (!grid) return null;
  // Isolation (a mild mental break): the quietest reachable room instead of company.
  if (sim.world.get(id, BreakdownC)?.kind === 'isolation') {
    const quiet = quietSpot(sim, id, ship, grid, from);
    if (quiet) return { steps: quiet };
  }
  const mess = messSpot(sim, id, ship, grid, from);
  let best: { cost: number; pick: Pick } | null = mess ? { cost: mess.length - leisureLean(sim, id, 'social'), pick: { steps: mess } } : null;
  const near = freeSpots(sim, id, ship).sort((a, b) => dist(a.stand, from) - dist(b.stand, from)).slice(0, GAME_LOOKS);
  for (const s of near) {
    const steps = unsafeFor(sim, id, ship, s.stand.x, s.stand.y) ? null : findPath(sim, ship, from, s.stand, walkOpts(sim, id));
    const cost = steps ? steps.length - leisureLean(sim, id, s.kind) - LEISURE_PLAY_BONUS_TILES : Infinity;
    if (steps && (!best || cost < best.cost)) best = { cost, pick: { steps, module: s.module } };
  }
  if (best) return best.pick;
  const beside = besideCrew(sim, id, ship, from);
  return beside ? { steps: beside } : null;
}

const dist = (a: Tile, b: Tile): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** A walk to a tile in the mess (the room of the nearest working galley), or null with no galley to reach. */
function messSpot(sim: Sim, id: number, ship: number, grid: ShipGrid, from: Tile): Tile[] | null {
  // The mess: a tile in the room of the nearest working galley, drawn at random so a crowd spreads out.
  let mess: Tile | null = null;
  let best = Infinity;
  for (const m of sim.world.query(ModuleC)) {
    const mod = sim.world.get(m, ModuleC);
    const def = mod && sim.content.modules[mod.def];
    if (!mod || !def?.galley || !mod.enabled || !mod.powered || mod.hp <= 0 || shipIdOf(sim, mod) !== ship) continue;
    const at = accessTile(def, mod.x, mod.y, mod.rot);
    const d = at ? Math.abs(at.x - from.x) + Math.abs(at.y - from.y) : Infinity;
    if (at && d < best) [mess, best] = [at, d];
  }
  if (mess && grid.has('room')) {
    const room = grid.get('room', mess.x, mess.y);
    const draw = (): Tile => {
      const x = mess.x + sim.rng.int(-MESS_RADIUS, MESS_RADIUS), y = mess.y + sim.rng.int(-MESS_RADIUS, MESS_RADIUS);
      return grid.inBounds(x, y) && room !== 0 && grid.get('room', x, y) === room && isTileWalkable(sim, grid, x, y) ? { x, y } : mess;
    };
    let goal = draw();
    // Friends sit together and rivals keep apart: with bonds, a few more draws and the best of them by `socialCost` (none without, so the random stream is unchanged).
    const peers = bondedPeers(sim, id);
    if (peers.length > 0) {
      for (let k = 0, best = socialCost(sim, peers, ship, goal.x, goal.y); k < BOND_SPOT_SAMPLES; k++) {
        const t = draw(), cost = socialCost(sim, peers, ship, t.x, t.y);
        if (cost < best) [goal, best] = [t, cost];
      }
    }
    for (const g of goal === mess ? [mess] : [goal, mess]) {
      const steps = unsafeFor(sim, id, ship, g.x, g.y) ? null : findPath(sim, ship, from, g, walkOpts(sim, id));
      if (steps) return steps;
    }
  }
  return null;
}

/** A walk to a tile beside the nearest crew member with a mood ([] when already beside them), or null with nobody to sit with. */
function besideCrew(sim: Sim, id: number, ship: number, from: Tile): Tile[] | null {
  let best = Infinity;
  let mate: Position | null = null;
  best = Infinity;
  for (const o of sim.world.query(CrewC, PositionC)) {
    if (o === id || sim.world.has(o, DeadC) || !hasMood(sim, o)) continue;
    const p = sim.world.get(o, PositionC) as Position;
    const d = Math.max(Math.abs(p.x - from.x), Math.abs(p.y - from.y));
    if (shipIdOf(sim, p) === ship && d < best) [mate, best] = [p, d];
  }
  if (!mate) return null;
  if (best <= 1) return []; // already beside them
  return safePathBeside(sim, id, ship, from, mate.x, mate.y);
}

/** A walk to the nearest tile of the reachable room with the fewest crew (ties by distance); null when no room can be reached. */
export function quietSpot(sim: Sim, id: number, ship: number, grid: ShipGrid, from: Tile): Tile[] | null {
  if (!grid.has('room')) return null;
  const crewIn = new Map<number, number>();
  for (const o of sim.world.query(CrewC, PositionC)) {
    const p = sim.world.get(o, PositionC) as Position;
    if (o === id || sim.world.has(o, DeadC) || shipIdOf(sim, p) !== ship) continue;
    const room = grid.get('room', Math.round(p.x), Math.round(p.y));
    if (room !== 0) crewIn.set(room, (crewIn.get(room) ?? 0) + 1);
  }
  const nearest = new Map<number, { x: number; y: number; d: number }>();
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) { // sector coordinates: the ship's rectangle, not from 0
    for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      const room = grid.get('room', x, y);
      if (room === 0 || !isTileWalkable(sim, grid, x, y) || unsafeFor(sim, id, ship, x, y)) continue;
      const d = Math.abs(x - from.x) + Math.abs(y - from.y);
      const cur = nearest.get(room);
      if (!cur || d < cur.d) nearest.set(room, { x, y, d });
    }
  }
  const rooms = [...nearest.entries()].sort((a, b) => (crewIn.get(a[0]) ?? 0) - (crewIn.get(b[0]) ?? 0) || a[1].d - b[1].d || a[0] - b[0]);
  for (const [, t] of rooms.slice(0, 3)) {
    const steps = findPath(sim, ship, from, t, walkOpts(sim, id));
    if (steps) return steps;
  }
  return null;
}
