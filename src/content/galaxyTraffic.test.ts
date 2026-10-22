import { describe, expect, it } from 'vitest';
import {
  CombatC, FTL_CHARGE_SEC, START_NODE, ShipC, deserialize, galaxyIndex, newGame, playerShip, serialize, visibleFleets, type Sim,
} from '../sim';
import { crossingOf, encounterKind } from '../sim/galaxy/encounters';
import { stepFleets } from '../sim/galaxy/fleets';
import { TIME_TURN_TICKS, onTurn, takeHopTurn, tickTurnClock } from '../sim/galaxy/turn';
import { FLEET_CAP } from '../sim/galaxy/tuning';
import type { Fleet } from '../sim/galaxy/types';
import { giveItems } from '../sim/story/effects';
import { content } from '.';

const step = (sim: Sim, n = 1) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
const deploy = (sim: Sim) => {
  for (const [x, y] of [[100, 60], [20, 50], [300, 200], [40, 150], [200, 20], [350, 100]] as const) {
    sim.enqueue({ type: 'sector.deploy', x, y });
    step(sim);
    if (sim.sector.state === 'active') break;
  }
};
const adjacent = (sim: Sim, id: string): string[] =>
  (galaxyIndex(sim.galaxy).adjacent.get(id) ?? []).map((e) => (e.a === id ? e.b : e.a)).sort();
const charge = (sim: Sim) => {
  const c = sim.world.get(playerShip(sim), CombatC);
  if (c) c.ftl = FTL_CHARGE_SEC;
};
const others = (sim: Sim) => sim.world.query(ShipC).filter((id) => sim.world.get(id, ShipC)?.faction !== 'player');
/** A hand-made fleet of `faction` with one ship, parked at `node`. */
function fleet(sim: Sim, node: string, over: Partial<Fleet> = {}): Fleet {
  const g = sim.galaxy;
  const f: Fleet = {
    id: g.nextFleet++, faction: 'traders', role: 'trader', ships: [{ id: g.nextFleet++, faction: 'traders', shipgen: 'faction.civilian', seed: 77, depth: 1, since: 0 }],
    node, from: node, moved: -1, route: [], dest: node, dwell: 99, ttl: 99, ...over,
  };
  g.fleets.push(f);
  return f;
}
const clear = (sim: Sim) => {
  sim.galaxy.fleets = [];
};

describe('turn clock', () => {
  it('a minute of active game time is one turn, and the clock restarts', () => {
    const sim = newGame(21, content);
    clear(sim);
    step(sim, TIME_TURN_TICKS - 1);
    expect(sim.galaxy.turn).toBe(0);
    const ev = step(sim);
    expect(sim.galaxy.turn).toBe(1);
    expect(ev).toContainEqual({ type: 'galaxy.turn', turn: 1, cause: 'time' });
    step(sim, TIME_TURN_TICKS);
    expect(sim.galaxy.turn).toBe(2);
  });

  it('a hop resets the clock; no time turn fires for the same stretch; deploy resets it too', () => {
    const sim = newGame(21, content);
    clear(sim);
    step(sim, TIME_TURN_TICKS - 50);
    giveItems(sim, 'item.fuel', 50);
    charge(sim);
    sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [adjacent(sim, START_NODE)[0] as string] });
    step(sim);
    expect(sim.galaxy.turn).toBe(1);
    expect(sim.galaxy.turnClock).toBe(0);
    // Hyperspace and deploying do not run the clock.
    while (sim.sector.state === 'hyperspace' && sim.galaxy.travel?.phase === 'hop') step(sim);
    sim.enqueue({ type: 'galaxy.drop' });
    step(sim, 3);
    step(sim, 2000);
    expect(sim.galaxy.turn).toBe(1);
    sim.galaxy.turnClock = 500;
    deploy(sim);
    expect(sim.sector.state).toBe('active');
    expect(sim.galaxy.turnClock).toBeLessThan(5);
    step(sim, TIME_TURN_TICKS - 10);
    expect(sim.galaxy.turn).toBe(1);
    step(sim, 20);
    expect(sim.galaxy.turn).toBe(2);
  }, 60000);

  it('hop and time turns share one counter and both call onTurn', () => {
    const sim = newGame(21, content);
    clear(sim);
    takeHopTurn(sim);
    sim.galaxy.turnClock = TIME_TURN_TICKS - 1;
    tickTurnClock(sim);
    expect(sim.galaxy.turn).toBe(2);
    expect(sim.events.drain().filter((e) => e.type === 'galaxy.turn')).toEqual([{ type: 'galaxy.turn', turn: 1 }, { type: 'galaxy.turn', turn: 2, cause: 'time' }]);
  });
});

describe('fleets', () => {
  it('a new game has traffic within the cap, never at the start node, all in generated chunks', () => {
    const sim = newGame(22, content);
    expect(sim.galaxy.fleets.length).toBeGreaterThan(3);
    expect(sim.galaxy.fleets.length).toBeLessThanOrEqual(FLEET_CAP);
    const index = galaxyIndex(sim.galaxy);
    for (const f of sim.galaxy.fleets) {
      expect(f.node).not.toBe(START_NODE);
      expect(index.nodes.has(f.node)).toBe(true);
      for (const n of f.route) expect(index.nodes.has(n)).toBe(true);
    }
    expect(others(sim)).toEqual([]); // data only
  });

  it('moves one hop per turn along its route, and is deterministic', () => {
    const run = () => {
      const sim = newGame(22, content);
      for (let t = 1; t <= 30; t++) {
        const before = new Map(sim.galaxy.fleets.map((f) => [f.id, f.node]));
        sim.galaxy.turn = t;
        onTurn(sim, t);
        for (const f of sim.galaxy.fleets) {
          const was = before.get(f.id);
          if (was !== undefined && f.node !== was) expect(adjacent(sim, was)).toContain(f.node);
        }
      }
      return JSON.stringify(sim.galaxy.fleets);
    };
    expect(run()).toBe(run());
  });

  it('saves and loads mid-route and carries on identically', () => {
    const a = newGame(23, content);
    for (let t = 1; t <= 8; t++) onTurn(a, (a.galaxy.turn = t));
    const b = deserialize(serialize(a), content);
    expect(b.galaxy.fleets).toEqual(a.galaxy.fleets);
    for (let t = 9; t <= 20; t++) {
      onTurn(a, (a.galaxy.turn = t));
      onTurn(b, (b.galaxy.turn = t));
    }
    expect(b.galaxy.fleets).toEqual(a.galaxy.fleets);
    expect(b.galaxy.encounters).toEqual(a.galaxy.encounters);
  });

  it('shows only fleets within sensor range', () => {
    const sim = newGame(22, content);
    const far = fleet(sim, [...galaxyIndex(sim.galaxy).nodes.keys()].sort().pop() as string);
    const near = fleet(sim, adjacent(sim, START_NODE)[0] as string);
    const seen = visibleFleets(sim).map((f) => f.id);
    expect(seen).toContain(near.id);
    expect(seen).not.toContain(far.id);
  });
});

describe('fleets in the player\'s node', () => {
  it('a fleet arriving materialises its ships; leaving lifts them out; no duplicates across leave and return', () => {
    const sim = newGame(24, content);
    clear(sim);
    const next = adjacent(sim, START_NODE)[0] as string;
    const f = fleet(sim, next, { route: [START_NODE], dest: START_NODE, dwell: 0 });
    sim.galaxy.turn = 1;
    stepFleets(sim, 1);
    sim.galaxy.fleets = [f]; // drop the random traffic the step spawned
    expect(f.node).toBe(START_NODE);
    expect(f.ships[0]?.ship).toBeDefined();
    const id = f.ships[0]?.ship as number;
    expect(sim.world.get(id, ShipC)?.gen).toMatchObject({ seed: 77 });
    expect(others(sim)).toEqual([id]);
    // It rests, then leaves: the ship is lifted out of the sector.
    f.dwell = 0;
    f.route = [next];
    stepFleets(sim, 2);
    sim.galaxy.fleets = [f];
    expect(f.node).toBe(next);
    expect(f.ships[0]?.ship).toBeUndefined();
    expect(others(sim)).toEqual([]);
    expect(sim.world.get(id, ShipC)).toBeUndefined();
    // Back, then the player leaves with it still here: the archive holds no fleet ship, and coming back materialises it once.
    f.route = [START_NODE];
    f.dwell = 0;
    stepFleets(sim, 3);
    sim.galaxy.fleets = [f];
    expect(others(sim).length).toBe(1);
    f.dwell = 99;
    charge(sim);
    giveItems(sim, 'item.fuel', 50);
    sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [next] });
    step(sim);
    sim.galaxy.fleets = [f];
    expect(sim.galaxy.travel).not.toBeNull();
    expect(f.node).toBe(START_NODE);
    expect(f.ships[0]?.ship).toBeUndefined();
    expect(others(sim)).toEqual([]);
    const archive = sim.archives.find((a) => a.node === START_NODE);
    expect(archive?.entities.some((e) => (e.c as Record<string, { faction?: string }>).ShipC?.faction === 'traders')).toBe(false);
    while ((sim.galaxy.travel as { phase: string } | null)?.phase === 'hop') step(sim);
    sim.enqueue({ type: 'galaxy.drop' });
    step(sim);
    deploy(sim);
    expect(sim.galaxy.current).toBe(next);
    expect(others(sim)).toEqual([]);
    sim.galaxy.fleets = [f];
    charge(sim);
    giveItems(sim, 'item.fuel', 50);
    sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [START_NODE] });
    step(sim);
    sim.galaxy.fleets = [f];
    while ((sim.galaxy.travel as { phase: string } | null)?.phase === 'hop') step(sim);
    sim.enqueue({ type: 'galaxy.drop' });
    step(sim);
    // Back at the start: its archive returns and the fleet's ship appears once (from the descriptor, not the archive).
    expect(sim.galaxy.current).toBe(START_NODE);
    expect(others(sim).length).toBe(1);
    expect(others(sim)[0]).toBe(f.ships[0]?.ship);
  }, 60000);

  it('a fleet in the node holds while there is a fight', () => {
    const sim = newGame(24, content);
    clear(sim);
    const f = fleet(sim, START_NODE, { route: [adjacent(sim, START_NODE)[0] as string], dwell: 0 });
    sim.sector.inCombat = true;
    stepFleets(sim, 1);
    expect(f.node).toBe(START_NODE);
    sim.sector.inCombat = false;
    stepFleets(sim, 2);
    expect(f.node).not.toBe(START_NODE);
  });
});

describe('crossings and encounters', () => {
  const base = (over: Partial<Fleet>): Fleet => ({
    id: 1, faction: 'traders', role: 'trader', ships: [], node: 'B', from: 'B', moved: -1, route: [], dest: 'B', dwell: 0, ttl: 5, ...over,
  });
  it('detects opposite directions and overlapping segments on a lane, and meeting in a node', () => {
    expect(crossingOf(base({ from: 'B', node: 'A', moved: 4 }), 'A', 'B', 4)).toBe('pass');
    expect(crossingOf(base({ from: 'A', node: 'B', moved: 4 }), 'A', 'B', 4)).toBe('overlap');
    expect(crossingOf(base({ from: 'C', node: 'B', moved: 4 }), 'A', 'B', 4)).toBe('node');
    expect(crossingOf(base({ node: 'B' }), 'A', 'B', 4)).toBe('node'); // resting there
    expect(crossingOf(base({ from: 'B', node: 'A', moved: 3 }), 'A', 'B', 4)).toBeNull(); // a move of another turn
    expect(crossingOf(base({ from: 'C', node: 'D', moved: 4 }), 'A', 'B', 4)).toBeNull();
    expect(crossingOf(base({ from: 'A', node: 'C', moved: 4 }), 'A', 'B', 4)).toBeNull(); // shared start only
  });

  it('picks the encounter kind from faction and role', () => {
    const sim = newGame(25, content);
    expect(encounterKind(sim, base({ faction: 'pirates', role: 'pirate' }))).toBe('interdict');
    expect(encounterKind(sim, base({ faction: 'rogue', role: 'raider' }))).toBe('interdict');
    expect(encounterKind(sim, base({ faction: 'traders', role: 'trader' }))).toBe('hail');
    expect(encounterKind(sim, base({ faction: 'navy', role: 'patrol' }))).toBe('scan');
    expect(encounterKind(sim, base({ faction: 'traders', role: 'trader', damaged: true }))).toBe('distress');
    // A pirate faction the player has made friends with only hails.
    sim.story.reputation.pirates = 20;
    expect(encounterKind(sim, base({ faction: 'pirates', role: 'pirate' }))).toBe('hail');
  });

  /** Fly one hop to `to`, with `f` set up to cross it, and report the result. */
  function hopWith(seed: number, make: (to: string, from: string) => Partial<Fleet>, faction: string, role: Fleet['role']) {
    const sim = newGame(seed, content);
    clear(sim);
    giveItems(sim, 'item.fuel', 50);
    charge(sim);
    const to = adjacent(sim, START_NODE)[0] as string;
    const next = adjacent(sim, to).find((n) => n !== START_NODE) ?? START_NODE;
    sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [to, next] });
    sim.galaxy.turn = 0;
    // Place the fleet so that it makes its move at this turn: stepping happens in takeHopTurn, so set it up to step.
    const f = fleet(sim, to, { faction, role, ...make(to, START_NODE), dwell: 0 });
    const events = step(sim, 1);
    while (sim.galaxy.travel?.phase === 'hop') events.push(...step(sim));
    return { sim, f, events, to, next };
  }

  it('a pirate on the lane the player flies interdicts: the ship halts in hyperspace at the node and the encounter waits', () => {
    // The pirates start at `to` and fly to START_NODE: they pass the player on the lane.
    const r = hopWith(26, () => ({ route: [START_NODE], dest: START_NODE }), 'pirates', 'pirate');
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'galaxy.crossing', how: 'pass' }));
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'galaxy.encounter', kind: 'interdict' }));
    expect(r.sim.galaxy.encounters).toHaveLength(1);
    expect(r.sim.galaxy.encounters[0]).toMatchObject({ kind: 'interdict', node: r.to, how: 'pass' });
    // The trip stopped at the first node, though the route had another hop; the ship waits in hyperspace.
    expect(r.sim.sector.state).toBe('hyperspace');
    expect(r.sim.galaxy.travel?.phase).toBe('interdicted');
    expect(r.sim.galaxy.current).toBe(r.to);
    expect(r.sim.galaxy.jumps).toBe(1);
  }, 60000);

  it('while an interdiction is pending the ship cannot drop or jump; once resolved the trip goes on', () => {
    const r = hopWith(26, () => ({ route: [START_NODE], dest: START_NODE }), 'pirates', 'pirate');
    const sim = r.sim;
    sim.enqueue({ type: 'galaxy.drop' });
    expect(step(sim)).toContainEqual({ type: 'command.rejected', command: 'galaxy.drop', reason: 'interdicted' });
    sim.enqueue({ type: 'galaxy.respond', encounter: sim.galaxy.encounters[0]?.id as number, choice: 'acknowledge' });
    expect(step(sim)).toContainEqual(expect.objectContaining({ type: 'command.rejected', reason: 'badChoice' }));
    sim.galaxy.encounters[0]!.strength = 0.1; // cheap enough to pay for
    sim.trade.credits = 500;
    sim.enqueue({ type: 'galaxy.respond', encounter: sim.galaxy.encounters[0]?.id as number, choice: 'bribe' });
    step(sim);
    expect(sim.galaxy.encounters).toHaveLength(0);
    expect(sim.galaxy.travel?.phase).toBe('hop');
    expect(sim.galaxy.travel?.route[sim.galaxy.travel.at]).toBe(r.to);
  }, 60000);

  it('a trader crossing the player only hails: an alert encounter, travel goes on', () => {
    const r = hopWith(27, () => ({ route: [START_NODE], dest: START_NODE }), 'traders', 'trader');
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'galaxy.encounter', kind: 'hail' }));
    expect(r.sim.galaxy.jumps).toBe(2);
    expect(r.sim.galaxy.encounters.every((e) => e.kind !== 'interdict')).toBe(true);
  }, 60000);

  it('a fleet is not met again within the cooldown', () => {
    const r = hopWith(27, () => ({ route: [START_NODE], dest: START_NODE }), 'traders', 'trader');
    const n = r.events.filter((e) => e.type === 'galaxy.encounter').length;
    expect(n).toBe(1);
  }, 60000);
});
