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
import { inRowOrder, pickSection, rowRanks, type Rim } from './rows';
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

/**
 * The ship's planned outer hull still to be built (planned tiles that were built into hull, or taken by something else, drop out), reading order. A tile
 * is still planned while it is open space or the ship's own open truss (`Struct.Beam`, laid by a yard's planning pass).
 */
export function plannedTiles(sim: Sim, ship: number): Tile[] {
  const plan = sim.world.get(ship, HullPlanC);
  const grid = sim.sector.grid;
  const seen = new Set<string>();
  const open = (t: Tile): boolean => {
    const k = grid.get('struct', t.x, t.y);
    return (k === Struct.Space && grid.get('ship', t.x, t.y) === 0) || (k === Struct.Beam && grid.get('ship', t.x, t.y) === ship);
  };
  return (plan?.tiles ?? []).filter((t) => open(t) && !seen.has(key(t.x, t.y)) && !!seen.add(key(t.x, t.y)))
    .map((t) => ({ x: t.x, y: t.y })).sort(byRow);
}

/** The planned tiles that can be built from the ship (a chain of neighbours from its hull, in the order a crew would work out), the floating ones, and the ones in the way. */
function reach(sim: Sim, ship: number, tiles: readonly Tile[]): { connected: Tile[]; loose: Tile[]; blocked: Tile[] } {
  const clear = dockApproaches(sim, ship);
  const grid = sim.sector.grid;
  const set = new Map(tiles.map((t) => [key(t.x, t.y), t] as const));
  const blocked = tiles.filter((t) => clear.has(key(t.x, t.y)));
  const isHull = (x: number, y: number): boolean => grid.get('struct', x, y) !== Struct.Space && shipAt(sim, x, y) === ship && !set.has(key(x, y)); // planned trusses are plan tiles, not the ship they are built from
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
  // An open truss shuts nothing in; other structure, hull being built and other ships' tiles do.
  const shut = (x: number, y: number): boolean => {
    const k = grid.get('struct', x, y);
    return wall.has(key(x, y)) || (k !== Struct.Space && k !== Struct.Beam) || (k === Struct.Space && grid.get('ship', x, y) !== 0);
  };
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
    const k = grid.get('struct', x, y);
    if (k === Struct.Space) return grid.get('ship', x, y) === 0 ? 'wall' : 'no';
    if (k === Struct.Beam) return shipAt(sim, x, y) === ship ? 'wall' : 'no'; // the ship's own truss turns into wall
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
  /** Every planned tile still to be built into hull (open space or the ship's own truss). */
  tiles: Tile[];
  /** The planned tiles that already have a truss. The rest of the lists are the open-space tiles only: nothing is drawn over a truss. */
  trussed: Tile[];
  connected: Tile[];
  loose: Tile[];
  blocked: Tile[];
  floor: Tile[];
  /** Every planned tile that can be reached from the ship, trussed or not (what a yard works from). */
  reachable: Tile[];
  hull: { now: number; afterAll: number; capacity: number };
}

export function viewPlan(sim: Sim, ship = playerShip(sim)): HullView {
  const grid = ship ? shipGrid(sim, ship) : undefined;
  const load = ship ? hullLoad(sim, ship) : { tiles: 0, capacity: 0 };
  const tiles = ship ? plannedTiles(sim, ship) : [];
  const reachable = ship ? reach(sim, ship, tiles) : { connected: [], loose: [], blocked: [] };
  const isOpen = (t: Tile): boolean => sim.sector.grid.get('struct', t.x, t.y) === Struct.Space;
  const connected = reachable.connected;
  const floor = enclosedFloor(sim, connected);
  return {
    tiles, trussed: tiles.filter((t) => !isOpen(t)), reachable: connected,
    connected: connected.filter(isOpen), loose: reachable.loose.filter(isOpen), blocked: reachable.blocked.filter(isOpen), floor,
    hull: { now: grid ? hullArea(grid) : 0, afterAll: ship && connected.length ? areaWith(sim, ship, connected, floor) : load.tiles, capacity: load.capacity },
  };
}

/** Why a quote cannot be bought; the first that applies. */
export type YardError = 'noYard' | 'noShip' | 'noTiles' | 'notAdjacent' | 'crowded';

/**
 * A yard's quote for the plan. First pass: a truss on every reachable planned tile that has none (the planning fee, outside the cap). Second pass: the tiles it
 * would turn into hull on this visit (up to its cap, the rows nearest the ship first, shut off by a cross wall when the cap cuts the room short; see
 * `pickSection`) and the floor they enclose. The lists are in build order.
 */
export interface YardQuote {
  service: YardService | null;
  /** The tiles that become wall now (planned tiles, trussed by now, and any closing wall the plan does not cover), the floor they enclose, and the wall of each floor patch the crew close last (with the open tile beyond it). */
  walls: Tile[];
  floor: Tile[];
  /** The planning pass: open-space tiles the contractors truss first (every reachable planned tile without a truss, outside the cap), and its fee (credits, included in `price`). */
  trusses: Tile[];
  fee: YardMoney;
  gaps: { wall: Tile; stage: Tile }[];
  /** Tiles planned in all, and left for a later yard (over the cap, floating off the hull, or in the way). */
  planned: number;
  rest: number;
  error: YardError | null;
  /** The whole price: hull (per tile built, floor included) plus the planning fee. */
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
    service, walls: [], floor: [], trusses: [], fee: { credits: 0, metal: 0 }, gaps: [], planned: view.tiles.length, rest: view.tiles.length, error: null, price,
    afford: { credits: true, metal: true }, cap: service?.tier.cap ?? 0, hull: { before: view.hull.now, after: view.hull.now, capacity: view.hull.capacity }, rect: null,
  };
  if (!service || !def) return { ...base, error: 'noYard' };
  if (!ship || !sim.world.get(ship, ShipC)) return { ...base, error: 'noShip' };
  if (view.tiles.length === 0) return { ...base, error: 'noTiles' };
  if (view.reachable.length === 0) return { ...base, error: 'notAdjacent' };
  const own = shipRect(sim.world.get(ship, ShipC) as Ship);
  const rank = rowRanks(sim, ship, union(own, boxOf(view.reachable, 1)));
  const { walls, floor } = pickSection(view.reachable, view.floor, service.tier.cap, rank, rimOf(sim, ship), (w) => enclosedFloor(sim, w));
  const gaps = gapsFor(sim, walls, floor, dockApproaches(sim, ship));
  // The planning pass: every reachable planned tile that is still open space gets a truss, except the gap wall of each floor patch: that tile stays open
  // so the crew can walk in and out until the patch is sealed (an open truss does not let anyone through).
  const gapKeys = new Set(gaps.map((g) => key(g.wall.x, g.wall.y)));
  const trusses = inRowOrder(view.connected.filter((t) => !gapKeys.has(key(t.x, t.y))), rank);
  const after = areaWith(sim, ship, walls, floor);
  const fee = { credits: Math.ceil(trusses.length * def.trussFee), metal: 0 };
  const hull = yardPrice(sim, service, walls.length + floor.length);
  const cost = { credits: hull.credits + fee.credits, metal: hull.metal };
  const planned = new Set(view.tiles.map((t) => key(t.x, t.y)));
  const rect = union(own, boxOf([...view.reachable, ...walls, ...floor], 1));
  const out: YardQuote = {
    ...base, walls, floor, trusses, fee, gaps, rest: view.tiles.length - walls.filter((w) => planned.has(`${w.x},${w.y}`)).length, price: cost,
    afford: { credits: sim.trade.credits >= cost.credits, metal: playerItems(sim, 'item.metal') >= cost.metal },
    hull: { ...base.hull, after }, rect,
  };
  if (!growthClear(sim, ship, rect)) return { ...out, error: 'crowded' };
  return out;
}
