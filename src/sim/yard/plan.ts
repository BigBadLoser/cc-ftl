import { hullArea, interiorArea } from '../combat/hull';
import { ShipC, type Ship } from '../combat/components';
import type { Rect } from '../grid';
import { hullLoad } from '../ftl/capacity';
import { AirlockC, airlockTiles } from '../modules/airlock';
import { ModuleC } from '../modules/components';
import { asteroidParts, intersects, padded, regions, shipAt, shipGrid, shipIdOf, shipRect } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { playerItems, playerShip } from '../trade/player';
import { ASTEROID_GAP, REGION_PAD } from '../tuning';
import { yardPrice, yardService, type YardService } from './rules';
import { pickSection, rowRanks, type Rim } from './rows';
import { HullPlanC, type YardMoney } from './types';

type Tile = { x: number; y: number };

/** Tiles of open margin the grown ship keeps between its frame and any other ship's frame. */
const GROWTH_GAP = 3;
/** The most planned tiles a ship keeps (a plan is an outline: this is far more than any yard builds). */
export const MAX_PLAN = 600;

const key = (x: number, y: number): string => `${x},${y}`;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
const byRow = (a: Tile, b: Tile): number => a.y - b.y || a.x - b.x;

/** The open tiles in front of the ship's docking airlocks (a block around each collar): nothing is built where a shuttle docks. */
function dockApproaches(sim: Sim, ship: number): Set<string> {
  const out = new Set<string>();
  for (const id of sim.world.query(AirlockC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || shipIdOf(sim, m) !== ship) continue;
    const collar = airlockTiles(def, m).collar;
    if (collar) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) out.add(key(collar.x + dx, collar.y + dy));
  }
  return out;
}

function boxOf(tiles: readonly Tile[], by: number): Rect {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of tiles) {
    x0 = Math.min(x0, t.x); y0 = Math.min(y0, t.y); x1 = Math.max(x1, t.x); y1 = Math.max(y1, t.y);
  }
  return { x: x0 - by, y: y0 - by, w: x1 - x0 + 1 + 2 * by, h: y1 - y0 + 1 + 2 * by };
}

function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** The ship's planned outer hull that is still open space (planned tiles that were built, or taken by something else, drop out), reading order. */
export function plannedTiles(sim: Sim, ship: number): Tile[] {
  const plan = sim.world.get(ship, HullPlanC);
  const grid = sim.sector.grid;
  const seen = new Set<string>();
  return (plan?.tiles ?? []).filter((t) => grid.get('struct', t.x, t.y) === Struct.Space && grid.get('ship', t.x, t.y) === 0 && !seen.has(key(t.x, t.y)) && !!seen.add(key(t.x, t.y)))
    .map((t) => ({ x: t.x, y: t.y })).sort(byRow);
}

/** The planned tiles that can be built from the ship (a chain of neighbours from its hull, in the order a crew would work out), the floating ones, and the ones in the way. */
function reach(sim: Sim, ship: number, tiles: readonly Tile[]): { connected: Tile[]; loose: Tile[]; blocked: Tile[] } {
  const clear = dockApproaches(sim, ship);
  const grid = sim.sector.grid;
  const set = new Map(tiles.map((t) => [key(t.x, t.y), t] as const));
  const blocked = tiles.filter((t) => clear.has(key(t.x, t.y)));
  const isHull = (x: number, y: number): boolean => grid.get('struct', x, y) !== Struct.Space && shipAt(sim, x, y) === ship;
  const seen = new Set<string>();
  const queue: Tile[] = [];
  for (const t of tiles) {
    if (!clear.has(key(t.x, t.y)) && N8.some(([dx, dy]) => isHull(t.x + dx, t.y + dy))) {
      seen.add(key(t.x, t.y));
      queue.push(t);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i] as Tile;
    for (const [dx, dy] of N8) {
      const k = key(c.x + dx, c.y + dy);
      const n = set.get(k);
      if (n && !seen.has(k) && !clear.has(k)) {
        seen.add(k);
        queue.push(n);
      }
    }
  }
  return { connected: queue, loose: tiles.filter((t) => !seen.has(key(t.x, t.y)) && !clear.has(key(t.x, t.y))), blocked };
}

/** Space tiles the hull tiles (with the ship's own structure) shut in: the floor the yard lays. */
function enclosedFloor(sim: Sim, hull: readonly Tile[]): Tile[] {
  if (hull.length === 0) return [];
  const grid = sim.sector.grid;
  const wall = new Set(hull.map((t) => key(t.x, t.y)));
  const box = boxOf(hull, 1);
  const shut = (x: number, y: number): boolean => wall.has(key(x, y)) || grid.get('struct', x, y) !== Struct.Space || grid.get('ship', x, y) !== 0;
  const outside = new Set<string>();
  const stack: Tile[] = [];
  const push = (x: number, y: number): void => {
    if (x < box.x || y < box.y || x >= box.x + box.w || y >= box.y + box.h || outside.has(key(x, y)) || shut(x, y)) return;
    outside.add(key(x, y));
    stack.push({ x, y });
  };
  for (let x = box.x; x < box.x + box.w; x++) {
    push(x, box.y);
    push(x, box.y + box.h - 1);
  }
  for (let y = box.y; y < box.y + box.h; y++) {
    push(box.x, y);
    push(box.x + box.w - 1, y);
  }
  while (stack.length) {
    const c = stack.pop() as Tile;
    for (const [dx, dy] of N4) push(c.x + dx, c.y + dy);
  }
  const out: Tile[] = [];
  for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) if (!shut(x, y) && !outside.has(key(x, y))) out.push({ x, y });
  return out;
}

/** What a rim tile of a closed section is for this ship (see `Rim`). */
function rimOf(sim: Sim, ship: number): (x: number, y: number) => Rim {
  const grid = sim.sector.grid;
  const clear = dockApproaches(sim, ship);
  return (x, y) => {
    if (clear.has(key(x, y))) return 'no';
    if (grid.get('struct', x, y) === Struct.Space) return grid.get('ship', x, y) === 0 ? 'wall' : 'no';
    return shipAt(sim, x, y) === ship ? 'ship' : 'no';
  };
}

/** The ship's size (interior area) once these hull tiles and this floor are built. */
function areaWith(sim: Sim, ship: number, hull: readonly Tile[], floor: readonly Tile[]): number {
  const grid = sim.sector.grid;
  const overlay = new Map<string, number>();
  for (const t of hull) overlay.set(key(t.x, t.y), Struct.Wall);
  for (const t of floor) overlay.set(key(t.x, t.y), Struct.Floor);
  const own = shipRect(sim.world.get(ship, ShipC) as Ship);
  const box = hull.length || floor.length ? union(own, boxOf([...hull, ...floor], 1)) : own;
  return interiorArea((x, y) => overlay.get(key(x, y)) ?? (shipAt(sim, x, y) === ship ? grid.get('struct', x, y) : Struct.Space), box);
}

/** The plan as the build tools show it: what is planned, what can be built from the ship now, the floor it would enclose, and the hull count. */
export interface HullView {
  tiles: Tile[];
  connected: Tile[];
  loose: Tile[];
  blocked: Tile[];
  floor: Tile[];
  hull: { now: number; afterAll: number; capacity: number };
}

export function viewPlan(sim: Sim, ship = playerShip(sim)): HullView {
  const grid = ship ? shipGrid(sim, ship) : undefined;
  const load = ship ? hullLoad(sim, ship) : { tiles: 0, capacity: 0 };
  const tiles = ship ? plannedTiles(sim, ship) : [];
  const { connected, loose, blocked } = ship ? reach(sim, ship, tiles) : { connected: [], loose: [], blocked: [] };
  const floor = enclosedFloor(sim, connected);
  return {
    tiles, connected, loose, blocked, floor,
    hull: { now: grid ? hullArea(grid) : 0, afterAll: ship && connected.length ? areaWith(sim, ship, connected, floor) : load.tiles, capacity: load.capacity },
  };
}

/** Why a quote cannot be bought; the first that applies. */
export type YardError = 'noYard' | 'noShip' | 'noTiles' | 'notAdjacent' | 'crowded';

/**
 * A yard's quote for the plan: the hull tiles it would build on this visit (up to its cap, the rows nearest the ship first, shut off by a cross wall when
 * the cap cuts the room short; see `pickSection`) and the floor they enclose. Both lists are in build order.
 */
export interface YardQuote {
  service: YardService | null;
  /** Hull tiles bought now, the floor they enclose, and the wall of each floor patch the crew close last (with the open tile beyond it). */
  walls: Tile[];
  floor: Tile[];
  gaps: { wall: Tile; stage: Tile }[];
  /** Tiles planned in all, and left for a later yard (over the cap, floating off the hull, or in the way). */
  planned: number;
  rest: number;
  error: YardError | null;
  price: YardMoney;
  afford: { credits: boolean; metal: boolean };
  /** The tiles one visit builds. */
  cap: number;
  /** The ship's size (interior area) now and after this purchase, against the engines' capacity and the overall ship maximum. */
  hull: { before: number; after: number; capacity: number };
  /** The ship's rectangle once it has grown to hold the build. */
  rect: Rect | null;
}

/** Whether a grown rectangle keeps clear of every other ship's frame and of the rock bodies. */
function growthClear(sim: Sim, ship: number, rect: Rect): boolean {
  const reachBox = padded(rect, REGION_PAD + GROWTH_GAP);
  for (const r of regions(sim)) if (r.ship !== ship && intersects(reachBox, r.frame)) return false;
  const rockReach = padded(rect, REGION_PAD + ASTEROID_GAP);
  return !asteroidParts(sim).some((p) => intersects(rockReach, p));
}

/** The gap of each floor patch: a bought hull tile with the patch on one side and open space on the other, the first in reading order. */
function gapsFor(sim: Sim, walls: readonly Tile[], floor: readonly Tile[], clear: ReadonlySet<string>): { wall: Tile; stage: Tile }[] {
  const grid = sim.sector.grid;
  const inFloor = new Set(floor.map((t) => key(t.x, t.y)));
  const inWalls = new Set(walls.map((t) => key(t.x, t.y)));
  const patchOf = new Map<string, number>();
  let patches = 0;
  for (const t of floor) {
    if (patchOf.has(key(t.x, t.y))) continue;
    const stack = [t];
    patchOf.set(key(t.x, t.y), patches);
    while (stack.length) {
      const c = stack.pop() as Tile;
      for (const [dx, dy] of N4) {
        const k = key(c.x + dx, c.y + dy);
        if (inFloor.has(k) && !patchOf.has(k)) {
          patchOf.set(k, patches);
          stack.push({ x: c.x + dx, y: c.y + dy });
        }
      }
    }
    patches++;
  }
  const out: { wall: Tile; stage: Tile }[] = [];
  for (let patch = 0; patch < patches; patch++) {
    for (const w of walls) {
      const side = N4.find(([dx, dy]) => patchOf.get(key(w.x + dx, w.y + dy)) === patch);
      const stage = side && { x: w.x - side[0], y: w.y - side[1] };
      if (stage && grid.get('struct', stage.x, stage.y) === Struct.Space && !inFloor.has(key(stage.x, stage.y)) && !inWalls.has(key(stage.x, stage.y)) && !clear.has(key(stage.x, stage.y))) {
        out.push({ wall: w, stage });
        break;
      }
    }
  }
  return out;
}

/**
 * What a yard would build of the ship's plan now, and for how much. The plan is the outer hull only: the yard buys up to its cap of the planned tiles that
 * can be reached from the ship (nearest first), lays the floor those tiles shut in, and prices by hull tile. The rest of the plan stays for the next yard.
 */
export function quoteYard(sim: Sim, station: number, ship = playerShip(sim)): YardQuote {
  const service = yardService(sim, station);
  const def = sim.content.yard;
  const view = viewPlan(sim, ship);
  const price = service ? yardPrice(sim, service, 0) : { credits: 0, metal: 0 };
  const base: YardQuote = {
    service, walls: [], floor: [], gaps: [], planned: view.tiles.length, rest: view.tiles.length, error: null, price,
    afford: { credits: true, metal: true }, cap: service?.tier.cap ?? 0, hull: { before: view.hull.now, after: view.hull.now, capacity: view.hull.capacity }, rect: null,
  };
  if (!service || !def) return { ...base, error: 'noYard' };
  if (!ship || !sim.world.get(ship, ShipC)) return { ...base, error: 'noShip' };
  if (view.tiles.length === 0) return { ...base, error: 'noTiles' };
  if (view.connected.length === 0) return { ...base, error: 'notAdjacent' };
  const own = shipRect(sim.world.get(ship, ShipC) as Ship);
  const rank = rowRanks(sim, ship, union(own, boxOf(view.connected, 1)));
  const { walls, floor } = pickSection(view.connected, view.floor, service.tier.cap, rank, rimOf(sim, ship), (w) => enclosedFloor(sim, w));
  const after = areaWith(sim, ship, walls, floor);
  const cost = yardPrice(sim, service, walls.length + floor.length);
  const planned = new Set(view.tiles.map((t) => key(t.x, t.y)));
  const rect = union(own, boxOf([...walls, ...floor], 1));
  const out: YardQuote = {
    ...base, walls, floor, gaps: gapsFor(sim, walls, floor, dockApproaches(sim, ship)), rest: view.tiles.length - walls.filter((w) => planned.has(`${w.x},${w.y}`)).length, price: cost,
    afford: { credits: sim.trade.credits >= cost.credits, metal: playerItems(sim, 'item.metal') >= cost.metal },
    hull: { ...base.hull, after }, rect,
  };
  if (!growthClear(sim, ship, rect)) return { ...out, error: 'crowded' };
  return out;
}
