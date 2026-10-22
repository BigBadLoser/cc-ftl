import { describe, expect, it } from 'vitest';
import { CombatC, FTL_CHARGE_SEC, deserialize, galaxyIndex, newGame, playerShip, serialize, type Sim } from '../sim';
import { ensureAround } from '../sim/galaxy/state';
import { giveItems } from '../sim/story/effects';
import { content } from '.';

/** A scripted trip: teleport to a dangerous node, stay a while (arrivals roll), jump home along real edges, stay again. */
function trip(seed: number): Sim {
  const sim = newGame(seed, content);
  ensureAround(sim, 's.12.0.n0');
  const far = [...galaxyIndex(sim.galaxy).nodes.values()].filter((n) => n.danger >= 4 && n.contacts.length > 0).sort((a, b) => (a.id < b.id ? -1 : 1))[0]!;
  const run = (n: number): void => {
    for (let i = 0; i < n; i++) sim.step();
  };
  const deploy = (): void => {
    sim.enqueue({ type: 'sector.deploy', x: 100, y: 60 });
    run(1);
  };
  sim.enqueue({ type: 'debug.galaxyTeleport', node: far.id });
  run(1);
  deploy();
  run(20 * 130);
  // Hop to a neighbour and back along real edges.
  const next = galaxyIndex(sim.galaxy).adjacent.get(far.id)![0]!;
  for (const to of [next.a === far.id ? next.b : next.a, far.id]) {
    giveItems(sim, 'item.fuel', 40);
    const c = sim.world.get(playerShip(sim), CombatC);
    if (c) c.ftl = FTL_CHARGE_SEC;
    sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), to });
    run(1);
    deploy();
    run(20 * 70);
  }
  return sim;
}

describe('galaxy trips', () => {
  it('are deterministic, and a save taken mid-trip continues identically', () => {
    const a = trip(21);
    const b = trip(21);
    expect(serialize(a)).toBe(serialize(b));
    expect(a.galaxy.current).toBe(b.galaxy.current);
    expect(a.archives.length).toBeGreaterThanOrEqual(2);
    const c = deserialize(serialize(a), content);
    for (let i = 0; i < 400; i++) {
      a.step();
      c.step();
    }
    expect(serialize(c)).toBe(serialize(a));
  }, 120000);
});
