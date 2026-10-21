import type { Command } from '../commands';
import { asteroidGapError } from '../regions';
import type { Sim } from '../sim';
import { generateAsteroid } from './gen';
import { findAsteroidSpot, placedParts, stampAsteroid } from './place';
import type { OreDef } from './types';

type AsteroidCommandType = 'debug.spawnAsteroid';
type Handler<T extends AsteroidCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

export const asteroidHandlers: { [T in AsteroidCommandType]: Handler<T> } = {
  'debug.spawnAsteroid': (sim, cmd) => {
    if (cmd.kind !== 'big' && cmd.kind !== 'field') return reject(sim, cmd.type, 'badKind');
    if (!Number.isInteger(cmd.seed) || (cmd.x === undefined) !== (cmd.y === undefined)) return reject(sim, cmd.type, 'badValue');
    const ores = Object.values(sim.content.ores ?? {}) as OreDef[];
    const plan = generateAsteroid(cmd.kind, cmd.seed, ores, cmd.coverage === undefined ? {} : { coverage: cmd.coverage });
    let at: { x: number; y: number } | null;
    if (cmd.x !== undefined && cmd.y !== undefined) {
      if (!Number.isInteger(cmd.x) || !Number.isInteger(cmd.y)) return reject(sim, cmd.type, 'badValue');
      if (cmd.x < 0 || cmd.y < 0 || cmd.x + plan.w > sim.sector.width || cmd.y + plan.h > sim.sector.height) return reject(sim, cmd.type, 'outOfBounds');
      const gap = asteroidGapError(sim, placedParts(plan, cmd.x, cmd.y));
      if (gap) return reject(sim, cmd.type, gap);
      at = { x: cmd.x, y: cmd.y };
    } else {
      at = findAsteroidSpot(sim, plan);
      if (!at) return reject(sim, cmd.type, 'noRoom');
    }
    const asteroid = stampAsteroid(sim, plan, at.x, at.y);
    sim.events.emit({ type: 'asteroid.spawned', asteroid, kind: plan.kind, x: at.x, y: at.y, w: plan.w, h: plan.h });
  },
};
