import { describe, expect, it } from 'vitest';
import { CombatC, FTL_CHARGE_SEC, START_NODE, ShipC, galaxyIndex, newGame, playerShip, serialize, type Sim } from '../sim';
import type { Fleet } from '../sim/galaxy/types';
import { giveItems } from '../sim/story/effects';
import { content } from '.';

const step = (sim: Sim, n = 1) => {
  for (let i = 0; i < n; i++) {
    sim.step();
    sim.events.drain();
  }
};
const isActive = (sim: Sim): boolean => sim.sector.state === 'active';
const hopping = (sim: Sim): boolean => sim.galaxy.travel?.phase === 'hop';
const deploy = (sim: Sim) => {
  for (let y = 4; y < 100 && !isActive(sim); y += 8) {
    for (let x = 4; x < 160 && !isActive(sim); x += 8) {
      sim.enqueue({ type: 'sector.deploy', x, y });
      step(sim);
    }
  }
  expect(isActive(sim)).toBe(true);
};
const adjacent = (sim: Sim, id: string): string[] =>
  (galaxyIndex(sim.galaxy).adjacent.get(id) ?? []).map((e) => (e.a === id ? e.b : e.a)).sort();

/** A whole interdiction scenario for one seed and choice, returning the final state hash. */
function run(seed: number, choice: 'evade' | 'bribe' | 'fight', leave: 'wipe' | 'flee'): string {
  const sim = newGame(seed, content);
  sim.story.goals.skipped = true; // opening grace off: these tests interdict at the danger-0 start
  const g = sim.galaxy;
  g.fleets = [];
  giveItems(sim, 'item.fuel', 80);
  sim.trade.credits = 100000;
  const c = sim.world.get(playerShip(sim), CombatC);
  if (c) c.ftl = FTL_CHARGE_SEC;
  const to = adjacent(sim, START_NODE)[0] as string;
  const next = adjacent(sim, to).find((n) => n !== START_NODE) ?? START_NODE;
  sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [to, next] });
  const f: Fleet = {
    id: g.nextFleet++, faction: 'pirates', role: 'pirate', ships: [1, 2].map((i) => ({ id: g.nextFleet++, faction: 'pirates', shipgen: 'faction.scrapper', seed: seed * 7 + i, depth: 1, since: 0 })),
    node: to, from: to, moved: -1, route: [START_NODE], dest: START_NODE, dwell: 0, legs: 0, home: `${START_NODE}#0`, synced: g.turn,
  };
  g.fleets.push(f);
  step(sim);
  while (hopping(sim)) step(sim);
  expect(g.encounters[0]?.kind).toBe('interdict');
  sim.enqueue({ type: 'galaxy.respond', encounter: g.encounters[0]!.id, choice });
  step(sim);
  if (g.event) {
    deploy(sim);
    step(sim, 60);
    if (leave === 'wipe') {
      for (const id of sim.world.query(ShipC)) {
        const s = sim.world.get(id, ShipC);
        if (s && s.faction !== 'player') s.state = 'wreck';
      }
      step(sim, 5);
      sim.enqueue({ type: 'galaxy.leaveEvent' });
    } else {
      const me = sim.world.get(playerShip(sim), CombatC);
      if (me) me.ftl = FTL_CHARGE_SEC;
      sim.enqueue({ type: 'combat.flee', ship: playerShip(sim) });
    }
    sim.step();
    const evs = sim.events.drain();
    expect(evs.filter((e) => e.type === 'command.rejected'), `${choice} ${leave} seed ${seed}`).toEqual([]);
    expect(g.event).toBeNull();
    expect(sim.world.ids()).toHaveLength(0);
  }
  while (hopping(sim)) step(sim);
  expect(g.current).toBe(next);
  expect(sim.archives.some((a) => a.node.startsWith('event:'))).toBe(false);
  expect(g.nodes[`event:${0}`]).toBeUndefined();
  return serialize(sim);
}

describe('encounter sweep', () => {
  it('every choice over several seeds ends at the destination with nothing left of the grid, and is deterministic', () => {
    for (let seed = 1; seed <= 3; seed++) { // three worlds x four choice paths, each run twice for determinism
      for (const [choice, leave] of [['evade', 'wipe'], ['bribe', 'wipe'], ['fight', 'wipe'], ['fight', 'flee']] as const) {
        const a = run(seed, choice, leave);
        expect(run(seed, choice, leave)).toBe(a);
      }
    }
  }, 240000);
});
