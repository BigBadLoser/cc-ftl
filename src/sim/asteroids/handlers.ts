import type { Command } from '../commands';
import { asteroidGapError, intersects, padded, regions } from '../regions';
import { ShipC } from '../combat/components';
import { REGION_PAD } from '../tuning';
import { AsteroidC } from './components';
import type { Sim } from '../sim';
import { generateAsteroid } from './gen';
import { findAsteroidSpot, placedParts, stampAsteroid } from './place';
import type { OreDef } from './types';

type AsteroidCommandType = 'debug.spawnAsteroid' | 'asteroid.claim';
type Handler<T extends AsteroidCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

/** Claimed base size limits (tiles per side). */
export const CLAIM_MIN = 4;
export const CLAIM_MAX = 60;

export const asteroidHandlers: { [T in AsteroidCommandType]: Handler<T> } = {
  'asteroid.claim': (sim, cmd) => {
    const a = sim.world.get(cmd.asteroid, AsteroidC);
    if (!a || a.kind !== 'big') return reject(sim, cmd.type, 'noAsteroid');
    if (![cmd.x, cmd.y, cmd.w, cmd.h].every(Number.isInteger)) return reject(sim, cmd.type, 'badValue');
    if (cmd.w < CLAIM_MIN || cmd.h < CLAIM_MIN || cmd.w > CLAIM_MAX || cmd.h > CLAIM_MAX) return reject(sim, cmd.type, 'badSize');
    const rect = { x: cmd.x, y: cmd.y, w: cmd.w, h: cmd.h };
    if (cmd.x < a.x || cmd.y < a.y || cmd.x + cmd.w > a.x + a.width || cmd.y + cmd.h > a.y + a.height) return reject(sim, cmd.type, 'offAsteroid');
    let rock = 0;
    for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) if (sim.sector.grid.get('ship', x, y) === cmd.asteroid) rock++;
    if (rock * 2 < rect.w * rect.h) return reject(sim, cmd.type, 'offAsteroid'); // at least half of it on the rock
    // other regions (outposts, earlier claims, ships) keep their padded frames clear of it
    if (regions(sim).some((r) => intersects(padded(rect, REGION_PAD), r.frame))) return reject(sim, cmd.type, 'overlap');
    const ship = sim.world.createEntity();
    sim.world.add(ship, ShipC, {
      name: 'Asteroid base', faction: 'player', state: 'active', x: rect.x, y: rect.y, width: rect.w, height: rect.h, hullMax: 0, integrity: 1,
      base: { asteroid: cmd.asteroid },
    });
    sim.events.emit({ type: 'asteroid.claimed', asteroid: cmd.asteroid, ship, x: rect.x, y: rect.y, w: rect.w, h: rect.h });
  },
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
