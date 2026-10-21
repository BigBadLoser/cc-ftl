import type { OreDef } from '../asteroids/types';
import { findAsteroidSpot } from '../asteroids/place';
import type { Command } from '../commands';
import type { Sim } from '../sim';
import { generateOutpost, OUTPOST_KINDS } from './gen';
import { stampOutpost } from './stamp';

type OutpostCommandType = 'debug.spawnOutpost';
type Handler<T extends OutpostCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

export const outpostHandlers: { [T in OutpostCommandType]: Handler<T> } = {
  'debug.spawnOutpost': (sim, cmd) => {
    if (cmd.style !== 'surface' && cmd.style !== 'dug') return reject(sim, cmd.type, 'badStyle');
    if (cmd.kind !== undefined && !OUTPOST_KINDS[cmd.style].includes(cmd.kind)) return reject(sim, cmd.type, 'badKind');
    if (!Number.isInteger(cmd.seed)) return reject(sim, cmd.type, 'badValue');
    const o = generateOutpost(cmd.style, cmd.seed, Object.values(sim.content.ores ?? {}) as OreDef[], cmd.kind);
    if (!o) return reject(sim, cmd.type, 'noLayout');
    const at = cmd.x !== undefined && cmd.y !== undefined ? { x: cmd.x, y: cmd.y } : findAsteroidSpot(sim, o.asteroid);
    if (!at) return reject(sim, cmd.type, 'noRoom');
    let ids: { asteroid: number; ship: number };
    try {
      ids = stampOutpost(sim, o, at.x, at.y);
    } catch {
      return reject(sim, cmd.type, 'tooClose');
    }
    sim.events.emit({ type: 'outpost.spawned', ...ids, style: o.style, kind: o.kind, x: at.x, y: at.y });
  },
};
