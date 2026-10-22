import { describe, expect, it } from 'vitest';
import { CombatC, FTL_CHARGE_SEC, ModuleC, ShipC, START_NODE, StorageC, fuelStock, galaxyIndex, newGame, playerShip, spawnShip, type Sim } from '../sim';
import { storageAdd, storageCount } from '../sim/items/storage';
import { shipIdOf } from '../sim/regions';
import { rollArrival } from '../sim/galaxy/arrivals';
import { ensureAround } from '../sim/galaxy/state';
import { MAX_HOSTILE_CONTACTS } from '../sim/galaxy/tuning';
import { giveItems, takeItems } from '../sim/story/effects';
import { playerStock } from '../sim/story/world';
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
  for (const [x, y] of [[100, 60], [20, 50], [150, 8], [40, 90], [150, 80], [10, 5]] as const) {
    sim.enqueue({ type: 'sector.deploy', x, y });
    step(sim);
    if (sim.sector.state === 'active') break;
  }
};
const hostiles = (sim: Sim) => sim.world.query(ShipC).filter((id) => {
  const s = sim.world.get(id, ShipC);
  return !!s && (s.faction === 'hostile' || s.faction === 'rogue') && (s.state === 'active' || s.state === 'disabled');
});
const charge = (sim: Sim) => {
  const c = sim.world.get(playerShip(sim), CombatC);
  if (c) c.ftl = FTL_CHARGE_SEC;
};

describe('review: arrivals count restored hostile ships', () => {
  it('never lets a revisit add arrivals beyond the cap when archived hostiles are back', () => {
    const sim = newGame(31, content);
    ensureAround(sim, 's.12.0.n0');
    const far = [...galaxyIndex(sim.galaxy).nodes.values()].filter((n) => n.danger >= 6).sort((a, b) => (a.id < b.id ? -1 : 1))[0]!;
    sim.enqueue({ type: 'debug.galaxyTeleport', node: far.id });
    step(sim);
    deploy(sim);
    // Raiders wherever the gap rule lets them in, until the node holds at least the cap.
    for (const [x, y] of [[150, 8], [150, 80], [100, 8], [100, 85], [60, 8], [10, 85], [150, 45], [10, 8]] as const) {
      if (hostiles(sim).length >= MAX_HOSTILE_CONTACTS) break;
      sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x, y });
      step(sim);
    }
    sim.enqueue({ type: 'debug.galaxyTeleport', node: START_NODE });
    step(sim);
    deploy(sim);
    sim.enqueue({ type: 'debug.galaxyTeleport', node: far.id });
    step(sim);
    deploy(sim);
    expect(sim.sector.state).toBe('active');
    const before = hostiles(sim).length;
    expect(before).toBeGreaterThanOrEqual(MAX_HOSTILE_CONTACTS);
    expect(sim.galaxy.nodes[far.id]!.contacts).toEqual([]); // the archive owns them: no descriptors
    for (let t = 0; t < 40; t++) {
      sim.tick = sim.galaxy.nextArrival;
      rollArrival(sim);
    }
    expect(hostiles(sim).length).toBe(before);
  }, 60000);
});

describe('review: transit draws survive later hops', () => {
  it('an anchored hop followed by a plain one still draws the transit event at deploy', () => {
    const sim = newGame(32, content);
    ensureAround(sim, 's.4.0.n0');
    const index = galaxyIndex(sim.galaxy);
    let found: { a: string; b: string; c: string } | null = null;
    for (const e of [...index.edges.values()].sort((p, q) => (p.id < q.id ? -1 : 1))) {
      if (!e.anchor) continue;
      const next = (index.adjacent.get(e.b) ?? []).find((n) => !n.anchor && n.a !== e.a && n.b !== e.a);
      if (next) { found = { a: e.a, b: e.b, c: next.a === e.b ? next.b : next.a }; break; }
    }
    expect(found).not.toBeNull();
    sim.enqueue({ type: 'debug.galaxyTeleport', node: found!.a });
    step(sim);
    deploy(sim);
    for (let i = 0; i < 8; i++) { // dismiss any story popup the first deploy drew
      sim.story.active = null;
      step(sim);
    }
    charge(sim);
    giveItems(sim, 'item.fuel', 60);
    sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [found!.b, found!.c] });
    step(sim);
    for (let i = 0; i < 90000 && sim.galaxy.travel?.phase === 'hop'; i++) sim.step();
    expect(sim.galaxy.travel).toMatchObject({ phase: 'arrived', at: 2 });
    expect(sim.galaxy.pendingDraw).toBe('transit');
  }, 60000);
});

describe('review: fuel comes only from the flown ship', () => {
  it('a fuelled second ship does not pay for an empty-tanked one, and its fuel is untouched', () => {
    const sim = newGame(33, content);
    const ship = playerShip(sim);
    charge(sim);
    // A second player-owned ship (as a prize would be) in the sector.
    const other = spawnShip(sim, content.ships['ship.starter']!, { faction: 'player', x: 120, y: 80 });
    expect(playerShip(sim)).toBe(ship);
    takeItems(sim, 'item.fuel', playerStock(sim, 'item.fuel'));
    const hold = sim.world.query(StorageC, ModuleC).find((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === other)!;
    storageAdd(sim, hold, 'item.fuel', 16);
    const stock = () => sim.world.query(StorageC, ModuleC).filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === other).reduce((n, id) => n + storageCount(sim, id, 'item.fuel'), 0);
    expect(stock()).toBe(16);
    const to = (galaxyIndex(sim.galaxy).adjacent.get(START_NODE) ?? []).map((e) => (e.a === START_NODE ? e.b : e.a)).sort()[0]!;
    sim.enqueue({ type: 'galaxy.jump', ship, route: [to] });
    expect(step(sim)).toContainEqual({ type: 'command.rejected', command: 'galaxy.jump', reason: 'noFuel' });
    expect(sim.sector.state).toBe('active');
    expect(stock()).toBe(16);
    // Fuel on the flown ship itself pays, and only from it.
    giveItems(sim, 'item.fuel', 5); // lands in the lowest-id (flown) ship's storage first
    expect(stock()).toBe(16);
    sim.enqueue({ type: 'galaxy.jump', ship, route: [to] });
    step(sim);
    expect(sim.sector.state).toBe('hyperspace');
    // The second ship stayed behind in the archive with all its fuel; the flown ship paid its first hop from its own 5.
    const archived = sim.archives[0]!.entities.find((e) => e.id === hold)!.c['storage'] as { stacks: { item: string; count: number }[] };
    expect(archived.stacks.filter((st) => st.item === 'item.fuel').reduce((n, st) => n + st.count, 0)).toBe(16);
    expect(fuelStock(sim)).toBeLessThan(5);
  });
});
