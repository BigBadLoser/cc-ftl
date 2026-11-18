import { describe, expect, it } from 'vitest';
import { homeShip } from '../../sim/combat/shipQuery';
import { newGame } from '../../sim/newGame';
import { shipGrid } from '../../sim/regions';
import type { Sim } from '../../sim/sim';
import { NORMAL_O2 } from '../../sim/tuning';
import { Struct } from '../../sim/structure';
import { content } from '../index';
import { run } from '../../../test/support/sim';
import { expectReplayable } from '../../../test/support/world';

/**
 * The two scripted runs that once pinned the sector refactor with state hashes recorded on the pre-refactor code (the hashes were
 * repinned for almost every sim change since and no longer said anything but "the sim changed"). What they protect now: a run is
 * replayable (two builds step to byte-identical saves, a mid-run save and reload changes nothing: every grid field, component and the
 * rng, tick by tick) and it does what the scenario is about (a fight is fought, a fire is put out and a breach sealed).
 */

/** Starter ship against a raider: weapons, shields, breaches, fire and boarding. */
function combat(seed: number): Sim {
  const sim = newGame(seed, content);
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
  return sim;
}

type At = { x: number; y: number };

/** Starter ship with a fire in the first floor tile from the centre and a hull breach on the first outer wall. */
function disaster(seed: number): { sim: Sim; fire: At; breach: At } {
  const sim = newGame(seed, content);
  const g = shipGrid(sim, homeShip(sim))!;
  let fire: At | null = null;
  let breach: At | null = null;
  const at = (x: number, y: number) => g.get('struct', g.x0 + x, g.y0 + y);
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const k = at(x, y);
      if (!fire && k === Struct.Floor && y >= g.height / 2 && x >= g.width / 2) fire = { x: g.x0 + x, y: g.y0 + y };
      if (!breach && k === Struct.Wall && x > 0 && at(x - 1, y) === Struct.Space && at(x + 1, y) === Struct.Floor) breach = { x: g.x0 + x, y: g.y0 + y };
    }
  }
  sim.enqueue({ type: 'debug.ignite', ship: homeShip(sim), ...fire! });
  sim.enqueue({ type: 'debug.setStruct', ship: homeShip(sim), ...breach!, kind: Struct.Space });
  return { sim, fire: fire!, breach: breach! };
}

describe('scripted runs of the starter ship', () => {
  it('a combat run is fought: weapons fire, shots land, modules are lost', () => {
    const types = new Set(run(combat(3), 2400).map((e) => e.type));
    for (const t of ['combat.started', 'weapon.fired', 'projectile.hit', 'module.destroyed', 'crew.jobDone']) expect(types.has(t as never), t).toBe(true);
  });

  it('a fire and breach run: the crew put out the fire and seal the breach, and the run replays identically across a save', () => {
    const { sim, fire, breach } = disaster(9);
    const g = shipGrid(sim, homeShip(sim))!;
    run(sim, 1200);
    for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) expect(g.get('fire', g.x0 + x, g.y0 + y), `fire at ${x},${y}`).toBe(0);
    expect(g.get('struct', breach.x, breach.y)).toBe(Struct.Wall);
    expect(g.get('o2', fire.x, fire.y)).toBeGreaterThan(NORMAL_O2 * 0.9);
    expectReplayable(() => disaster(9).sim, 1200, { saveAt: 600 });
  });

  it('a save round trip midway gives the identical state', () => {
    expectReplayable(() => combat(5), 1200, { saveAt: 600 });
  });
});
