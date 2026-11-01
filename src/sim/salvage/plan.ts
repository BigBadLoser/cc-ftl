import { createJob, DECONSTRUCT_TICKS } from '../crew/handlers';
import { CrewC, DeadC, JobC, PositionC } from '../crew/components';
import { ItemStackC } from '../items/components';
import { ModuleC } from '../modules/components';
import { postModuleDecon } from '../modules/handlers';
import { shipGrid, shipIdOf } from '../regions';
import type { ScrapType } from '../registry';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { SALVAGE_JOBS_OPEN } from '../tuning';

interface Tile { x: number; y: number; kind: number }

/** What an order for `types` would still strip from a wreck, in the order it is stripped: modules, then walls and doors (and beams), then floors. */
export interface Parts {
  modules: number[];
  walls: Tile[];
  floors: Tile[];
}

/** The parts of `ship` that yield one of `types`. Robot modules (no scrap type) never appear. Floors are only those with no module on them. */
export function partsOf(sim: Sim, ship: number, types: readonly ScrapType[]): Parts {
  const parts: Parts = { modules: [], walls: [], floors: [] };
  for (const id of [...sim.world.query(ModuleC)].sort((a, b) => a - b)) {
    const m = sim.world.get(id, ModuleC);
    const scrap = m && sim.content.modules[m.def]?.scrap;
    if (m && scrap && types.includes(scrap) && shipIdOf(sim, m) === ship) parts.modules.push(id);
  }
  const grid = shipGrid(sim, ship);
  if (!grid || !types.includes('hull')) return parts;
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
    for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      if (grid.get('ship', x, y) !== ship) continue;
      const kind = grid.get('struct', x, y);
      if (grid.get('module', x, y) !== 0 && kind !== Struct.Floor) continue; // a wall under a module that stays holds it up
      if (kind === Struct.Wall || kind === Struct.Door || kind === Struct.Beam) parts.walls.push({ x, y, kind });
      else if (kind === Struct.Floor && grid.get('module', x, y) === 0) parts.floors.push({ x, y, kind });
    }
  }
  return parts;
}

/** How many parts `parts` lists. */
export const partCount = (p: Parts): number => p.modules.length + p.walls.length + p.floors.length;

/** True if a module of the ship has no scrap type, and every module is such (robot hardware only: salvage has nothing to take, now or later). */
export function robotOnly(sim: Sim, ship: number): boolean {
  let any = false;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || shipIdOf(sim, m) !== ship) continue;
    if (sim.content.modules[m.def]?.scrap) return false;
    any = true;
  }
  return any;
}

/**
 * The floor tiles to take down next: those farthest (by steps over the remaining deck) from the crew standing on the wreck, so the crew
 * retreat inward and never cut themselves off from the rest. One distance level at a time: tiles of a level only need the nearer ones.
 */
function farthestFloors(sim: Sim, ship: number, floors: Tile[]): Tile[] {
  const grid = shipGrid(sim, ship);
  if (!grid || floors.length === 0) return floors;
  const dist = new Map<number, number>();
  const key = (x: number, y: number): number => y * 4096 + x;
  let frontier: Tile[] = [];
  for (const id of sim.world.query(CrewC, PositionC)) {
    const p = sim.world.get(id, PositionC)!;
    if (!sim.world.has(id, DeadC) && shipIdOf(sim, p) === ship && !dist.has(key(p.x, p.y))) {
      dist.set(key(p.x, p.y), 0);
      frontier.push({ x: p.x, y: p.y, kind: 0 });
    }
  }
  if (frontier.length === 0) return floors;
  for (let d = 1; frontier.length; d++) {
    const next: Tile[] = [];
    for (const t of frontier) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const x = t.x + dx, y = t.y + dy;
        if (!grid.inBounds(x, y) || dist.has(key(x, y)) || grid.get('ship', x, y) !== ship) continue;
        const kind = grid.get('struct', x, y);
        if (kind !== Struct.Floor && kind !== Struct.Door) continue;
        dist.set(key(x, y), d);
        next.push({ x, y, kind });
      }
    }
    frontier = next;
  }
  // Tiles the crew cannot reach (cut off already) are left to the end; they only wait.
  const reach = floors.filter((t) => dist.has(key(t.x, t.y)));
  if (reach.length === 0) return floors;
  const far = Math.max(...reach.map((t) => dist.get(key(t.x, t.y))!));
  return reach.filter((t) => dist.get(key(t.x, t.y)) === far);
}

function stacksAboard(sim: Sim, ship: number): boolean {
  for (const id of sim.world.query(ItemStackC)) if (shipIdOf(sim, sim.world.get(id, ItemStackC)) === ship) return true;
  return false;
}

/** The salvage jobs open on a ship (an order's deconstruct and moduleDecon jobs carry `scrap`). */
export function salvageJobs(sim: Sim, ship: number): number[] {
  return sim.world.query(JobC).filter((id) => {
    const j = sim.world.get(id, JobC);
    return !!j?.scrap && shipIdOf(sim, j) === ship;
  });
}

/**
 * Keep the order's stripping jobs topped up (at most SALVAGE_JOBS_OPEN open on the wreck). Modules go first; walls and doors once no
 * module of a ticked type is left; floors last, once no loose stack lies on the wreck (the haulers and the salvage ferry clear those)
 * farthest from the crew first. Returns how many parts the order still has to strip (0 = done).
 */
export function planJobs(sim: Sim, ship: number, types: readonly ScrapType[]): number {
  const parts = partsOf(sim, ship, types);
  const remaining = partCount(parts);
  const open = salvageJobs(sim, ship).map((id) => sim.world.get(id, JobC)!);
  let room = SALVAGE_JOBS_OPEN - open.length;
  if (room <= 0 || remaining === 0) return remaining;
  const taken = new Set(open.map((j) => (j.kind === 'moduleDecon' ? `m${j.target}` : `${j.x},${j.y}`)));
  const post = (list: Tile[], struct: (t: Tile) => number): void => {
    for (const t of list) {
      if (room <= 0) return;
      if (taken.has(`${t.x},${t.y}`)) continue;
      createJob(sim, 'deconstruct', ship, t.x, t.y, struct(t), DECONSTRUCT_TICKS, false, { scrap: 'hull' });
      room--;
    }
  };
  if (parts.modules.length) {
    for (const id of parts.modules) {
      if (room <= 0) break;
      if (taken.has(`m${id}`)) continue;
      const scrap = sim.content.modules[sim.world.get(id, ModuleC)!.def]?.scrap;
      postModuleDecon(sim, id, { scrap: scrap as ScrapType });
      room--;
    }
  } else if (parts.walls.length) {
    post(parts.walls, (t) => (t.kind === Struct.Beam ? Struct.Space : Struct.Floor));
  } else if (!stacksAboard(sim, ship)) {
    post(farthestFloors(sim, ship, parts.floors), () => Struct.Space);
  }
  return remaining;
}
