import { describe, expect, it } from 'vitest';
import { CombatC, FTL_CHARGE_SEC, ShipC, deserialize, galaxyIndex, newGame, playerShip, serialize, type Sim } from '../sim';

import { TIME_TURN_TICKS } from '../sim/galaxy/turn';
import { giveItems } from '../sim/story/effects';
import { content } from '.';

/** Places to try deploying at (a node's own ships may be in the way of some). */
const SPOTS = [0, 1, 2, 3, 4, 5, 6].flatMap((i) => [0, 1, 2, 3, 4].map((j) => [8 + i * 20, 8 + j * 18] as const));

/** The sector state as a plain string (the compiler narrows `sim.sector.state` across steps it cannot see). */
const stateOf = (sim: Sim): string => sim.sector.state;

/** Invariants that must hold after every step of the traffic. */
function check(sim: Sim): void {
  const g = sim.galaxy;
  const index = galaxyIndex(g);
  expect(g.encounters.length).toBeLessThanOrEqual(8);
  const ids = new Set<number>();
  for (const f of g.fleets) {
    expect(index.nodes.has(f.node)).toBe(true);
    expect(f.ships.length).toBeGreaterThan(0);
    for (const c of f.ships) {
      if (c.ship === undefined) continue;
      // Only the fleets in the player's live node have real ships, each one once.
      expect(f.node).toBe(g.current);
      expect(['active', 'deploying']).toContain(sim.sector.state);
      expect(sim.world.get(c.ship, ShipC)).toBeDefined();
      expect(ids.has(c.ship)).toBe(false);
      ids.add(c.ship);
    }
  }
}

describe('NPC traffic over a long run', () => {
  it.each([31, 32])('seed %i: game-time turns and trips keep the invariants, and a save continues identically', (seed) => {
    const sim = newGame(seed, content);
    sim.story.goals.skipped = true; // opening grace off: these tests interdict at the danger-0 start
    giveItems(sim, 'item.fuel', 400);
    let copy: Sim | null = null;
    for (let round = 0; round < 9; round++) {
      for (let i = 0; i < TIME_TURN_TICKS; i += 20) {
        for (let k = 0; k < 20; k++) sim.step();
        sim.events.drain();
        check(sim);
      }
      if (round === 5) copy = deserialize(serialize(sim), content);
      if (round % 3 === 2 && sim.sector.state === 'active') {
        const c = sim.world.get(playerShip(sim), CombatC);
        if (c) c.ftl = FTL_CHARGE_SEC;
        const here = sim.galaxy.current;
        const next = (galaxyIndex(sim.galaxy).adjacent.get(here) ?? []).map((e) => (e.a === here ? e.b : e.a)).sort()[0] as string;
        sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [next] });
        sim.step();
        for (let k = 0; k < 200 && stateOf(sim) === 'hyperspace'; k++) {
          sim.step();
          sim.story.active = null; // a hop may draw a story decision, which holds the trip
          if (sim.galaxy.travel?.phase === 'arrived') sim.enqueue({ type: 'galaxy.drop' });
        }
        sim.events.drain();
        for (const [x, y] of SPOTS) {
          if (stateOf(sim) !== 'deploying') break;
          sim.enqueue({ type: 'sector.deploy', x, y });
          sim.step();
        }
        check(sim);
      }
    }
    expect(sim.galaxy.turn).toBeGreaterThan(5);
    expect(copy).not.toBeNull();
    // Continue the copy through the same remaining rounds' worth of idle time and compare the fleets with a fresh run of the original.
    const a = deserialize(serialize(copy as Sim), content);
    for (let i = 0; i < TIME_TURN_TICKS * 3; i++) {
      (copy as Sim).step();
      a.step();
    }
    expect(a.galaxy.fleets).toEqual((copy as Sim).galaxy.fleets);
    expect(a.galaxy.encounters).toEqual((copy as Sim).galaxy.encounters);
  }, 240000);
});
