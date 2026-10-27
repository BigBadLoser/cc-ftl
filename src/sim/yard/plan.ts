import { hullTiles } from '../combat/hull';
import { ModuleC } from '../modules/components';
import { AirlockC, airlockTiles } from '../modules/airlock';
import { hullLoad } from '../ftl/capacity';
import { asteroidParts, intersects, padded, regions, shipAt, shipIdOf, shipRect } from '../regions';
import { ShipC, type Ship } from '../combat/components';
import { shipGrid } from '../regions';
import type { Rect } from '../grid';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { ASTEROID_GAP, REGION_PAD } from '../tuning';
import { playerItems, playerShip } from '../trade/player';
import { yardPrice, yardService, type YardService } from './rules';
import type { YardMoney } from './types';

type Tile = { x: number; y: number };

/** Tiles of open margin the grown ship keeps between its frame and any other ship's frame. */
const GROWTH_GAP = 3;

/** Why a plan cannot be ordered; the first that applies. */
export type YardError = 'noYard' | 'noShip' | 'noTiles' | 'yardCap' | 'blocked' | 'notAdjacent' | 'shipMax' | 'crowded';

/** A hull expansion drawn on the map, checked and priced (a pure read of the sim: nothing is paid or built). */
export interface YardPlan {
  service: YardService | null;
  /** The painted tiles that can be built (floor) and the walls that close them. */
  floor: Tile[];
  walls: Tile[];
  /** The wall of each patch the crew close last, and the open tile outside it (see `YardOrder.gaps`). */
  gaps: { wall: Tile; stage: Tile }[];
  /** Painted tiles that cannot be built, and why the plan fails. */
  bad: Tile[];
  error: YardError | null;
  price: YardMoney;
  /** Whether the player can pay it now (credits and metal in storage). */
  afford: { credits: boolean; metal: boolean };
  /** The yard's tiles per visit, the overall ship maximum, the tiles the ship covers now and would cover after. */
  cap: number;
  maxTiles: number;
  area: number;
  areaAfter: number;
  /** Hull tiles now and after the walls are built, against what the engines carry. */
  hull: { before: number; after: number; capacity: number };
  /** The ship's rectangle once it has grown to hold the build (the margin of open space included). */
  rect: Rect | null;
}

const key = (x: number, y: number): string => `${x},${y}`;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** The tiles the ship covers now: every non-space tile of its rectangle. */
export function shipArea(sim: Sim, ship: number): number {
  const grid = shipGrid(sim, ship);
  if (!grid?.has('struct')) return 0;
  const struct = grid.load('struct');
  let n = 0;
  for (let i = 0; i < struct.length; i++) if (struct[i] !== Struct.Space) n++;
  return n;
}

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

/** The bounding box of tiles, grown by `by`. */
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

/** Whether a grown rectangle keeps clear of every other ship's frame and of the rock bodies. */
function growthClear(sim: Sim, ship: number, rect: Rect): boolean {
  const reach = padded(rect, REGION_PAD + GROWTH_GAP);
  for (const r of regions(sim)) if (r.ship !== ship && intersects(reach, r.frame)) return false;
  const rockReach = padded(rect, REGION_PAD + ASTEROID_GAP);
  return !asteroidParts(sim).some((p) => intersects(rockReach, p));
}

/**
 * Check and price a hull expansion at a station. `tiles` are the painted floor tiles. Each must be open space no other ship or rock owns; every connected
 * patch must touch the ship's hull (4-neighbour); the yard closes the patch with a wall on each open tile around it (8-neighbour). The count
 * must fit the yard's tier, the ship its overall maximum, and the grown ship must keep clear of its neighbours. The result also holds what the
 * engines make of the new hull (the walls count as hull tiles; the floor does not).
 */
export function planYard(sim: Sim, station: number, tiles: readonly Tile[], ship = playerShip(sim)): YardPlan {
  const service = yardService(sim, station);
  const def = sim.content.yard;
  const grid = ship ? shipGrid(sim, ship) : undefined;
  const load = ship ? hullLoad(sim, ship) : { tiles: 0, capacity: 0 };
  const seen = new Set<string>();
  const floor = tiles.filter((t) => Number.isInteger(t.x) && Number.isInteger(t.y) && !seen.has(key(t.x, t.y)) && !!seen.add(key(t.x, t.y)))
    .map((t) => ({ x: t.x, y: t.y })).sort((a, b) => a.y - b.y || a.x - b.x);
  const price = service ? yardPrice(sim, service, floor.length) : { credits: 0, metal: 0 };
  const area = ship ? shipArea(sim, ship) : 0;
  const plan: YardPlan = {
    service, floor, walls: [], gaps: [], bad: [], error: null, price,
    afford: { credits: sim.trade.credits >= price.credits, metal: playerItems(sim, 'item.metal') >= price.metal },
    cap: service?.tier.cap ?? 0, maxTiles: def?.maxTiles ?? 0, area, areaAfter: area,
    hull: { before: load.tiles, after: load.tiles, capacity: load.capacity }, rect: null,
  };
  if (!service || !def) return { ...plan, error: 'noYard' };
  if (!ship || !grid) return { ...plan, error: 'noShip' };
  if (floor.length === 0) return { ...plan, error: 'noTiles' };

  const sector = sim.sector.grid;
  const ownRect = shipRect(sim.world.get(ship, ShipC) as Ship);
  const inPlan = new Set(floor.map((t) => key(t.x, t.y)));
  const keepClear = dockApproaches(sim, ship);
  const isHull = (x: number, y: number): boolean => sector.get('struct', x, y) !== Struct.Space && shipAt(sim, x, y) === ship;
  // Open space nobody owns.
  const bad = new Set<string>();
  for (const t of floor) if (sector.get('struct', t.x, t.y) !== Struct.Space || sector.get('ship', t.x, t.y) !== 0 || keepClear.has(key(t.x, t.y))) bad.add(key(t.x, t.y));
  // Patches (4-connected) that touch the hull.
  const patchOf = new Map<string, number>();
  const touches: boolean[] = [];
  for (const t of floor) {
    if (patchOf.has(key(t.x, t.y))) continue;
    const id = touches.length;
    touches.push(false);
    const stack = [t];
    patchOf.set(key(t.x, t.y), id);
    while (stack.length) {
      const c = stack.pop() as Tile;
      for (const [dx, dy] of N4) {
        const nx = c.x + dx, ny = c.y + dy;
        if (isHull(nx, ny)) touches[id] = true;
        if (inPlan.has(key(nx, ny)) && !patchOf.has(key(nx, ny))) {
          patchOf.set(key(nx, ny), id);
          stack.push({ x: nx, y: ny });
        }
      }
    }
  }
  const loose = floor.filter((t) => !touches[patchOf.get(key(t.x, t.y)) as number]);
  // The ring of walls: open space around the patches; anything else there that is not this ship's hull is in the way.
  const wallSet = new Map<string, Tile>();
  for (const t of floor) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = t.x + dx, y = t.y + dy;
        if ((!dx && !dy) || inPlan.has(key(x, y)) || wallSet.has(key(x, y))) continue;
        if (keepClear.has(key(x, y))) bad.add(key(t.x, t.y));
        else if (sector.get('struct', x, y) === Struct.Space && sector.get('ship', x, y) === 0) wallSet.set(key(x, y), { x, y });
        else if (!isHull(x, y)) bad.add(key(t.x, t.y));
      }
    }
  }
  const walls = [...wallSet.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  // The gap of each patch: a wall with the patch's floor on one side and open space on the other, the first in reading order.
  const gaps: { wall: Tile; stage: Tile }[] = [];
  for (let patch = 0; patch < touches.length; patch++) {
    for (const w of walls) {
      const side = N4.find(([dx, dy]) => patchOf.get(key(w.x + dx, w.y + dy)) === patch);
      const stage = side && { x: w.x - side[0], y: w.y - side[1] };
      if (stage && sector.get('struct', stage.x, stage.y) === Struct.Space && !inPlan.has(key(stage.x, stage.y)) && !wallSet.has(key(stage.x, stage.y)) && !keepClear.has(key(stage.x, stage.y))) {
        gaps.push({ wall: w, stage });
        break;
      }
    }
  }
  const badTiles = floor.filter((t) => bad.has(key(t.x, t.y)));
  const built = [...floor, ...walls];
  const rect = union(ownRect, boxOf(built, 1));
  const areaAfter = area + built.length;
  const out: YardPlan = { ...plan, walls, gaps, bad: badTiles.length ? badTiles : loose, areaAfter, hull: { before: load.tiles, after: hullTiles(grid) + walls.length, capacity: load.capacity }, rect };
  if (floor.length > service.tier.cap) return { ...out, error: 'yardCap' };
  if (badTiles.length) return { ...out, error: 'blocked' };
  if (loose.length) return { ...out, error: 'notAdjacent' };
  if (areaAfter > def.maxTiles) return { ...out, error: 'shipMax' };
  if (!growthClear(sim, ship, rect)) return { ...out, error: 'crowded' };
  return out;
}
