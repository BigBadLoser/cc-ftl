import { AsteroidC } from '../asteroids/components';
import type { Command } from '../commands';
import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';
import { vehicleDefOf } from '../vehicles/lifecycle';
import { MiningPodC } from './components';
import { isOreTile } from './pick';

type MiningCommandType = Extract<Command['type'], `mining.${string}`>;
type Handler<T extends MiningCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

export const miningHandlers: { [T in MiningCommandType]: Handler<T> } = {
  'mining.order': (sim, cmd) => {
    const v = sim.world.get(cmd.pod, VehicleC);
    if (!v || !vehicleDefOf(sim, v)?.mining) return reject(sim, cmd.type, 'noPod');
    if (!v.home) return reject(sim, cmd.type, 'noBay');
    if (!sim.world.has(cmd.asteroid, AsteroidC)) return reject(sim, cmd.type, 'noAsteroid');
    let tiles: { x: number; y: number }[] | null = null;
    if (cmd.tiles) {
      if (!cmd.tiles.every((t) => Number.isInteger(t.x) && Number.isInteger(t.y))) return reject(sim, cmd.type, 'badValue');
      const seen = new Set<string>();
      tiles = cmd.tiles.filter((t) => {
        const k = `${t.x},${t.y}`;
        if (seen.has(k) || !isOreTile(sim, cmd.asteroid, t.x, t.y)) return false;
        seen.add(k);
        return true;
      }).map((t) => ({ x: t.x, y: t.y }));
      if (tiles.length === 0) return reject(sim, cmd.type, 'noOre');
    }
    const prev = sim.world.get(cmd.pod, MiningPodC);
    // A pod already out turns to the new order's nearest tile (even on its way home); a stowed one launches once it is empty.
    const flying = v.state === 'flying';
    if (flying) v.dest = null;
    sim.world.add(cmd.pod, MiningPodC, {
      asteroid: cmd.asteroid, tiles, phase: flying ? 'outbound' : 'launching', target: null, progress: 0, recall: false, trips: prev?.trips ?? 0,
    });
    sim.events.emit({ type: 'mining.ordered', pod: cmd.pod, asteroid: cmd.asteroid, tiles: tiles?.length ?? -1 });
  },
  'mining.recall': (sim, cmd) => {
    const order = sim.world.get(cmd.pod, MiningPodC);
    if (!order) return reject(sim, cmd.type, 'noOrder');
    order.recall = true;
  },
};
