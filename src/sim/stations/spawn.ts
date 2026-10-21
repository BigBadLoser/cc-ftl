import { ShipC } from '../combat/components';
import { shipById, spawnShip } from '../combat/ships';
import { placementGapError, regions } from '../regions';
import { generateStation } from '../shipgen/stationGen';
import type { StationSize } from '../shipgen/stationTypes';
import type { Sim } from '../sim';
import { ensureTrader } from '../trade/traders';
import { MIN_SHIP_GAP, REGION_PAD } from '../tuning';

/** Tiles of open space kept between a new station and whatever is already in the node (beyond the placement minimum). */
const STATION_GAP = 2 * REGION_PAD + MIN_SHIP_GAP + 8;

/**
 * Generate a station of a kind and size from `seed` and stamp it into the node as an immobile ship: its tiles, modules,
 * crew (NPC crew and security, of the kind's side) and a trader (wallet and stock from its trader kind). With no position it
 * goes east of everything already in the node, vertically centred; the node grows to fit a hub (nodes are sparse grids, the
 * size only bounds placement and the camera). Hostile kinds (pirate dens) start dormant: no combat until provoked.
 * Returns the ship id, or a reason it could not be placed.
 */
export function spawnStation(sim: Sim, kind: string, size: StationSize, seed: number, at?: { x: number; y: number }, name?: string): number | string {
  const def = sim.content.stations?.[kind];
  if (!def) return 'badKind';
  const gen = generateStation(def, kind, size, seed >>> 0, sim.content.modules);
  if (gen.problems.length > 0) return 'noLayout';
  let x = at?.x ?? 0;
  let y = at?.y ?? 0;
  if (!at) {
    let east = 0;
    for (const r of regions(sim)) east = Math.max(east, r.bbox.x + r.bbox.w);
    x = east + STATION_GAP;
    y = Math.max(4, Math.round(sim.sector.height / 2 - gen.height / 2));
  }
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) return 'badValue';
  const gap = placementGapError(sim, { x, y, w: gen.width, h: gen.height });
  if (gap) return gap;
  sim.sector.width = Math.max(sim.sector.width, x + gen.width + 8);
  sim.sector.height = Math.max(sim.sector.height, y + gen.height + 8);
  const template = name ? { ...gen.template, name } : gen.template;
  const id = spawnShip(sim, template, { faction: def.side, x, y, rest: 100 });
  const ship = shipById(sim, id);
  if (!ship) return 'noShip';
  ship.gen = { faction: kind, seed: seed >>> 0, depth: 0, role: size };
  ship.immobile = true;
  if (def.side === 'hostile') ship.dormant = ship.integrity;
  if (sim.world.has(id, ShipC)) ensureTrader(sim, id);
  return id;
}
