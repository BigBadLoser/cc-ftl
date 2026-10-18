import {
  CrewC, HealthC, NeedsC, PathC, PositionC, PrioritiesC,
} from '../crew/components';
import { ModuleC } from '../modules/components';
import { isDeployed } from '../modules/deploy';
import { isTileWalkable } from '../modules/walk';
import { gridFromTemplate, spawnTemplateModules } from '../ship';
import type { ShipTemplate } from '../registry';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { CREW_MAX_HP } from '../tuning';
import { TICK_HZ } from '../time';
import { BoarderC } from '../vehicles/components';
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
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (grid.get('struct', x, y) === Struct.Floor && isTileWalkable(sim, grid, x, y)) floor.push({ x, y });
    }
  }
  const names = [...sim.content.crewNames];
  const out: number[] = [];
  for (const roleId of roles) {
    const role = sim.content.roles[roleId];
    if (!role || names.length === 0 || floor.length === 0) continue;
    const tile = floor.splice(sim.rng.int(0, floor.length - 1), 1)[0] as { x: number; y: number };
    const name = names.splice(sim.rng.int(0, names.length - 1), 1)[0] as string;
    const id = sim.world.createEntity();
    sim.world.add(id, CrewC, {
      name, role: roleId, species: 'species.human', appearanceSeed: sim.rng.int(0, 0x7fffffff), activity: 'idle',
    });
    sim.world.add(id, PositionC, { gridId, x: tile.x, y: tile.y, toX: tile.x, toY: tile.y, progress: 0, facing: 0 });
    sim.world.add(id, PathC, { steps: [] });
    sim.world.add(id, PrioritiesC, { ...role.priorities });
    sim.world.add(id, NeedsC, { rest: rest ?? sim.rng.int(60, 100) });
    sim.world.add(id, HealthC, { hp: CREW_MAX_HP, max: CREW_MAX_HP });
    out.push(id);
  }
  return out;
}

/** Create a ship from a template: grid, modules, ship + combat components and crew. Returns the grid id. */
export function spawnShip(
  sim: Sim, template: ShipTemplate, opts: { gridId?: number; faction: Faction; x: number; y: number; rest?: number },
): number {
  const gridId = opts.gridId ?? nextGridId(sim);
  const grid = gridFromTemplate(gridId, template);
  sim.grids.set(gridId, grid);
  spawnTemplateModules(sim, gridId, template);
  const ship = sim.world.createEntity();
  sim.world.add(ship, ShipC, {
    gridId, name: template.name, faction: opts.faction, state: 'active', x: opts.x, y: opts.y,
    width: grid.width, height: grid.height, hullMax: hullSum(grid), integrity: 1,
  });
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
