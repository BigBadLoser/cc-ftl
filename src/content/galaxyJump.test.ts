import { describe, expect, it } from 'vitest';
import {
  CombatC, FTL_CHARGE_SEC, START_NODE, ShipC, deserialize, fuelStock, galaxyIndex, hopTicksOf, newGame, playerShip, routeEdges, serialize, type Sim,
} from '../sim';
import { buildCombat } from '../app/combatSnapshot';
import { ensureAround } from '../sim/galaxy/state';
import { giveItems, takeItems } from '../sim/story/effects';
import { content } from '.';

const step = (sim: Sim, n = 1) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
/** Deploy at the first of a few spots the gap rule accepts (a node's own ships may be in the way of some). */
const deploy = (sim: Sim) => {
  const out = [];
  for (const [x, y] of [[100, 60], [20, 50], [300, 200], [40, 150], [200, 20], [350, 100]] as const) {
    sim.enqueue({ type: 'sector.deploy', x, y });
    out.push(...step(sim));
    if (sim.sector.state === 'active') break;
  }
  return out;
};
const neighbour = (sim: Sim, id: string, k = 0): string => {
  const edges = galaxyIndex(sim.galaxy).adjacent.get(id) ?? [];
  return edges.map((e) => (e.a === id ? e.b : e.a)).sort()[k] as string;
};
/** A route of `hops` nodes from the start that never doubles back. */
function routeOf(sim: Sim, hops: number): string[] {
  const route = [START_NODE];
  for (let h = 0; h < hops; h++) {
    const here = route[route.length - 1] as string;
    const next = (galaxyIndex(sim.galaxy).adjacent.get(here) ?? []).map((e) => (e.a === here ? e.b : e.a)).sort().find((n) => !route.includes(n));
    if (!next) break;
    route.push(next);
  }
  return route.slice(1);
}
const charge = (sim: Sim) => {
  const c = sim.world.get(playerShip(sim), CombatC);
  if (c) c.ftl = FTL_CHARGE_SEC;
};
const jump = (sim: Sim, route: string[], extra: { withDocked?: number[] } = {}) => sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route, ...extra });
/** Run until the current hop ends. */
function untilStops(sim: Sim, max = 90000): void {
  for (let i = 0; i < max && sim.sector.state === 'hyperspace' && sim.galaxy.travel?.phase === 'hop'; i++) sim.step();
}
/** The first node (by id) of a danger tier with generated contacts. */
function nodeWithContacts(sim: Sim, minDanger: number): string {
  ensureAround(sim, 's.12.0.n0');
  const node = [...galaxyIndex(sim.galaxy).nodes.values()].filter((n) => n.danger >= minDanger && n.contacts.length > 0).sort((a, b) => (a.id < b.id ? -1 : 1))[0];
  if (!node) throw new Error('no node with contacts');
  return node.id;
}
/** Ships in the sector that are not the player's. */
const others = (sim: Sim) => sim.world.query(ShipC).filter((id) => sim.world.get(id, ShipC)?.faction !== 'player');

describe('hyperspace travel', () => {
  it('pays the charge once and each hop\'s fuel as it is entered, passing nodes in order', () => {
    const sim = newGame(11, content);
    const route = routeOf(sim, 3);
    expect(route.length).toBe(3);
    const edges = routeEdges(sim, [START_NODE, ...route])!;
    charge(sim);
    giveItems(sim, 'item.fuel', 100);
    const fuel0 = fuelStock(sim);
    jump(sim, route);
    const entry = step(sim);
    expect(entry).toContainEqual({ type: 'galaxy.hyperspace', ship: expect.any(Number), route: [START_NODE, ...route], charge: Math.max(...edges.map((e) => e.charge)) });
    expect(sim.sector.state).toBe('hyperspace');
    expect(sim.galaxy.current).toBe(START_NODE);
    // Only the first hop is paid on entry (the fuel is read from the packet in hyperspace).
    expect(fuelStock(sim)).toBe(fuel0 - edges[0]!.fuel);
    const seen: string[] = [];
    const turns: number[] = [];
    for (let i = 0; i < 90000 && sim.galaxy.travel?.phase === 'hop'; i++) {
      sim.step();
      for (const e of sim.events.drain()) {
        if (e.type === 'galaxy.jumped') seen.push(e.to);
        if (e.type === 'galaxy.turn') turns.push(e.turn);
      }
    }
    expect(seen).toEqual(route);
    expect(sim.galaxy.current).toBe(route[2]);
    expect(sim.galaxy.travel).toMatchObject({ phase: 'arrived', at: 3 });
    expect(fuelStock(sim)).toBe(fuel0 - edges.reduce((t, e) => t + e.fuel, 0));
    expect(sim.sector.node).toBe(route[2]);
    // Turn-based: one turn per hop entered, the hook ran once per hop, and a hop's pace does not depend on its days.
    expect(sim.galaxy.turn).toBe(3);
    expect(turns).toEqual([2, 3]); // the first turn came with the entry events above
    expect(entry.filter((e) => e.type === 'galaxy.turn')).toEqual([{ type: 'galaxy.turn', turn: 1 }]);
    expect(hopTicksOf()).toBe(16);
  }, 60000);

  it('stops at the last node it reached when the next hop cannot be paid, and waits there', () => {
    const sim = newGame(11, content);
    const route = routeOf(sim, 3);
    const edges = routeEdges(sim, [START_NODE, ...route])!;
    charge(sim);
    takeItems(sim, 'item.fuel', fuelStock(sim));
    giveItems(sim, 'item.fuel', edges[0]!.fuel + edges[1]!.fuel); // two hops of fuel
    jump(sim, route);
    step(sim);
    untilStops(sim);
    expect(sim.galaxy.travel).toMatchObject({ phase: 'noFuel', at: 2 });
    expect(sim.galaxy.turn).toBe(2); // only hops that were entered count
    expect(sim.galaxy.current).toBe(route[1]);
    expect(sim.sector.state).toBe('hyperspace');
    expect(fuelStock(sim)).toBe(0);
    // It waits: no further progress.
    step(sim, 400);
    expect(sim.galaxy.current).toBe(route[1]);
  }, 60000);

  it('rejects a route without a first hop of fuel, without charge or off the graph, paying nothing', () => {
    const sim = newGame(12, content);
    const route = routeOf(sim, 2);
    const ship = playerShip(sim);
    sim.enqueue({ type: 'galaxy.jump', ship, route });
    expect(step(sim)).toContainEqual({ type: 'command.rejected', command: 'galaxy.jump', reason: 'notCharged' });
    charge(sim);
    const fuel = fuelStock(sim);
    takeItems(sim, 'item.fuel', fuel);
    sim.enqueue({ type: 'galaxy.jump', ship, route });
    expect(step(sim)).toContainEqual({ type: 'command.rejected', command: 'galaxy.jump', reason: 'noFuel' });
    giveItems(sim, 'item.fuel', fuel);
    sim.enqueue({ type: 'galaxy.jump', ship, route: [route[1] as string] }); // not joined to where we are
    expect(step(sim)).toContainEqual({ type: 'command.rejected', command: 'galaxy.jump', reason: 'noRoute' });
    sim.enqueue({ type: 'galaxy.jump', ship: ship + 999, route });
    expect(step(sim)).toContainEqual({ type: 'command.rejected', command: 'galaxy.jump', reason: 'notPlayerShip' });
    expect(sim.world.get(ship, CombatC)!.ftl).toBe(FTL_CHARGE_SEC);
    expect(fuelStock(sim)).toBe(fuel);
    expect([sim.sector.state, sim.galaxy.current, sim.galaxy.travel, sim.archives.length]).toEqual(['active', START_NODE, null, 0]);
  });

  it('drops out at a mid-route node: the node\'s ships appear, then the ship deploys', () => {
    const sim = newGame(13, content);
    const route = routeOf(sim, 3);
    charge(sim);
    giveItems(sim, 'item.fuel', 100);
    jump(sim, route);
    step(sim);
    // Drop mid-hop: it finishes the hop under way and drops at the next node.
    step(sim, 4);
    sim.enqueue({ type: 'galaxy.drop' });
    step(sim);
    expect(sim.galaxy.travel).toMatchObject({ stopping: true });
    expect(sim.galaxy.travel!.route).toEqual([START_NODE, route[0]]);
    const events = [];
    for (let i = 0; i < 30000 && sim.sector.state === 'hyperspace'; i++) events.push(...step(sim));
    expect(events).toContainEqual(expect.objectContaining({ type: 'sector.jumped', from: START_NODE, to: route[0] }));
    expect(sim.sector).toMatchObject({ state: 'deploying', node: route[0] });
    expect(sim.galaxy).toMatchObject({ current: route[0], travel: null });
    expect(deploy(sim).some((e) => e.type === 'sector.deployed')).toBe(true);
    expect(sim.sector.state).toBe('active');
  }, 60000);

  it('rejects a drop when not in hyperspace', () => {
    const sim = newGame(13, content);
    sim.enqueue({ type: 'galaxy.drop' });
    expect(step(sim)).toContainEqual({ type: 'command.rejected', command: 'galaxy.drop', reason: 'notInHyperspace' });
  });

  it('flees along a one-hop route to the cheapest neighbour', () => {
    const sim = newGame(14, content);
    const ship = playerShip(sim);
    sim.enqueue({ type: 'combat.flee', ship });
    expect(step(sim)).toContainEqual({ type: 'command.rejected', command: 'combat.flee', reason: 'notCharged' });
    charge(sim);
    sim.enqueue({ type: 'combat.flee', ship, to: 'nowhere' });
    expect(step(sim)).toContainEqual({ type: 'command.rejected', command: 'combat.flee', reason: 'noRoute' });
    const edges = [...(galaxyIndex(sim.galaxy).adjacent.get(START_NODE) ?? [])].sort((p, q) => p.fuel - q.fuel || p.charge - q.charge || (p.id < q.id ? -1 : 1));
    const cheapest = edges.find((e) => e.charge <= FTL_CHARGE_SEC)!;
    sim.enqueue({ type: 'combat.flee', ship });
    const events = step(sim);
    expect(events.find((e) => e.type === 'galaxy.hyperspace')).toMatchObject({ route: [START_NODE, cheapest.a === START_NODE ? cheapest.b : cheapest.a] });
    expect(sim.sector.state).toBe('hyperspace');
    untilStops(sim);
    expect(sim.galaxy.travel).toMatchObject({ phase: 'arrived' });
  });

  it('materialises a node\'s contacts when the ship drops, and the archive owns them afterwards', () => {
    const sim = newGame(11, content);
    const target = nodeWithContacts(sim, 3);
    const descriptors = galaxyIndex(sim.galaxy).nodes.get(target)!.contacts.length;
    sim.enqueue({ type: 'debug.galaxyTeleport', node: target });
    const events = step(sim);
    expect(sim.sector).toMatchObject({ node: target, state: 'deploying' });
    expect(sim.galaxy.current).toBe(target);
    expect(events.filter((e) => e.type === 'galaxy.shipArrived').length).toBeGreaterThan(0);
    const spawned = others(sim);
    expect(spawned.length).toBeGreaterThan(0);
    expect(spawned.length).toBeLessThanOrEqual(descriptors);
    expect(sim.galaxy.nodes[target]).toMatchObject({ entered: true });
    deploy(sim);
    sim.enqueue({ type: 'debug.galaxyTeleport', node: START_NODE });
    step(sim);
    expect(sim.galaxy.nodes[target]!.contacts).toEqual([]);
    const archive = sim.archives.find((a) => a.node === target)!;
    expect(spawned.every((id) => archive.entities.some((e) => e.id === id))).toBe(true);
    deploy(sim);
    // Back again: the archive is restored, nothing new is spawned.
    sim.enqueue({ type: 'debug.galaxyTeleport', node: target });
    const back = step(sim);
    expect(back.find((e) => e.type === 'sector.jumped')).toMatchObject({ restored: true, to: target });
    expect(back.filter((e) => e.type === 'galaxy.shipArrived')).toEqual([]);
    expect(others(sim)).toEqual(spawned);
  }, 60000);

  it('draws the arrival event at deploy time, not while travelling or dropping', () => {
    const sim = newGame(13, content);
    charge(sim);
    jump(sim, [neighbour(sim, START_NODE)]);
    step(sim);
    untilStops(sim);
    sim.enqueue({ type: 'galaxy.drop' });
    expect(step(sim).filter((e) => e.type === 'story.started')).toEqual([]);
    expect(sim.story.active).toBeNull();
    expect(sim.galaxy.pendingDraw).not.toBeNull();
    expect(deploy(sim).filter((e) => e.type === 'story.started')).toHaveLength(1);
    expect(sim.galaxy.pendingDraw).toBeNull();
  }, 60000);

  it('round-trips a save taken mid-hyperspace and carries on identically', () => {
    const make = (): Sim => {
      const sim = newGame(15, content);
      charge(sim);
      giveItems(sim, 'item.fuel', 60);
      jump(sim, routeOf(sim, 2));
      step(sim, 20);
      return sim;
    };
    const a = make();
    expect(a.sector.state).toBe('hyperspace');
    const json = serialize(a);
    const data = JSON.parse(json);
    expect(data.sector).toMatchObject({ state: 'hyperspace' });
    expect(data.galaxy.travel).toMatchObject({ phase: 'hop' });
    expect(data.archives.map((x: { node: string }) => x.node)).toEqual([START_NODE]);
    const b = deserialize(json, content);
    expect(serialize(b)).toBe(json);
    for (const s of [a, b]) {
      untilStops(s);
      s.enqueue({ type: 'galaxy.drop' });
      step(s);
    }
    expect(serialize(b)).toBe(serialize(a));
    expect(serialize(make())).toBe(serialize(make()));
  }, 120000);

  it('does not detect combat while in hyperspace or deploying, and leaving a fight ends it', () => {
    const sim = newGame(16, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    step(sim, 3);
    expect(sim.sector.inCombat).toBe(true);
    charge(sim);
    jump(sim, [neighbour(sim, START_NODE)]);
    const events = step(sim);
    expect(events.filter((e) => e.type === 'combat.ended')).toHaveLength(1);
    expect(sim.sector.inCombat).toBe(false);
    // In hyperspace: nothing runs but the trip, and the combat snapshot is empty.
    const all = step(sim, 3);
    expect(buildCombat(sim)).toEqual({ inCombat: false, player: null, enemies: [] });
    untilStops(sim);
    sim.enqueue({ type: 'galaxy.drop' });
    all.push(...step(sim, 200)); // dropped: deploying, a hostile ship may already be in the node's archive or placed
    expect(sim.sector.state).toBe('deploying');
    expect(all.filter((e) => e.type === 'combat.started')).toEqual([]);
    expect(buildCombat(sim).inCombat).toBe(false);
  }, 60000);
});
