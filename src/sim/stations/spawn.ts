import { ShipC } from '../combat/components';
import { shipById, spawnShip } from '../combat/ships';
import { placementGapError, regions, shipIdOf } from '../regions';
import { generateStation } from '../shipgen/stationGen';
import type { StationSize } from '../shipgen/stationTypes';
import type { Sim } from '../sim';
import { ensureTrader } from '../trade/traders';
import { CrewC, PositionC } from '../crew/components';
import type { GenResult } from '../shipgen/types';
import { StationAlarmC, StationC, StationCrewC } from './components';
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
  settleIn(sim, id, gen, x, y);
  return id;
}

const COURT_ROLES: readonly string[] = ['plaza', 'garden', 'drill', 'support'];
const POST_ROLES: readonly string[] = ['armoury', 'dock', 'plaza', 'garden', 'drill', 'bridge'];

/**
 * Station life: the courts idle crew wander in and the patrol stops (from the generator's rooms), the alarm, and the
 * station crew marker on everyone aboard. Patrols are jobs the station's director posts (systems/stationDirector.ts).
 */
function settleIn(sim: Sim, id: number, gen: GenResult, x: number, y: number): void {
  const toSector = (i: number): { x: number; y: number } => ({ x: x + (i % gen.width), y: y + Math.floor(i / gen.width) });
  const floor = (i: number): boolean => gen.template.rows[Math.floor(i / gen.width)]?.[i % gen.width] === '_';
  const centre = (tiles: number[]): number => {
    const ft = tiles.filter(floor);
    const cx = ft.reduce((t, i) => t + (i % gen.width), 0) / Math.max(1, ft.length);
    const cy = ft.reduce((t, i) => t + Math.floor(i / gen.width), 0) / Math.max(1, ft.length);
    return ft.reduce((b, i) => (Math.hypot((i % gen.width) - cx, Math.floor(i / gen.width) - cy) < Math.hypot((b % gen.width) - cx, Math.floor(b / gen.width) - cy) ? i : b), ft[0] ?? -1);
  };
  const courts: { x: number; y: number }[] = [];
  const posts: { x: number; y: number }[] = [];
  for (const r of gen.rooms) {
    const ft = r.tiles.filter(floor);
    if (ft.length === 0) continue;
    if (COURT_ROLES.includes(r.role)) for (let k = 0; k < Math.min(6, ft.length); k++) courts.push(toSector(ft[Math.floor((k * ft.length) / 6)] as number));
    const c = centre(ft);
    if (POST_ROLES.includes(r.role) && c >= 0) posts.push(toSector(c));
  }
  sim.world.add(id, StationC, { courts, posts, nextPost: 0 });
  const ship = sim.world.get(id, ShipC);
  sim.world.add(id, StationAlarmC, { state: 'calm', reason: '', quiet: 0, integrity: ship?.integrity ?? 1 });
  for (const c of [...sim.world.query(CrewC, PositionC)].sort((a, b) => a - b)) {
    if (shipIdOf(sim, sim.world.get(c, PositionC)) === id) sim.world.add(c, StationCrewC, { station: id });
  }
}
