import { createCrew } from '../crew/spawn';
import { ModuleC } from '../modules/components';
import { isDeployed } from '../modules/deploy';
import { isTileWalkable } from '../modules/walk';
import { placementGapError, stampOwner } from '../regions';
import { gridFromTemplate, spawnTemplateModules } from '../ship';
import type { ShipTemplate } from '../registry';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { TICK_HZ } from '../time';
import { BoarderC, VehicleC } from '../vehicles/components';
import { CombatC, IonC, ShipC, type Combat, type Faction, type Ship } from './components';
import { hullSum } from './hull';

/** The ship entity of a grid, or 0. */
export function shipEntityOf(sim: Sim, gridId: number): number {
  for (const id of sim.world.query(ShipC)) if (sim.world.get(id, ShipC)?.gridId === gridId) return id;
  return 0;
}

/** The ship of a grid, or undefined. */
export function shipOf(sim: Sim, gridId: number): Ship | undefined {
  return sim.world.get(shipEntityOf(sim, gridId), ShipC);
}

/** The ship with this ShipC entity id (the ship id), or undefined. */
export function shipById(sim: Sim, ship: number): Ship | undefined {
  return ship ? sim.world.get(ship, ShipC) : undefined;
}

/** Grid id of a ship id, or 0 if it is gone (for code that still keys on grids until step 7). */
export function gridOfShip(sim: Sim, ship: number): number {
  return shipById(sim, ship)?.gridId ?? 0;
}

/** Lowest grid id not in use. */
export function nextGridId(sim: Sim): number {
  let max = 0;
  for (const id of sim.grids.keys()) max = Math.max(max, id);
  return max + 1;
}

/** Shield layers the generators on a grid give. `powered` counts only running generators; otherwise all intact ones. */
export function shieldCapacity(sim: Sim, gridId: number, powered: boolean): number {
  let layers = 0;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const gen = m && m.gridId === gridId ? sim.content.modules[m.def]?.shieldGen : undefined;
    if (!m || !gen || m.hp <= 0 || !m.enabled || (powered && !m.powered)) continue;
    if (powered && (sim.world.has(id, IonC) || !isDeployed(sim, id))) continue;
    layers += Math.floor(Math.abs(sim.content.modules[m.def]?.power ?? 0) * gen.layersPerPower);
  }
  return layers;
}
/** Add crew of the given roles on random free floor tiles of a grid. Returns their ids. */
export function spawnCrew(sim: Sim, gridId: number, roles: readonly string[], rest?: number): number[] {
  const grid = sim.grids.get(gridId);
  if (!grid) return [];
  const floor: { x: number; y: number }[] = [];
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
    for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      if (grid.get('struct', x, y) === Struct.Floor && isTileWalkable(sim, grid, x, y)) floor.push({ x, y });
    }
  }
  const names = [...sim.content.crewNames];
  const out: number[] = [];
  for (const roleId of roles) {
    const role = sim.content.roles[roleId];
    if (!role || names.length === 0 || floor.length === 0) continue;
    const tile = floor.splice(sim.rng.int(0, floor.length - 1), 1)[0] as { x: number; y: number };
    const designated = !!sim.content.species[role.species ?? 'species.human']?.designation;
    const name = designated ? undefined : names.splice(sim.rng.int(0, names.length - 1), 1)[0] as string;
    const id = createCrew(sim, gridId, roleId, tile, {
      faction: shipOf(sim, gridId)?.faction ?? 'player', ...(rest !== undefined ? { rest } : {}), ...(name ? { name } : {}),
    });
    if (id) out.push(id);
  }
  return out;
}

/**
 * Create a ship from a template, stamped into the sector at (x, y): grid, modules, ship + combat components and crew; its
 * tiles are owned by the new ShipC. Returns the grid id. Throws if it would overlap another grid or break MIN_SHIP_GAP
 * (commands check `placementGapError` first and reject).
 */
export function spawnShip(
  sim: Sim, template: ShipTemplate, opts: { gridId?: number; faction: Faction; x: number; y: number; rest?: number },
): number {
  const gridId = opts.gridId ?? nextGridId(sim);
  const dense = gridFromTemplate(gridId, template);
  const gap = placementGapError(sim, { x: opts.x, y: opts.y, w: dense.width, h: dense.height });
  if (gap) throw new Error(`spawnShip "${template.name}" at (${opts.x}, ${opts.y}): ${gap}`);
  const grid = sim.grids.stamp(gridId, dense, opts.x, opts.y);
  spawnTemplateModules(sim, gridId, template);
  const ship = sim.world.createEntity();
  sim.world.add(ship, ShipC, {
    gridId, name: template.name, faction: opts.faction, state: 'active', x: opts.x, y: opts.y,
    width: grid.width, height: grid.height, hullMax: hullSum(grid), integrity: 1,
  });
  stampOwner(grid, ship);
  // Template vehicles were spawned with the modules, before their ship existed: they belong to it now.
  for (const vid of sim.world.query(VehicleC)) {
    const v = sim.world.get(vid, VehicleC);
    if (v && !v.homeShip && sim.world.get(v.home, ModuleC)?.gridId === gridId) v.homeShip = ship;
  }
  const layers = shieldCapacity(sim, gridId, false);
  const combat: Combat = {
    hold: false, volley: false, target: null, doctrine: template.doctrine ?? 'random', ftl: 0,
    shield: { layers, max: layers, timer: 0 }, evasion: 0, aiTimer: 0,
  };
  sim.world.add(ship, CombatC, combat);
  if (template.boarding) {
    sim.world.add(ship, BoarderC, {
      party: template.boarding.party, afterTicks: Math.round(template.boarding.afterSec * TICK_HZ),
      losingBelow: template.boarding.losingBelow, state: 'idle', timer: 0, vehicle: 0, crew: [],
      ...(template.boarding.weapon ? { weapon: template.boarding.weapon } : {}),
    });
  }
  spawnCrew(sim, gridId, template.crew ?? [], opts.rest);
  sim.events.emit({ type: 'ship.spawned', gridId, faction: opts.faction });
  return gridId;
}

/** Seconds per shield layer of the quickest running generator on a grid (Infinity if none). */
export function shieldRechargeSec(sim: Sim, gridId: number): number {
  let best = Infinity;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const gen = m && m.gridId === gridId ? sim.content.modules[m.def]?.shieldGen : undefined;
    if (m && gen && m.powered && m.hp > 0 && !sim.world.has(id, IonC)) best = Math.min(best, gen.rechargeSec);
  }
  return best;
}
