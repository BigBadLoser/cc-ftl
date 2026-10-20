import type { Command } from '../commands';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { FTL_CHARGE_SEC } from '../tuning';
import { CombatC, ShipC, WeaponC, type Target } from './components';
import { VehicleC } from '../vehicles/components';
import { placementGapError , gridIdOf } from '../regions';
import { gridOfShip, shipById, shipOf, spawnShip } from './ships';
import { generateShip } from '../shipgen/generate';

type CombatCommandType = Extract<Command['type'], `combat.${string}` | 'debug.spawnEnemy' | 'debug.spawnGenerated'>;
type Handler<T extends CombatCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

/** True if the module entity lies on the grid. */
function moduleOnGrid(sim: Sim, id: number, gridId: number): boolean {
  return gridIdOf(sim, sim.world.get(id, ModuleC)) === gridId;
}

export const combatHandlers: { [T in CombatCommandType]: Handler<T> } = {
  'debug.spawnEnemy': (sim, cmd) => {
    const template = sim.content.ships[cmd.template];
    if (!template) return reject(sim, cmd.type, 'badTemplate');
    if (!Number.isInteger(cmd.x) || !Number.isInteger(cmd.y)) return reject(sim, cmd.type, 'badValue');
    const w = Math.max(1, ...template.rows.map((r) => r.length));
    const h = Math.max(1, template.rows.length);
    if (cmd.x < 0 || cmd.y < 0 || cmd.x + w > sim.sector.width || cmd.y + h > sim.sector.height) {
      return reject(sim, cmd.type, 'outOfBounds');
    }
    const gap = placementGapError(sim, { x: cmd.x, y: cmd.y, w, h });
    if (gap) return reject(sim, cmd.type, gap);
    spawnShip(sim, template, { faction: template.faction ?? 'hostile', x: cmd.x, y: cmd.y, rest: 100 });
  },
  'debug.spawnGenerated': (sim, cmd) => {
    const faction = sim.content.factions?.[cmd.faction];
    if (!faction) return reject(sim, cmd.type, 'badFaction');
    if (![cmd.cx, cmd.cy, cmd.depth].every(Number.isInteger) || cmd.depth < 0) return reject(sim, cmd.type, 'badValue');
    const seed = cmd.seed === undefined ? sim.rng.int(0, 0x7fffffff) : cmd.seed >>> 0;
    const gen = generateShip(faction, cmd.faction, seed, cmd.depth, sim.content.modules);
    if (gen.problems.length > 0) return reject(sim, cmd.type, 'noLayout');
    const x = Math.min(sim.sector.width - gen.width, Math.max(0, cmd.cx - (gen.width >> 1)));
    const y = Math.min(sim.sector.height - gen.height, Math.max(0, cmd.cy - (gen.height >> 1)));
    const gap = placementGapError(sim, { x, y, w: gen.width, h: gen.height });
    if (gap) return reject(sim, cmd.type, gap);
    const gridId = spawnShip(sim, gen.template, { faction: faction.side ?? 'hostile', x, y, rest: 100 });
    const ship = shipOf(sim, gridId);
    if (ship) ship.gen = { faction: cmd.faction, seed, depth: cmd.depth, role: gen.role };
  },
  'combat.setTarget': (sim, cmd) => {
    const ship = cmd.ship;
    const combat = sim.world.get(ship, CombatC);
    if (!combat) return reject(sim, cmd.type, 'noShip');
    let target: Target | null = null;
    if (cmd.targetVehicle !== undefined) {
      const v = sim.world.get(cmd.targetVehicle, VehicleC);
      if (!v || v.state === 'stowed' || v.homeShip === ship) return reject(sim, cmd.type, 'badTarget');
      target = { ship: 0, moduleId: 0, vehicle: cmd.targetVehicle };
    } else if (cmd.targetShip !== 0) {
      if (cmd.targetShip === cmd.ship || !shipById(sim, cmd.targetShip)) return reject(sim, cmd.type, 'badTarget');
      if (cmd.targetModuleId !== 0 && !moduleOnGrid(sim, cmd.targetModuleId, gridOfShip(sim, cmd.targetShip))) return reject(sim, cmd.type, 'badTarget');
      target = { ship: cmd.targetShip, moduleId: cmd.targetModuleId };
    }
    if (cmd.weaponId === null) {
      combat.target = target;
      return;
    }
    const weapon = sim.world.get(cmd.weaponId, WeaponC);
    if (!weapon || !moduleOnGrid(sim, cmd.weaponId, gridOfShip(sim, cmd.ship))) return reject(sim, cmd.type, 'noWeapon');
    weapon.target = target;
  },
  'combat.setHold': (sim, cmd) => {
    const combat = sim.world.get(cmd.ship, CombatC);
    if (!combat) return reject(sim, cmd.type, 'noShip');
    combat.hold = cmd.hold;
  },
  'combat.fireVolley': (sim, cmd) => {
    const combat = sim.world.get(cmd.ship, CombatC);
    if (!combat) return reject(sim, cmd.type, 'noShip');
    combat.volley = true;
  },
  'combat.flee': (sim, cmd) => {
    const entity = cmd.ship;
    const ship = sim.world.get(entity, ShipC);
    const combat = sim.world.get(entity, CombatC);
    if (!ship || !combat) return reject(sim, cmd.type, 'noShip');
    if (ship.state !== 'active') return reject(sim, cmd.type, 'notActive');
    if (combat.ftl < FTL_CHARGE_SEC) return reject(sim, cmd.type, 'notCharged');
    ship.state = 'fled';
    sim.events.emit({ type: 'ship.fled', ship: cmd.ship });
  },
};
