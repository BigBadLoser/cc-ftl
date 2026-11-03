/**
 * The salvage throughput bench (docs/ARCHITECTURE.md "Throughput check", #286): the starter ship with 6 (or 4) crew, one shuttle (3 suits),
 * a sealed wreck with or without an airlock, and nothing else to do at home. `play` runs it; `scrapHome` is what is measured. Tooling and
 * the slow test read it; salvage's own code is not touched.
 */
import { CrewC, DeadC, ItemStackC, PositionC, StorageC, VehicleC, homeShip, storageAdd, newGame, placementError, ShipC, shipGrid, spawnModule, stampShip, type ScrapType, type Sim, type WorkCategory } from '../../sim';
import { shipIdAt, shipIdOf } from '../../sim/regions';
import { content } from '../index';
import { storages } from './ferryFixture';

export interface BenchOpts {
  /** Crew at home: 6 (three of them with construction and hauling at 1, the rest at 3) or 4 (all four at 1). */
  crew: 4 | 6;
  /** A working airlock on the wreck (its crew refill there), else none. */
  airlock: boolean;
}

export interface Bench {
  sim: Sim;
  home: number;
  wreck: number;
  /** Scrap units home at the start. */
  start: number;
}

/** Every scrap type the order asks for. */
export const BENCH_TYPES: ScrapType[] = ['hull', 'tech', 'energy', 'weapons', 'comfort'];
export const BENCH_HOURS = 2;
export const BENCH_TICKS = BENCH_HOURS * 60 * 60 * 20;

const isScrap = (item: string): boolean => item.startsWith('item.scrap_');

/** Scrap units on the home ship: in storage, loose on its floor, and in the hold of a shuttle stowed in its bay. */
export function scrapHome(sim: Sim, home: number): number {
  let n = 0;
  for (const id of storages(sim, home)) for (const st of sim.world.get(id, StorageC)!.stacks) if (isScrap(st.item)) n += st.count;
  for (const id of sim.world.query(ItemStackC)) {
    const st = sim.world.get(id, ItemStackC)!;
    if (isScrap(st.item) && shipIdAt(sim, st.x, st.y) === home) n += st.count;
  }
  for (const id of sim.world.query(VehicleC)) {
    const v = sim.world.get(id, VehicleC)!;
    if (v.state === 'stowed') for (const q of v.cargo) if (isScrap(q.item)) n += q.count;
  }
  return n;
}

/** Interior size of the bench wreck. It is big enough to keep the crew busy for far longer than the 2 game hours the bench runs. */
const WRECK_W = 60;
const WRECK_H = 40;
const KINDS = ['module.console', 'module.battery', 'module.storage_locker', 'module.radiator', 'module.light'];

/**
 * The bench derelict: a sealed hull with a 60x40 deck and a lattice of 1x1 parts (a part every other tile, rows 8 and below so the north
 * edge has room for an airlock), 16 tiles east of the home ship. About 470 parts and 200 hull walls to strip: more than the crew can do in 2 hours.
 */
function stampWreck(sim: Sim, home: number): number {
  const h = sim.world.get(home, ShipC)!;
  const rows = Array.from({ length: WRECK_H + 4 }, (_, y) =>
    Array.from({ length: WRECK_W + 4 }, (_, x) => (y === 0 || y === WRECK_H + 3 || x === 0 || x === WRECK_W + 3 ? '.' : y === 1 || y === WRECK_H + 2 || x === 1 || x === WRECK_W + 2 ? '#' : '_')).join(''));
  const modules: { def: string; x: number; y: number; rot: number }[] = [];
  for (let y = 8; y < WRECK_H + 1; y += 2) for (let x = 4; x < WRECK_W; x += 2) modules.push({ def: KINDS[(x / 2 + y / 2) % KINDS.length]!, x, y, rot: 0 });
  return stampShip(sim, { name: 'Bench hulk', rows, modules }, { faction: 'neutral', state: 'wreck', x: h.x + h.width + 16, y: h.y + 2 });
}

/** Put a working airlock on the wreck's hull (the first spot that takes one, scanning from the top left). */
function addAirlock(sim: Sim, wreck: number): void {
  const g = shipGrid(sim, wreck)!;
  for (let rot = 0; rot < 4; rot++) {
    for (let y = g.y0; y < g.y0 + g.height; y++) {
      for (let x = g.x0; x < g.x0 + g.width; x++) {
        if (placementError(sim, wreck, 'module.airlock', x, y, rot)) continue;
        spawnModule(sim, 'module.airlock', x, y, rot);
        return;
      }
    }
  }
  throw new Error('no room for an airlock on the bench wreck');
}

/** Rations for the bench's crew: a locker of their own on the home ship (so the scrap keeps the ship's storage), full. */
export const BENCH_RATIONS = 200;

/**
 * Rations and beds enough (the bench measures salvage, not the galley): without this six crew eat the starter stock in about 80 game
 * minutes, after which nobody is fed enough for a passage and the site stops.
 */
function stockRations(sim: Sim, home: number): void {
  const g = shipGrid(sim, home)!;
  for (let y = g.y0; y < g.y0 + g.height; y++) {
    for (let x = g.x0; x < g.x0 + g.width; x++) {
      if (placementError(sim, home, 'module.storage_locker', x, y, 0)) continue;
      const id = spawnModule(sim, 'module.storage_locker', x, y, 0);
      sim.world.get(id, StorageC)!.filter = ['item.ration'];
      storageAdd(sim, id, 'item.ration', BENCH_RATIONS);
      return;
    }
  }
  throw new Error('no room for a ration locker on the bench home ship');
}

/** Build the bench on a fresh game: crew, priorities, the wreck, and the salvage order for every scrap type. */
export const setupBench = (seed: number, o: BenchOpts): Bench => prepareBench(newGame(seed, content), o);

/** The bench on a game that already exists (the profile scenario builds the game itself). */
export function prepareBench(sim: Sim, o: BenchOpts): Bench {
  const home = homeShip(sim);
  const start = [...sim.world.query(CrewC)].filter((c) => !sim.world.has(c, DeadC));
  while (start.length < o.crew) {
    const at = sim.world.get(start[0]!, PositionC)!;
    sim.enqueue({ type: 'debug.spawnCrew', ship: home, x: at.x, y: at.y, role: 'role.engineer' });
    sim.step();
    sim.events.drain();
    start.splice(0, start.length, ...[...sim.world.query(CrewC)].filter((c) => !sim.world.has(c, DeadC)));
  }
  const crew = start.slice(0, o.crew);
  for (const c of start.slice(o.crew)) sim.world.add(c, DeadC, {} as never);
  crew.forEach((c, i) => {
    const level = o.crew === 4 || i < 3 ? 1 : 3;
    for (const cat of ['construction', 'hauling'] as WorkCategory[]) sim.enqueue({ type: 'crew.setPriority', id: c, category: cat, value: level });
  });
  sim.galaxy.nextArrival = Number.MAX_SAFE_INTEGER; // no scavengers or raiders jump in during the 2 hours: the bench measures salvage, not whatever else the node rolls
  stockRations(sim, home);
  const wreck = stampWreck(sim, home);
  if (o.airlock) addAirlock(sim, wreck);
  for (let i = 0; i < 5; i++) {
    sim.step();
    sim.events.drain();
  }
  const bench = { sim, home, wreck, start: scrapHome(sim, home) };
  sim.enqueue({ type: 'salvage.order', ship: wreck, types: BENCH_TYPES });
  return bench;
}

/** What a finished run measured: scrap units brought home per game hour, stripping jobs done, crew-seconds on the wreck. */
export interface BenchResult {
  perHour: number;
  scrap: number;
  stripped: number;
  wreckCrewSec: number;
}

/** The numbers of a result on one line, as the profile scenario and the slow test print them. */
export const formatBench = (r: BenchResult): string => `scrap/game hour ${r.perHour.toFixed(1)} (${r.scrap} units), stripping jobs done ${r.stripped}, crew-seconds on the wreck ${r.wreckCrewSec.toFixed(0)}`;

/** Run the bench for `ticks` and read the numbers. */
export function runBench(b: Bench, ticks = BENCH_TICKS): BenchResult {
  const { sim } = b;
  let stripped = 0;
  let wreckTicks = 0;
  for (let i = 0; i < ticks; i++) {
    sim.step();
    for (const e of sim.events.drain()) if (e.type === 'crew.jobDone' && e.ship === b.wreck) stripped++;
    if (i % 20 === 0) for (const c of sim.world.query(CrewC, PositionC)) if (!sim.world.has(c, DeadC) && shipIdOf(sim, sim.world.get(c, PositionC)!) === b.wreck) wreckTicks += 20;
  }
  const scrap = scrapHome(sim, b.home) - b.start;
  return { perHour: (scrap / ticks) * 72000, scrap, stripped, wreckCrewSec: wreckTicks / 20 };
}
