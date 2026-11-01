/**
 * Profile scenarios: a `newGame` plus existing debug commands, so crew-AI work (docs/CREW_AI.md section 7.4) can be measured on a repeatable
 * board. Tooling only: nothing here is imported by `src/`. A scenario's `setup` runs a few ticks itself (commands apply on the tick after they are
 * queued), so it is deterministic for a given seed. To add a scenario, append an entry to `SCENARIOS`; no other file needs to change.
 *
 * TODO(#184): `fight` (drafted crew vs boarders, triage, operate relief) and `damage` (breaches, repair urgency) arrive with PR #184 (`combat/inset`);
 * add them here once it merges.
 */
import { content } from '../../src/content';
import { newGame, homeShip, shipGrid, ShipC, CrewC, PositionC, type Sim, type Command } from '../../src/sim';
import { Struct } from '../../src/sim/structure';

export interface Scenario {
  name: string;
  description: string;
  /** Ticks `profile:sim` runs by default (after setup). */
  ticks: number;
  /** Whether `newGame` populates the start node (stations, rocks, wrecks east of the ship). */
  populate: boolean;
  /** Queue debug commands and step the sim until the board is set. Must be deterministic for a seed. */
  setup(sim: Sim): void;
}

type Tile = { x: number; y: number };

/** Rejected-command tally of the scenario setups run so far, keyed by sim (a test asserts the commands that matter went through). */
export const setupRejections = new WeakMap<Sim, Record<string, number>>();

/** Queue `cmds`, then step `steps` ticks (the first applies them). Drains events like the app loop, tallying `command.rejected` as `type:reason`. */
export function exec(sim: Sim, cmds: Command[], steps = 1): void {
  for (const c of cmds) sim.enqueue(c);
  const tally = setupRejections.get(sim) ?? {};
  setupRejections.set(sim, tally);
  for (let i = 0; i < steps; i++) {
    sim.step();
    for (const e of sim.events.drain()) if (e.type === 'command.rejected') tally[`${e.command}:${e.reason}`] = (tally[`${e.command}:${e.reason}`] ?? 0) + 1;
  }
}

/** Tiles of a rectangle in the home ship's own coordinates (0, 0 = its top-left), as sector tiles. */
function shipTiles(sim: Sim, x: number, y: number, w: number, h: number): Tile[] {
  const s = sim.world.get(homeShip(sim), ShipC)!;
  const out: Tile[] = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.push({ x: s.x + x + i, y: s.y + y + j });
  return out;
}

function inCorridor(sim: Sim, id: number, shipY: number): boolean {
  const p = sim.world.get(id, PositionC);
  return !!p && p.y >= shipY + 9 && p.y <= shipY + 10;
}

/** The first crew member of the player's ship, for scenarios that need a spot to start a fire at. */
function firstCrewTile(sim: Sim): Tile | undefined {
  const id = sim.world.query(CrewC)[0];
  const p = id === undefined ? undefined : sim.world.get(id, PositionC);
  return p && { x: Math.round(p.x), y: Math.round(p.y) };
}

/** Spawn a station and return its ship id (0 if the spawn was rejected). */
function spawnStation(sim: Sim, size: 'outpost' | 'station' | 'hub', seed = 4, kind = 'station.trading'): number {
  const before = new Set(sim.world.query(ShipC));
  exec(sim, [{ type: 'debug.spawnStation', kind, size, seed }]);
  return sim.world.query(ShipC).find((i) => !before.has(i)) ?? 0;
}

/** A grid of build jobs (a wall each, with materials on hand) over the tiles of `tiles`; rejected tiles (modules, existing jobs) are skipped by the sim. */
function buildJobs(sim: Sim, tiles: Tile[], struct: number = Struct.Wall): void {
  const ship = homeShip(sim);
  exec(sim, tiles.map((t) => ({ type: 'job.build', ship, x: t.x, y: t.y, struct }) as Command));
}

const SCENARIOS: Scenario[] = [
  {
    name: 'colony',
    description: 'Colony baseline: the populated start node, no extra work (what `profile` runs with no scenario).',
    ticks: 5000,
    populate: true,
    setup: () => {},
  },
  {
    name: 'hullplan',
    description: 'Many build jobs on the home ship plus an outer hull plan ordered at a trading hub (EVA hull ring, thin-air routes), credits and metal on hand.',
    ticks: 5000,
    populate: true,
    setup(sim) {
      const station = spawnStation(sim, 'hub');
      const me = homeShip(sim);
      const s = sim.world.get(me, ShipC)!;
      exec(sim, [{ type: 'debug.setCredits', value: 100000 }, { type: 'debug.giveItems', item: 'item.metal', count: 2000 }]);
      // The hull ring: the open border tiles of the ship's own rectangle, which touch its hull wall (what the Rectangle brush of the Hull plan tool paints).
      const ring: Tile[] = [];
      const w = s.width, h = s.height;
      for (let i = 0; i < w; i++) ring.push({ x: s.x + i, y: s.y }, { x: s.x + i, y: s.y + h - 1 });
      for (let j = 1; j < h - 1; j++) ring.push({ x: s.x, y: s.y + j }, { x: s.x + w - 1, y: s.y + j });
      exec(sim, [{ type: 'hull.plan', ship: me, tiles: ring }]);
      if (station) exec(sim, [{ type: 'yard.order', station }]);
      // Interior build jobs for the player's own crew: every free floor tile of the two north rooms and the corridor.
      buildJobs(sim, shipTiles(sim, 2, 2, 5, 6).concat(shipTiles(sim, 2, 9, 19, 2)), Struct.Door);
    },
  },
  {
    name: 'log',
    description: 'The browser `?scenario=log` setup: a raider arrives (combat) and a fire breaks out at the first crew member.',
    ticks: 5000,
    populate: true,
    setup(sim) {
      const spots = [[110, 80], [60, 20], [20, 100], [150, 30], [100, 50], [40, 90], [130, 110]] as const;
      // The first free spot wins (a rejected spawn overlaps something): one spawn per tick until combat starts.
      for (const [x, y] of spots) {
        if (sim.sector.inCombat) break;
        exec(sim, [{ type: 'debug.spawnEnemy', template: 'ship.raider', x, y }], 2);
      }
      const at = firstCrewTile(sim);
      if (at) exec(sim, [{ type: 'debug.setField', ship: homeShip(sim), x: at.x, y: at.y, field: 'fire', value: 200 }]);
    },
  },
  {
    name: 'hub',
    description: 'Station hub: a 150x126-class trading hub spawned beside the ship (44 crew, patrols, a big grid).',
    ticks: 5000,
    populate: false,
    setup(sim) {
      spawnStation(sim, 'hub');
    },
  },
  {
    name: 'storm',
    description: 'Unreachable storm: crew leave the six side rooms, whose doors then become walls, and ~100 jobs (builds and module deconstructions) are posted inside.',
    ticks: 1500,
    populate: false,
    setup(sim) {
      const me = homeShip(sim);
      const s = sim.world.get(me, ShipC)!;
      // 1. Everyone to the corridor (y = 9..10), so the rooms are empty when they are sealed.
      const crew = [...sim.world.query(CrewC)];
      exec(sim, [...crew.map((id) => ({ type: 'crew.draft', id, drafted: true }) as Command), { type: 'crew.moveGroup', ids: crew, x: s.x + 10, y: s.y + 9, ship: me }]);
      for (let i = 0; i < 600 && !crew.every((id) => inCorridor(sim, id, s.y)); i++) exec(sim, []);
      exec(sim, crew.map((id) => ({ type: 'crew.draft', id, drafted: false }) as Command));
      // 2. The starter ship's six side rooms open onto the corridor through the doors on rows 8 and 11 (x = 5, 11, 17): make them walls.
      const doors = [8, 11].flatMap((y) => [5, 11, 17].map((x) => ({ type: 'debug.setStruct', ship: me, x: s.x + x, y: s.y + y, kind: Struct.Wall }) as Command));
      exec(sim, [{ type: 'debug.giveItems', item: 'item.metal', count: 2000 }, ...doors]);
      // 3. Jobs inside: a door on every free floor tile, and a deconstruction of every module in the rooms that is not a bed or a light.
      buildJobs(sim, shipTiles(sim, 2, 2, 19, 6).concat(shipTiles(sim, 2, 12, 19, 6)), Struct.Door);
      const decon: Command[] = [...shipTiles(sim, 2, 2, 19, 6), ...shipTiles(sim, 2, 12, 19, 6)].map((t) => ({ type: 'job.deconstructModule', ship: me, x: t.x, y: t.y }) as Command);
      exec(sim, decon);
    },
  },
  {
    name: 'haul',
    description: 'Hauling flood: ~500 item stacks on the floors of the player ship and a trading hub beside it, few storage modules to take them.',
    ticks: 2500,
    populate: false,
    setup(sim) {
      const hub = spawnStation(sim, 'hub');
      const items = ['item.metal', 'item.scrap_hull', 'item.ration'].filter((i) => i in content.items);
      const cmds: Command[] = [];
      const floor = (ship: number): Tile[] => {
        const g = shipGrid(sim, ship)!;
        const out: Tile[] = [];
        for (let y = g.y0; y < g.y0 + g.height; y++) for (let x = g.x0; x < g.x0 + g.width; x++) {
          if (g.get('struct', x, y) === Struct.Floor && !g.get('module', x, y)) out.push({ x, y });
        }
        return out;
      };
      // One stack per free floor tile, cycling through a few items: every one of the player ship's, then the hub's until 500.
      const tiles = [...floor(homeShip(sim)).map((t) => [homeShip(sim), t] as const), ...floor(hub).map((t) => [hub, t] as const)];
      tiles.slice(0, 500).forEach(([ship, t], i) => cmds.push({ type: 'debug.spawnItems', ship, x: t.x, y: t.y, item: items[i % items.length]!, count: 5 }));
      exec(sim, cmds);
    },
  },
  {
    name: 'multiship',
    description: 'Multi-ship: the player ship, a trading station and a generated navy derelict (salvage: ~100 repair jobs on a wreck, mostly out of reach) in the same node. No prize or yard crew yet (TODO).',
    ticks: 5000,
    populate: false,
    setup(sim) {
      // The derelict first (at the spot the derelict tests use; the station spawner then finds its own free place).
      exec(sim, [{ type: 'debug.spawnDerelict', faction: 'faction.navy', depth: 2, seed: 3, cx: 130, cy: 70, intensity: 0.8, cause: 'combat' }]);
      spawnStation(sim, 'station');
    },
  },
];

export const scenarioNames = (): string[] => SCENARIOS.map((s) => s.name);
export const getScenario = (name: string): Scenario => {
  const s = SCENARIOS.find((x) => x.name === name);
  if (!s) throw new Error(`Unknown scenario "${name}". Known: ${scenarioNames().join(', ')}`);
  return s;
};
export const allScenarios = (): readonly Scenario[] => SCENARIOS;

/** Build a scenario's sim: `newGame(seed)` plus the scenario's setup. */
export function buildScenario(name: string, seed: number): Sim {
  const sc = getScenario(name);
  const sim = newGame(seed, content, undefined, sc.populate);
  sc.setup(sim);
  return sim;
}
