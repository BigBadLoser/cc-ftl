import { createCrew } from '../crew/spawn';
import { ModuleC } from '../modules/components';
import { isDeployed } from '../modules/deploy';
import { isTileWalkable } from '../modules/walk';
import { placementGapError, stampOwner, shipIdOf, shipGrid } from '../regions';
import { placeTemplateModules } from '../ship';
import { packetFromTemplate, stampPacket, stampTiles, type ShipPacket } from '../sector/packet';
import { ShipGrid } from '../shipGrid';
import type { ShipTemplate } from '../registry';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { TICK_HZ } from '../time';
import { BoarderC, VehicleC } from '../vehicles/components';
import { CombatC, IonC, ShipC, type Combat, type Faction, type Ship } from './components';
import { hullSum } from './hull';

/** The ship with this ShipC entity id (the ship id), or undefined. */
export function shipById(sim: Sim, ship: number): Ship | undefined {
  return ship ? sim.world.get(ship, ShipC) : undefined;
}

/** The player's home ship: the lowest-id ship of the player's faction (the starting ship; later ships, prizes included, have higher ids), or 0. */
export function homeShip(sim: Sim): number {
  let best = 0;
  for (const id of sim.world.query(ShipC)) if (sim.world.get(id, ShipC)?.faction === 'player' && (best === 0 || id < best)) best = id;
  return best;
}

/** Shield layers the generators on a grid give. `powered` counts only running generators; otherwise all intact ones. */
export function shieldCapacity(sim: Sim, shipId: number, powered: boolean): number {
  let layers = 0;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    // Cheap content and state checks before the ship lookup (all pure, so the order changes nothing).
    const gen = m && sim.content.modules[m.def]?.shieldGen;
    if (!m || !gen || m.hp <= 0 || !m.enabled || (powered && !m.powered) || shipIdOf(sim, m) !== shipId) continue;
    if (powered && (sim.world.has(id, IonC) || !isDeployed(sim, id))) continue;
    layers += Math.floor(Math.abs(sim.content.modules[m.def]?.power ?? 0) * gen.layersPerPower);
  }
  return layers;
}
/** The free walkable floor tiles of a grid, in scan order. */
function freeFloor(sim: Sim, grid: ShipGrid): { x: number; y: number }[] {
  const floor: { x: number; y: number }[] = [];
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
    for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      if (grid.get('struct', x, y) === Struct.Floor && isTileWalkable(sim, grid, x, y)) floor.push({ x, y });
    }
  }
  return floor;
}

/** Add one crew member of a role, named `name`, on a random free floor tile of a player-side grid. Returns the id, or 0 (no floor, unknown role). */
export function spawnNamedCrew(sim: Sim, shipId: number, roleId: string, name: string | undefined): number {
  const grid = shipGrid(sim, shipId);
  const floor = grid ? freeFloor(sim, grid) : [];
  if (!floor.length) return 0;
  const tile = floor[sim.rng.int(0, floor.length - 1)] as { x: number; y: number };
  return createCrew(sim, shipId, roleId, tile, { faction: shipById(sim, shipId)?.faction ?? 'player', ...(name ? { name } : {}) });
}

/** Add crew of the given roles on random free floor tiles of a grid. Returns their ids. */
export function spawnCrew(sim: Sim, shipId: number, roles: readonly string[], rest?: number): number[] {
  const grid = shipGrid(sim, shipId);
  if (!grid) return [];
  const floor = freeFloor(sim, grid);
  const names = [...sim.content.crewNames];
  const out: number[] = [];
  for (const roleId of roles) {
    const role = sim.content.roles[roleId];
    // Big crews (station hubs) outrun the name pool: names repeat rather than crew going missing.
    if (names.length === 0) names.push(...sim.content.crewNames);
    if (!role || names.length === 0 || floor.length === 0) continue;
    const tile = floor.splice(sim.rng.int(0, floor.length - 1), 1)[0] as { x: number; y: number };
    const designated = !!sim.content.species[role.species ?? 'species.human']?.designation;
    const name = designated ? undefined : names.splice(sim.rng.int(0, names.length - 1), 1)[0] as string;
    const id = createCrew(sim, shipId, roleId, tile, {
      faction: shipById(sim, shipId)?.faction ?? 'player', ...(rest !== undefined ? { rest } : {}), ...(name ? { name } : {}),
    });
    if (id) out.push(id);
  }
  return out;
}

/**
 * Stamp a ship into the sector at (x, y) and return its ship id (the ShipC entity). A template (or a packet made from one by
 * `packetFromTemplate`) gets its tiles, modules (with their stock and vehicles), the owner layer and a new ShipC (identity,
 * rectangle and lifecycle state; `faction` and `state` from `opts`); no combat, boarding or crew. A lifted packet (`liftShip`)
 * comes back whole, entities under their own ids, and `opts` gives only the spot. Throws if it would overlap another ship or
 * break MIN_SHIP_GAP (commands check `placementGapError` first and reject).
 */
export function stampShip(
  sim: Sim, src: ShipTemplate | ShipPacket, opts: { faction?: Faction; x: number; y: number; state?: Ship['state'] },
): number {
  const packet = 'rows' in src ? packetFromTemplate(src) : src;
  const template = packet.template;
  if (!template) return stampPacket(sim, packet, opts.x, opts.y);
  const rect = { x: opts.x, y: opts.y, w: packet.w, h: packet.h };
  const gap = placementGapError(sim, rect);
  if (gap) throw new Error(`stampShip "${template.name}" at (${opts.x}, ${opts.y}): ${gap}`);
  stampTiles(sim, packet, opts.x, opts.y);
  placeTemplateModules(sim, template, opts.x, opts.y);
  const ship = sim.world.createEntity();
  sim.world.add(ship, ShipC, {
    name: template.name, faction: opts.faction ?? 'neutral', state: opts.state ?? 'active', x: opts.x, y: opts.y,
    width: packet.w, height: packet.h, hullMax: hullSum(new ShipGrid(0, sim.sector.grid, opts.x, opts.y, packet.w, packet.h)), integrity: 1,
  });
  stampOwner(sim.sector.grid, ship, rect);
  // Template vehicles were spawned with the modules, before their ship existed: they belong to it now.
  for (const vid of sim.world.query(VehicleC)) {
    const v = sim.world.get(vid, VehicleC);
    if (v && !v.homeShip && shipIdOf(sim, sim.world.get(v.home, ModuleC)) === ship) v.homeShip = ship;
  }
  return ship;
}

/**
 * Create a ship from a template, stamped into the sector at (x, y): tiles, modules, ship + combat components and crew; its
 * tiles are owned by the new ShipC. Returns the ship id. Throws like `stampShip`.
 */
export function spawnShip(
  sim: Sim, template: ShipTemplate, opts: { faction: Faction; x: number; y: number; rest?: number },
): number {
  const ship = stampShip(sim, template, opts);
  const layers = shieldCapacity(sim, ship, false);
  const combat: Combat = {
    hold: false, volley: false, target: null, doctrine: template.doctrine ?? 'random', ftl: 0,
    shield: { layers, max: layers, timer: 0 }, evasion: 0, pilot: 0, cruisePilot: 0, cruiseEvasion: 0, aiTimer: 0,
  };
  sim.world.add(ship, CombatC, combat);
  if (template.boarding) {
    sim.world.add(ship, BoarderC, {
      party: template.boarding.party, afterTicks: Math.round(template.boarding.afterSec * TICK_HZ),
      losingBelow: template.boarding.losingBelow, state: 'idle', timer: 0, vehicle: 0, crew: [],
      ...(template.boarding.weapon ? { weapon: template.boarding.weapon } : {}),
    });
  }
  spawnCrew(sim, ship, template.crew ?? [], opts.rest);
  sim.events.emit({ type: 'ship.spawned', ship, faction: opts.faction });
  return ship;
}

/** Seconds per shield layer of the quickest running generator on a grid (Infinity if none). */
export function shieldRechargeSec(sim: Sim, shipId: number): number {
  let best = Infinity;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const gen = m && sim.content.modules[m.def]?.shieldGen;
    if (m && gen && m.powered && m.hp > 0 && !sim.world.has(id, IonC) && shipIdOf(sim, m) === shipId) best = Math.min(best, gen.rechargeSec);
  }
  return best;
}
