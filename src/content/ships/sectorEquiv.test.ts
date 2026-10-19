import { describe, expect, it } from 'vitest';
import { deserialize, newGame, serialize, Struct, windowShipMismatches, type Sim } from '../../sim';
import { content } from '../index';

/** Grid fields that existed before the sector refactor (the `ship` owner layer is new and left out). */
const FIELDS = ['struct', 'room', 'o2', 'co2', 'temp', 'fire', 'smoke', 'light', 'door', 'module', 'item', 'hp'];

/** FNV-1a over a string, as 8 hex digits. */
function fnv(s: string, h = 0x811c9dc5): number {
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/**
 * A save-format-independent hash of the sim: tick, rng, every entity and component, and each grid's legacy fields read
 * tile by tile in local coordinates (grids in id order). Recorded on the pre-refactor code; must never change.
 */
function stateHash(sim: Sim, events: string): string {
  let h = fnv(`${sim.tick}|${sim.rng.getState()}|${JSON.stringify(sim.world.serialize())}|${events}`);
  for (const id of [...sim.grids.keys()].sort((a, b) => a - b)) {
    const g = sim.grids.get(id)!;
    const vals: number[] = [id, g.width, g.height];
    for (const f of FIELDS) {
      for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) vals.push(g.get(f, x, y));
    }
    h = fnv(vals.join(','), h);
  }
  return h.toString(16).padStart(8, '0');
}

function run(sim: Sim, n: number, log: string[]): void {
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain()) log.push(e.type);
  }
}

/** Starter ship against a raider: weapons, shields, breaches, fire and boarding. */
function combat(seed: number): Sim {
  const sim = newGame(seed, content);
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
  return sim;
}

/** Starter ship with a fire in the first floor tile from the centre and a hull breach on the first outer wall. */
function disaster(seed: number): Sim {
  const sim = newGame(seed, content);
  const g = sim.grids.get(1)!;
  let fire: { x: number; y: number } | null = null;
  let breach: { x: number; y: number } | null = null;
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const k = g.get('struct', x, y);
      if (!fire && k === Struct.Floor && y >= g.height / 2 && x >= g.width / 2) fire = { x, y };
      if (!breach && k === Struct.Wall && x > 0 && g.get('struct', x - 1, y) === Struct.Space && g.get('struct', x + 1, y) === Struct.Floor) {
        breach = { x, y };
      }
    }
  }
  sim.enqueue({ type: 'debug.ignite', gridId: 1, ...fire! });
  sim.enqueue({ type: 'debug.setStruct', gridId: 1, ...breach!, kind: Struct.Space });
  return sim;
}

describe('sector refactor equivalence', () => {
  it('a combat run hashes the same as before the refactor', () => {
    const sim = combat(3);
    const log: string[] = [];
    run(sim, 2400, log);
    expect(windowShipMismatches(sim)).toEqual([]);
    expect(stateHash(sim, log.join(','))).toBe(EXPECTED.combat);
  });

  it('a fire and breach run hashes the same as before the refactor', () => {
    const sim = disaster(9);
    const log: string[] = [];
    run(sim, 1200, log);
    expect(stateHash(sim, log.join(','))).toBe(EXPECTED.disaster);
  });

  it('a save round trip midway gives the identical state', () => {
    const a = combat(5);
    const b = combat(5);
    const la: string[] = [], lb: string[] = [];
    run(a, 1200, la);
    run(b, 600, lb);
    const c = deserialize(serialize(b), content);
    run(c, 600, lb);
    expect(stateHash(c, lb.join(','))).toBe(stateHash(a, la.join(',')));
    expect(serialize(c)).toBe(serialize(a));
  });
});

const EXPECTED = { combat: 'd44fb7e2', disaster: '04df4a60' };
