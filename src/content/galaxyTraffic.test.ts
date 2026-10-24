import { describe, expect, it } from 'vitest';
import {
  CombatC, FTL_CHARGE_SEC, START_NODE, ShipC, galaxyIndex, newGame, playerShip, passingMeets, incomingFleets, TICK_HZ, type Sim,
} from '../sim';
import { crossingOf, encounterKind } from '../sim/galaxy/encounters';
import { stepFleets } from '../sim/galaxy/fleets';
import { TIME_TURN_TICKS, takeHopTurn, tickTurnClock } from '../sim/galaxy/turn';
import { PASSING_ENCOUNTER_CHANCE, TURN_SEC } from '../sim/galaxy/tuning';
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
    node, from: node, moved: -1, route: [], dest: node, dwell: 99, legs: 0, home: `${START_NODE}#0`, synced: g.turn, ...over,
  };
  g.fleets.push(f);
  return f;
}
const clear = (sim: Sim) => {
  sim.galaxy.fleets = [];
};

describe('turn clock', () => {
  it('three minutes of active game time are one turn, and the clock restarts', () => {
    expect(TURN_SEC).toBe(180);
    expect(TIME_TURN_TICKS).toBe(TURN_SEC * TICK_HZ);
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
    while (sim.sector.state === 'hyperspace' && (sim.galaxy.travel?.phase === 'hop' || sim.galaxy.travel?.phase === 'story')) { step(sim); sim.story.active = null; }
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

describe('fleets in the player\'s node', () => {
  it('a fleet arriving materialises its ships; leaving lifts them out; no duplicates across leave and return', () => {
    const sim = newGame(24, content);
    clear(sim);
    const next = adjacent(sim, START_NODE)[0] as string;
    const f = fleet(sim, next, { route: [START_NODE], dest: START_NODE, dwell: 0 });
    sim.galaxy.turn = 1;
    stepFleets(sim, 1);
    expect(f.node).toBe(START_NODE);
    expect(f.ships[0]?.ship).toBeDefined();
    const id = f.ships[0]?.ship as number;
    expect(sim.world.get(id, ShipC)?.gen).toMatchObject({ seed: 77 });
    expect(others(sim)).toEqual([id]);
    // It rests, then leaves: the ship is lifted out of the sector.
    f.dwell = 0;
    f.route = [next];
    stepFleets(sim, 2);
    expect(f.node).toBe(next);
    expect(f.ships[0]?.ship).toBeUndefined();
    expect(others(sim)).toEqual([]);
    expect(sim.world.get(id, ShipC)).toBeUndefined();
    // Back, then the player leaves with it still here: the archive holds no fleet ship, and coming back materialises it once.
    f.route = [START_NODE];
    f.dwell = 0;
    stepFleets(sim, 3);
    expect(others(sim).length).toBe(1);
    f.dwell = 99;
    charge(sim);
    giveItems(sim, 'item.fuel', 50);
    sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [next] });
    step(sim);
    expect(sim.galaxy.travel).not.toBeNull();
    expect(f.node).toBe(START_NODE);
    expect(f.ships[0]?.ship).toBeUndefined();
    expect(others(sim)).toEqual([]);
    const archive = sim.archives.find((a) => a.node === START_NODE);
    expect(archive?.entities.some((e) => (e.c as Record<string, { faction?: string }>).ShipC?.faction === 'traders')).toBe(false);
    while (['hop', 'story'].includes((sim.galaxy.travel as { phase: string } | null)?.phase ?? '')) { step(sim); sim.story.active = null; }
    sim.enqueue({ type: 'galaxy.drop' });
    step(sim);
    deploy(sim);
    expect(sim.galaxy.current).toBe(next);
    expect(others(sim)).toEqual([]);
    charge(sim);
    giveItems(sim, 'item.fuel', 50);
    sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [START_NODE] });
    step(sim);
    while (['hop', 'story'].includes((sim.galaxy.travel as { phase: string } | null)?.phase ?? '')) { step(sim); sim.story.active = null; }
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
    id: 1, faction: 'traders', role: 'trader', ships: [], node: 'B', from: 'B', moved: -1, route: [], dest: 'B', dwell: 0, legs: 0, home: 'B#0', synced: 0, ...over,
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
  function hopWith(seed: number, make: (to: string, from: string) => Partial<Fleet>, faction: string, role: Fleet['role'], passes = true) {
    const sim = newGame(seed, content);
    clear(sim);
    giveItems(sim, 'item.fuel', 50);
    charge(sim);
    const to = adjacent(sim, START_NODE)[0] as string;
    const next = adjacent(sim, to).find((n) => n !== START_NODE) ?? START_NODE;
    sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [to, next] });
    sim.galaxy.turn = 0;
    // Place the fleet so that it makes its move at this turn: stepping happens in takeHopTurn, so set it up to step.
    // A passing non-hostile fleet only meets the player on a lucky roll: pick fleet ids by it (`passes`), or by a miss.
    while (passingMeets(sim, sim.galaxy.nextFleet, sim.galaxy.turn + 1) !== passes) sim.galaxy.nextFleet++;
    const f = fleet(sim, to, { faction, role, ...make(to, START_NODE), dwell: 0 });
    const events = step(sim, 1);
    while ((sim.galaxy.travel?.phase === 'hop' || sim.galaxy.travel?.phase === 'story')) { events.push(...step(sim)); sim.story.active = null; }
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

  it('most non-hostile crossings mean nothing: no encounter, though the crossing is still reported', () => {
    const r = hopWith(27, () => ({ route: [START_NODE], dest: START_NODE }), 'traders', 'trader', false);
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'galaxy.crossing', how: 'pass' }));
    expect(r.events.some((e) => e.type === 'galaxy.encounter')).toBe(false);
    expect(r.sim.galaxy.encounters).toHaveLength(0);
    expect(r.sim.galaxy.jumps).toBe(2);
  }, 60000);

  it('the chance of a passing hail or scan is about PASSING_ENCOUNTER_CHANCE', () => {
    const sim = newGame(27, content);
    let n = 0;
    for (let id = 0; id < 4000; id++) if (passingMeets(sim, id, 5)) n++;
    expect(n / 4000).toBeGreaterThan(PASSING_ENCOUNTER_CHANCE - 0.03);
    expect(n / 4000).toBeLessThan(PASSING_ENCOUNTER_CHANCE + 0.03);
  });

  it('a fleet is not met again within the cooldown', () => {
    const r = hopWith(27, () => ({ route: [START_NODE], dest: START_NODE }), 'traders', 'trader');
    const n = r.events.filter((e) => e.type === 'galaxy.encounter').length;
    expect(n).toBe(1);
  }, 60000);
});

describe('incoming fleets (arrival warnings)', () => {
  /** A start node, a neighbour `a` and a node `b` beyond it that is not the start. */
  function chain(seed: number) {
    const sim = newGame(seed, content);
    clear(sim);
    const a = adjacent(sim, START_NODE)[0] as string;
    const b = adjacent(sim, a).find((n) => n !== START_NODE) as string;
    return { sim, a, b };
  }

  it('lists fleets whose route reaches the player\'s node, with the hops left as the ETA, nearest first', () => {
    const { sim, a, b } = chain(31);
    const far = fleet(sim, b, { route: [a, START_NODE], dest: START_NODE });
    const near = fleet(sim, a, { route: [START_NODE], dest: START_NODE, faction: 'pirates', role: 'pirate' });
    const list = incomingFleets(sim);
    expect(list.map((i) => [i.fleet, i.eta, i.stops])).toEqual([[near.id, 1, true], [far.id, 2, true]]);
    expect(list[0]?.hostile).toBe(true);
    expect(list[1]?.hostile).toBe(false);
  }, 60000);

  it('warns of nothing while the player is inside an event grid', () => {
    const { sim, a } = chain(31);
    fleet(sim, a, { route: [START_NODE], dest: START_NODE });
    expect(incomingFleets(sim)).toHaveLength(1);
    sim.galaxy.event = { id: 1, node: 'event:1' } as never;
    expect(incomingFleets(sim)).toEqual([]);
  }, 60000);

  it('ignores fleets heading elsewhere, stranded ones and ones beyond sensor range; counts a pass-through with stops=false', () => {
    const { sim, a, b } = chain(31);
    fleet(sim, a, { route: [b], dest: b });
    fleet(sim, a, { route: [START_NODE], dest: START_NODE, damaged: true });
    expect(incomingFleets(sim)).toEqual([]);
    const through = fleet(sim, b, { route: [a, START_NODE, a], dest: a });
    expect(incomingFleets(sim).map((i) => [i.fleet, i.eta, i.stops])).toEqual([[through.id, 2, false]]);
    through.node = 'nowhere.far';
    expect(incomingFleets(sim)).toEqual([]);
  }, 60000);

  it('the ETA shrinks as turns pass and the fleet leaves the list when it arrives', () => {
    const { sim, a, b } = chain(31);
    const f = fleet(sim, b, { route: [a, START_NODE], dest: START_NODE, dwell: 0 });
    expect(incomingFleets(sim)[0]?.eta).toBe(2);
    stepFleets(sim, 1);
    expect(f.node).toBe(a);
    expect(incomingFleets(sim)[0]?.eta).toBe(1);
    stepFleets(sim, 2);
    expect(f.node).toBe(START_NODE);
    expect(incomingFleets(sim)).toEqual([]);
  }, 60000);
});
