import { MarkerC } from './components';

import type { Command } from './commands';
import { asteroidHandlers } from './asteroids/handlers';
import { miningHandlers } from './mining/handlers';
import { ferryHandlers } from './ferry/handlers';
import { logisticsHandlers } from './logistics/handlers';
import { outpostHandlers } from './outposts/handlers';
import { boardingHandlers } from './boarding/handlers';
import { captureHandlers } from './capture/handlers';
import { combatHandlers } from './combat/handlers';
import { containerHandlers } from './containers/handlers';
import { crewHandlers } from './crew/handlers';
import { repairHandlers } from './crew/priorityRepair';
import { evaHandlers } from './eva/handlers';
import { fightHandlers } from './fight/handlers';
import { galaxyHandlers } from './galaxy/handlers';
import { ftlHandlers } from './ftl/handlers';
import { itemHandlers } from './items/handlers';
import { moduleHandlers } from './modules/handlers';
import { researchHandlers } from './research/handlers';
import { robotHandlers } from './robots/handlers';
import { sectorHandlers } from './sector/handlers';
import { storyHandlers } from './story/handlers';
import { tradeHandlers } from './trade/handlers';
import { vehicleHandlers } from './vehicles/handlers';
import { yardHandlers } from './yard/order';
import { ModuleC } from './modules/components';
import { FIRE_START_INTENSITY } from './tuning';
import { Struct, writeStruct } from './structure';
import type { Sim } from './sim';
import { shipGrid } from './regions';

type Handler<T extends Command['type']> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

/** One handler per command type. The compiler requires an entry for every Command variant. */
export const commandHandlers: { [T in Command['type']]: Handler<T> } = {
  ...crewHandlers,
  ...repairHandlers,
  ...fightHandlers,
  ...combatHandlers,
  ...captureHandlers,
  ...boardingHandlers,
  ...moduleHandlers,
  ...containerHandlers,
  ...itemHandlers,
  ...evaHandlers,
  ...vehicleHandlers,
  ...robotHandlers,
  ...researchHandlers,
  ...storyHandlers,
  ...tradeHandlers,
  ...galaxyHandlers,
  ...ftlHandlers,
  ...yardHandlers,
  ...sectorHandlers,
  ...asteroidHandlers,
  ...miningHandlers,
  ...ferryHandlers,
  ...logisticsHandlers,
  ...outpostHandlers,
  noop: () => {},
  'debug.spawnMarker': (sim, cmd) => {
    const entity = sim.world.createEntity();
    sim.world.add(entity, MarkerC, { x: cmd.x, y: cmd.y });
    sim.events.emit({ type: 'debug.markerSpawned', entity, x: cmd.x, y: cmd.y });
  },
  'debug.setStruct': (sim, cmd) => {
    const grid = shipGrid(sim, cmd.ship);
    if (!grid?.has('struct') || !grid.inBounds(cmd.x, cmd.y)) return;
    if (!Object.values(Struct).includes(cmd.kind as never)) return;
    writeStruct(grid, cmd.x, cmd.y, cmd.kind);
  },
  'debug.setModuleHp': (sim, cmd) => {
    const m = sim.world.get(cmd.id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || !Number.isFinite(cmd.hp)) return rejectCmd(sim, cmd.type, 'noModule');
    m.hp = Math.max(0, Math.min(def.maxHp, cmd.hp));
  },
  'debug.ignite': (sim, cmd) => {
    const grid = shipGrid(sim, cmd.ship);
    if (!grid?.has('fire') || !grid.inBounds(cmd.x, cmd.y)) return rejectCmd(sim, cmd.type, 'outOfBounds');
    const kind = grid.get('struct', cmd.x, cmd.y);
    if (kind !== Struct.Floor && kind !== Struct.Door) return rejectCmd(sim, cmd.type, 'notBurnable');
    if (grid.get('fire', cmd.x, cmd.y) < FIRE_START_INTENSITY) grid.set('fire', cmd.x, cmd.y, FIRE_START_INTENSITY);
  },
  'debug.setField': (sim, cmd) => {
    const grid = shipGrid(sim, cmd.ship);
    const range = DEBUG_FIELDS[cmd.field];
    if (!grid || !range || !grid.has(cmd.field)) return rejectCmd(sim, cmd.type, 'badField');
    if (!grid.inBounds(cmd.x, cmd.y)) return rejectCmd(sim, cmd.type, 'outOfBounds');
    if (!Number.isFinite(cmd.value) || cmd.value < range[0] || cmd.value > range[1]) return rejectCmd(sim, cmd.type, 'badValue');
    grid.set(cmd.field, cmd.x, cmd.y, range[2] ? Math.round(cmd.value) : cmd.value);
  },
};

/** Fields debug.setField may write: [min, max, integer]. */
const DEBUG_FIELDS: Record<string, readonly [number, number, boolean]> = {
  o2: [0, 100, false], co2: [0, 100, false],
  fire: [0, 255, true], smoke: [0, 255, true], light: [0, 255, true], door: [0, 255, true],
};

function rejectCmd(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}
