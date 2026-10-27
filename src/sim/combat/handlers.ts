import type { Command } from '../commands';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { flee } from '../galaxy/hyperspace';
import { leave } from '../galaxy/respond';
import { FTL_CHARGE_SEC } from '../tuning';
import { CombatC, ShipC, WeaponC, type Target } from './components';
import { VehicleC } from '../vehicles/components';
import { placementGapError, shipGrid, shipIdOf } from '../regions';
import { Struct } from '../structure';
import { shipById, spawnShip } from './ships';
import { weaponAntiVehicle } from './targets';
import { generateShip } from '../shipgen/generate';
import { spawnDerelict } from './derelict';

type CombatCommandType = Extract<Command['type'], `combat.${string}` | 'debug.spawnEnemy' | 'debug.spawnGenerated' | 'debug.spawnDerelict'>;
type Handler<T extends CombatCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

/** True if the module entity lies on the grid. */
function moduleOnGrid(sim: Sim, id: number, shipId: number): boolean {
  return shipIdOf(sim, sim.world.get(id, ModuleC)) === shipId;
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
    const shipId = spawnShip(sim, gen.template, { faction: faction.side ?? 'hostile', x, y, rest: 100 });
    const ship = shipById(sim, shipId);
    if (ship) ship.gen = { faction: cmd.faction, seed, depth: cmd.depth, role: gen.role };
  },
  'debug.spawnDerelict': (sim, cmd) => {
    if (!sim.content.factions?.[cmd.faction]) return reject(sim, cmd.type, 'badFaction');
    if (![cmd.cx, cmd.cy, cmd.depth].every(Number.isInteger) || cmd.depth < 0) return reject(sim, cmd.type, 'badValue');
    const seed = cmd.seed === undefined ? sim.rng.int(0, 0x7fffffff) : cmd.seed >>> 0;
    // Centred on (cx, cy), kept inside the sector (the debug spawner never grows it).
    const at = (w: number, h: number): { x: number; y: number } => ({
      x: Math.min(sim.sector.width - w, Math.max(0, cmd.cx - (w >> 1))), y: Math.min(sim.sector.height - h, Math.max(0, cmd.cy - (h >> 1))),
    });
    const r = spawnDerelict(sim, { faction: cmd.faction, depth: cmd.depth, seed, at, intensity: cmd.intensity ?? 0.5, ...(cmd.cause ? { cause: cmd.cause } : {}) });
    if (typeof r === 'string') return reject(sim, cmd.type, r);
  },
  'combat.setTarget': (sim, cmd) => {
    const ship = cmd.ship;
    const combat = sim.world.get(ship, CombatC);
    if (!combat) return reject(sim, cmd.type, 'noShip');
    let target: Target | null = null;
    if (cmd.targetVehicle !== undefined) {
      const v = sim.world.get(cmd.targetVehicle, VehicleC);
      if (!v || v.state === 'stowed' || v.homeShip === ship) return reject(sim, cmd.type, 'badTarget');
      if (cmd.weaponId === null) {
        combat.vehicleTarget = cmd.targetVehicle; // the ship-wide ship target stays for the weapons that cannot hit a shuttle
        return;
      }
      if (!weaponAntiVehicle(sim, cmd.weaponId)) return reject(sim, cmd.type, 'notAntiVehicle');
      target = { ship: 0, moduleId: 0, vehicle: cmd.targetVehicle };
    } else if (cmd.targetShip !== 0) {
      if (cmd.targetShip === cmd.ship || !shipById(sim, cmd.targetShip)) return reject(sim, cmd.type, 'badTarget');
      if (cmd.targetModuleId !== 0 && !moduleOnGrid(sim, cmd.targetModuleId, cmd.targetShip)) return reject(sim, cmd.type, 'badTarget');
      const aimed = shipById(sim, cmd.targetShip);
      if (aimed?.outpost?.hidden) return reject(sim, cmd.type, 'badTarget'); // nobody knows it is there
      const tile = cmd.targetTile;
      if (tile) {
        const grid = shipGrid(sim, cmd.targetShip);
        if (cmd.targetModuleId !== 0 || !Number.isInteger(tile.x) || !Number.isInteger(tile.y) || !grid?.inBounds(tile.x, tile.y) || grid.get('struct', tile.x, tile.y) === Struct.Space) {
          return reject(sim, cmd.type, 'badTarget');
        }
      }
      target = { ship: cmd.targetShip, moduleId: cmd.targetModuleId, ...(tile ? { tile: { x: tile.x, y: tile.y } } : {}) };
    }
    if (cmd.weaponId === null) {
      combat.target = target;
      return;
    }
    const weapon = sim.world.get(cmd.weaponId, WeaponC);
    if (!weapon || !moduleOnGrid(sim, cmd.weaponId, cmd.ship)) return reject(sim, cmd.type, 'noWeapon');
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
    if (ship.immobile) return reject(sim, cmd.type, 'immobile');
    // The player's ship leaves through the galaxy: charge the drive, then jump (`to`, else the cheapest affordable neighbour).
    if (ship.faction === 'player') return void (sim.galaxy.event ? leave(sim, cmd.type) : flee(sim, entity, cmd.to));
    if (combat.ftl < FTL_CHARGE_SEC) return reject(sim, cmd.type, 'notCharged');
    ship.state = 'fled';
    sim.events.emit({ type: 'ship.fled', ship: cmd.ship });
  },
};
