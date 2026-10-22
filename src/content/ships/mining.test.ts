import { describe, expect, it } from 'vitest';
import {
  AsteroidC, CrewC, DraftedC, MiningPodC, PositionC, Struct, VehicleC, deserialize, homeShip, newGame, placementError, serialize, shipGrid, spawnModule, spawnVehicle,
  totalStock, type Sim,
} from '../../sim';
import { content } from '../index';

const HOLD = content.vehicles['vehicle.mining_pod'].cargo;

/** The starter ship with a pod bay (first spot that fits, scanning rows) and a pod in it, plus an asteroid field. */
function setup(seed = 1): { sim: Sim; pod: number; asteroid: number } {
  const sim = newGame(seed, content);
  const ship = homeShip(sim);
  const g = shipGrid(sim, ship)!;
  let bay = 0;
  for (let y = g.y0; y < g.y0 + g.height && !bay; y++) {
    for (let x = g.x0; x < g.x0 + g.width && !bay; x++) if (!placementError(sim, ship, 'module.pod_bay', x, y, 0)) bay = spawnModule(sim, 'module.pod_bay', x, y, 0);
  }
  const pod = spawnVehicle(sim, 'vehicle.mining_pod', bay);
  sim.enqueue({ type: 'debug.spawnAsteroid', kind: 'field', seed: 3 });
  sim.step();
  const asteroid = [...sim.world.query(AsteroidC)][0]!;
  return { sim, pod, asteroid };
}

/** The ore tiles of an asteroid, row-major, with their amounts. */
function oreTiles(sim: Sim, asteroid: number): { x: number; y: number; amt: number }[] {
  const a = sim.world.get(asteroid, AsteroidC)!;
  const out: { x: number; y: number; amt: number }[] = [];
  for (let y = a.y; y < a.y + a.height; y++) {
    for (let x = a.x; x < a.x + a.width; x++) if (sim.sector.grid.get('ore', x, y)) out.push({ x, y, amt: sim.sector.grid.get('oreAmt', x, y) });
  }
  return out;
}

const ORE_ITEMS = ['item.iron_ore', 'item.ice', 'item.rare_ore'];
const stock = (sim: Sim) => ORE_ITEMS.reduce((n, i) => n + totalStock(sim, i), 0);
const hold = (sim: Sim, pod: number) => sim.world.get(pod, VehicleC)!.cargo.reduce((n, q) => n + q.count, 0);

/** Step until `done` (checked every tick) or `max` ticks; returns the event types seen. */
function until(sim: Sim, max: number, done: (events: string[]) => boolean, watch?: () => void): string[] {
  const log: string[] = [];
  for (let i = 0; i < max; i++) {
    sim.step();
    for (const e of sim.events.drain()) log.push(e.type === 'command.rejected' ? `rejected:${e.command}:${e.reason}` : e.type);
    watch?.();
    if (done(log)) break;
  }
  return log;
}

describe('mining pods', () => {
  it('flies a full trip: launch, mine a tile, fly home, crew unload the ore into storage', () => {
    const { sim, pod, asteroid } = setup();
    const t = oreTiles(sim, asteroid).find((o) => o.amt < HOLD)!;
    const before = stock(sim);
    sim.enqueue({ type: 'mining.order', pod, asteroid, tiles: [t] });
    const log = until(sim, 6000, (l) => l.includes('mining.done'));
    expect(log).toContain('mining.launched');
    expect(log).toContain('mining.tileCleared');
    expect(log).toContain('vehicle.stowed');
    expect(log.filter((e) => e === 'mining.done')).toHaveLength(1);
    expect(sim.world.has(pod, MiningPodC)).toBe(false);
    expect(sim.sector.grid.get('struct', t.x, t.y)).toBe(Struct.Space);
    expect(sim.sector.grid.get('ship', t.x, t.y)).toBe(0);
    expect(hold(sim, pod)).toBe(0);
    until(sim, 2000, () => false); // the last armfuls are still in crew hands
    expect(stock(sim) - before).toBe(t.amt);
  });

  it('never carries more than its hold, goes home full, and makes several trips until the ore runs out', () => {
    const { sim, pod, asteroid } = setup();
    const tiles = oreTiles(sim, asteroid).filter((o) => o.amt > HOLD).slice(0, 2);
    const total = tiles.reduce((n, o) => n + o.amt, 0);
    expect(total).toBeGreaterThan(HOLD * 2);
    const before = stock(sim);
    sim.enqueue({ type: 'mining.order', pod, asteroid, tiles });
    let most = 0;
    const log = until(sim, 40000, (l) => l.includes('mining.done'), () => { most = Math.max(most, hold(sim, pod)); });
    expect(most).toBe(HOLD);
    expect(log.filter((e) => e === 'mining.launched').length).toBeGreaterThanOrEqual(Math.ceil(total / HOLD));
    expect(log.filter((e) => e === 'mining.tileCleared')).toHaveLength(2);
    expect(log.at(-1)).toBe('mining.done');
    for (const t of tiles) expect(sim.sector.grid.get('struct', t.x, t.y)).toBe(Struct.Space);
    until(sim, 2000, () => false);
    expect(stock(sim) - before).toBe(total);
  });

  it('a recalled pod flies home with what it has, unloads and ends the order', () => {
    const { sim, pod, asteroid } = setup();
    const t = oreTiles(sim, asteroid).find((o) => o.amt > HOLD)!;
    sim.enqueue({ type: 'mining.order', pod, asteroid, tiles: [t] });
    until(sim, 6000, () => (sim.world.get(pod, MiningPodC)?.phase === 'mining' && hold(sim, pod) >= 4));
    const carried = hold(sim, pod);
    sim.enqueue({ type: 'mining.recall', pod });
    const log = until(sim, 6000, (l) => l.includes('mining.done'));
    expect(log).toContain('mining.returning');
    expect(log).not.toContain('mining.launched');
    expect(carried).toBeLessThan(HOLD);
    expect(sim.world.get(pod, VehicleC)!.state).toBe('stowed');
    expect(hold(sim, pod)).toBe(0);
    expect(sim.sector.grid.get('struct', t.x, t.y)).toBe(Struct.Rock);
  });

  it('two pods share an order: with its only tile taken by another pod, a pod mines that tile too', () => {
    const { sim, pod, asteroid } = setup();
    const t = oreTiles(sim, asteroid).find((o) => o.amt > HOLD)!;
    // Another pod with that tile as its target (it sits in a second bay with no pilot, so it never leaves).
    const ship = homeShip(sim);
    const g = shipGrid(sim, ship)!;
    let bay2 = 0;
    for (let y = g.y0; y < g.y0 + g.height && !bay2; y++) {
      for (let x = g.x0; x < g.x0 + g.width && !bay2; x++) if (!placementError(sim, ship, 'module.pod_bay', x, y, 0)) bay2 = spawnModule(sim, 'module.pod_bay', x, y, 0);
    }
    const other = spawnVehicle(sim, 'vehicle.mining_pod', bay2);
    sim.world.add(other, MiningPodC, { asteroid, tiles: [{ x: t.x, y: t.y }], phase: 'mining', target: { x: t.x, y: t.y }, progress: 0, recall: false, trips: 1, pilot: 0, waiting: false });
    sim.enqueue({ type: 'mining.order', pod, asteroid, tiles: [t] });
    const log = until(sim, 6000, () => hold(sim, pod) > 0);
    expect(log).not.toContain('mining.done');
    expect(sim.world.get(pod, MiningPodC)?.target).toEqual({ x: t.x, y: t.y });
    expect(hold(sim, pod)).toBeGreaterThan(0);
  });

  it('a save mid-trip loads and plays on identically; two runs of a seed match', () => {
    const a = setup(5);
    const b = setup(5);
    for (const s of [a, b]) s.sim.enqueue({ type: 'mining.order', pod: s.pod, asteroid: s.asteroid });
    until(a.sim, 3000, () => a.sim.world.get(a.pod, MiningPodC)?.phase === 'mining');
    until(b.sim, 3000, () => b.sim.world.get(b.pod, MiningPodC)?.phase === 'mining');
    expect(serialize(b.sim)).toBe(serialize(a.sim));
    expect(a.sim.world.get(a.pod, VehicleC)!.pilot).not.toBe(0); // saved with the pilot aboard
    const c = deserialize(serialize(a.sim), content);
    const la = until(a.sim, 1500, () => false);
    const lc = until(c, 1500, () => false);
    expect(lc).toEqual(la);
    expect(serialize(c)).toBe(serialize(a.sim));
  });

  it('needs a pilot: the best free pilot walks over and embarks, stays aboard between trips, and climbs out at the end', () => {
    const { sim, pod, asteroid } = setup();
    const tiles = oreTiles(sim, asteroid).filter((o) => o.amt > HOLD).slice(0, 1);
    sim.enqueue({ type: 'mining.order', pod, asteroid, tiles });
    const log = until(sim, 3000, (l) => l.includes('mining.launched'));
    expect(log.indexOf('mining.pilotSent')).toBeGreaterThanOrEqual(0);
    expect(log.indexOf('crew.embarked')).toBeGreaterThan(log.indexOf('mining.pilotSent'));
    expect(log.indexOf('mining.launched')).toBeGreaterThan(log.indexOf('crew.embarked'));
    const pilot = sim.world.get(pod, VehicleC)!.pilot;
    expect(pilot).toBe(sim.world.get(pod, MiningPodC)!.pilot);
    expect(sim.world.get(pilot, CrewC)!.role).toBe('role.pilot');
    // home with a full hold, unloading: the pilot is still aboard
    until(sim, 6000, () => sim.world.get(pod, MiningPodC)?.phase === 'unloading');
    expect(sim.world.get(pod, VehicleC)!.pilot).toBe(pilot);
    sim.enqueue({ type: 'mining.recall', pod });
    const end = until(sim, 6000, (l) => l.includes('mining.done'));
    expect(end).toContain('crew.disembarked');
    expect(sim.world.get(pod, VehicleC)!.pilot).toBe(0);
    expect(sim.world.has(pilot, PositionC)).toBe(true);
    expect(sim.world.has(pilot, DraftedC)).toBe(false);
  });

  it('waits with no free pilot (no crewless launch), and goes once one is free', () => {
    const { sim, pod, asteroid } = setup();
    const crew = [...sim.world.query(CrewC)];
    for (const id of crew) sim.enqueue({ type: 'crew.draft', id, drafted: true });
    sim.step();
    sim.enqueue({ type: 'mining.order', pod, asteroid });
    const log = until(sim, 200, () => false);
    expect(log.filter((e) => e === 'mining.waiting')).toHaveLength(1);
    expect(log).not.toContain('mining.launched');
    expect(sim.world.get(pod, VehicleC)!.state).toBe('stowed');
    sim.enqueue({ type: 'crew.draft', id: crew[0]!, drafted: false });
    expect(until(sim, 3000, (l) => l.includes('mining.launched'))).toContain('mining.pilotSent');
  });

  it('rejects bad orders', () => {
    const { sim, pod, asteroid } = setup();
    sim.enqueue({ type: 'mining.order', pod: asteroid, asteroid });
    sim.enqueue({ type: 'mining.order', pod, asteroid: pod });
    sim.enqueue({ type: 'mining.order', pod, asteroid, tiles: [{ x: -999, y: -999 }] });
    sim.enqueue({ type: 'mining.recall', pod });
    const log = until(sim, 1, () => false).filter((e) => e.startsWith('rejected'));
    expect(log).toEqual([
      'rejected:mining.order:noPod', 'rejected:mining.order:noAsteroid', 'rejected:mining.order:noOre', 'rejected:mining.recall:noOrder',
    ]);
  });
});
