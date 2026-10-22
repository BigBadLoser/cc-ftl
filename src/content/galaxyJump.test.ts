import { describe, expect, it } from 'vitest';
import { CombatC, FTL_CHARGE_SEC, START_NODE, ShipC, deserialize, galaxyIndex, newGame, playerShip, serialize, type Sim } from '../sim';
import { ensureAround } from '../sim/galaxy/state';
import { giveItems, takeItems } from '../sim/story/effects';
import { playerStock } from '../sim/story/world';
import { content } from '.';

const step = (sim: Sim) => {
  sim.step();
  return sim.events.drain();
};
const deploy = (sim: Sim) => {
  sim.enqueue({ type: 'sector.deploy', x: 100, y: 60 });
  return step(sim);
};
const neighbour = (sim: Sim, id: string, k = 0): string => {
  const edges = galaxyIndex(sim.galaxy).adjacent.get(id) ?? [];
  return edges.map((e) => (e.a === id ? e.b : e.a)).sort()[k] as string;
};
const charge = (sim: Sim) => {
  const c = sim.world.get(playerShip(sim), CombatC);
  if (c) c.ftl = FTL_CHARGE_SEC;
};
/** The first node (by id) of a danger tier with generated contacts. */
function nodeWithContacts(sim: Sim, minDanger: number): string {
  ensureAround(sim, 's.12.0.n0');
  const node = [...galaxyIndex(sim.galaxy).nodes.values()].filter((n) => n.danger >= minDanger && n.contacts.length > 0).sort((a, b) => (a.id < b.id ? -1 : 1))[0];
  if (!node) throw new Error('no node with contacts');
  return node.id;
}
/** Ships in the sector that are not the player's. */
const others = (sim: Sim) => sim.world.query(ShipC).filter((id) => sim.world.get(id, ShipC)?.faction !== 'player');

describe('galaxy x sector jump', () => {
  it('materialises a node\'s contacts on the first deploy, and the archive owns them afterwards', () => {
    const sim = newGame(11, content);
    const target = nodeWithContacts(sim, 3);
    const descriptors = galaxyIndex(sim.galaxy).nodes.get(target)!.contacts.length;
    sim.enqueue({ type: 'debug.galaxyTeleport', node: target });
    step(sim);
    // Jumped, not deployed: nothing has been spawned yet.
    expect(sim.sector).toMatchObject({ node: target, state: 'deploying' });
    expect(sim.galaxy.current).toBe(target);
    expect(others(sim)).toEqual([]);
    const events = deploy(sim);
    expect(events.filter((e) => e.type === 'galaxy.shipArrived').length).toBeGreaterThan(0);
    const spawned = others(sim);
    expect(spawned.length).toBeGreaterThan(0);
    expect(spawned.length).toBeLessThanOrEqual(descriptors);
    expect(sim.galaxy.nodes[target]).toMatchObject({ entered: true });
    // Leave: the node's ships go into its archive and its descriptors are gone.
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
    expect(others(sim)).toEqual(spawned);
    const again = deploy(sim);
    expect(again.filter((e) => e.type === 'galaxy.shipArrived')).toEqual([]);
    expect(others(sim)).toEqual(spawned);
  }, 60000);

  it('pays fuel and charge only when the ship lifts, and moves current only then', () => {
    const sim = newGame(12, content);
    const to = neighbour(sim, START_NODE);
    const fuel = playerStock(sim, 'item.fuel');
    const ship = playerShip(sim);
    sim.enqueue({ type: 'galaxy.jump', ship, to });
    expect(step(sim)).toContainEqual({ type: 'command.rejected', command: 'galaxy.jump', reason: 'notCharged' });
    charge(sim);
    takeItems(sim, 'item.fuel', fuel);
    sim.enqueue({ type: 'galaxy.jump', ship, to });
    expect(step(sim)).toContainEqual({ type: 'command.rejected', command: 'galaxy.jump', reason: 'noFuel' });
    sim.enqueue({ type: 'galaxy.jump', ship: ship + 999, to });
    expect(step(sim)).toContainEqual({ type: 'command.rejected', command: 'galaxy.jump', reason: 'notPlayerShip' });
    expect(sim.world.get(ship, CombatC)!.ftl).toBe(FTL_CHARGE_SEC);
    expect(sim.sector).toMatchObject({ node: START_NODE, state: 'active' });
    expect([sim.galaxy.current, sim.galaxy.jumps, sim.archives.length]).toEqual([START_NODE, 0, 0]);
    // Restock and go: both are paid with the lift.
    giveItems(sim, 'item.fuel', fuel);
    const edge = galaxyIndex(sim.galaxy).adjacent.get(START_NODE)!.find((e) => e.a === to || e.b === to)!;
    sim.enqueue({ type: 'galaxy.jump', ship, to });
    const events = step(sim);
    expect(events).toContainEqual({ type: 'galaxy.jumped', from: START_NODE, to, edge: edge.id, fuel: edge.fuel, charge: edge.charge });
    expect([sim.galaxy.current, sim.galaxy.jumps, sim.sector.node, sim.sector.state]).toEqual([to, 1, to, 'deploying']);
    deploy(sim);
    expect(playerStock(sim, 'item.fuel')).toBe(fuel - edge.fuel);
    expect(sim.world.get(ship, CombatC)!.ftl).toBeCloseTo(FTL_CHARGE_SEC - edge.charge, 0);
  });

  it('draws the arrival event at deploy time, not at jump time', () => {
    const sim = newGame(13, content);
    charge(sim);
    sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), to: neighbour(sim, START_NODE) });
    expect(step(sim).filter((e) => e.type === 'story.started')).toEqual([]);
    expect(sim.story.active).toBeNull();
    expect(sim.galaxy.pendingDraw).not.toBeNull();
    expect(deploy(sim).filter((e) => e.type === 'story.started')).toHaveLength(1);
    expect(sim.galaxy.pendingDraw).toBeNull();
  });

  it('flees by jumping to a chosen or the cheapest neighbour, and is refused uncharged or off the map', () => {
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
    expect(step(sim).find((e) => e.type === 'galaxy.jumped')).toMatchObject({ edge: cheapest.id });
    expect(sim.sector.state).toBe('deploying');
  });

  it('keeps string node ids through a save mid-deploy', () => {
    const sim = newGame(15, content);
    charge(sim);
    const to = neighbour(sim, START_NODE);
    sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), to });
    step(sim);
    const json = serialize(sim);
    const data = JSON.parse(json);
    expect(data.sector).toMatchObject({ node: to, state: 'deploying' });
    expect(data.archives.map((a: { node: string }) => a.node)).toEqual([START_NODE]);
    const back = deserialize(json, content);
    expect(serialize(back)).toBe(json);
    expect(deploy(back).some((e) => e.type === 'sector.deployed')).toBe(true);
    expect(back.sector).toMatchObject({ node: to, state: 'active' });
  });
});
