// Live panels for the guides (<GamePanel>): each recipe starts a real game headless, sets a scene up with the game's own
// commands (often a debug scenario's), runs it a few seconds, and records what the UI would be handed: the data feeds of
// the game's own UI bridge (src/app/bridge.ts, the same code the game runs), plus any props a panel takes directly.
// The wiki build saves the results (capture-panels.ts); pages read them through src/lib/panels.ts, typed by these
// recipes' return types, so a changed panel shape fails the check. Runs in Node at build time only.
import { content } from '../../src/content/index.ts';
import { newGame, type Command, type Sim } from '../../src/sim/index.ts';
import { createBridge, type Bridge } from '../../src/app/bridge.ts';
import type { Readable } from '../../src/app/store.ts';
import { droneScenarioCommands } from '../../src/app/droneScenario.ts';
import { buildTrade } from '../../src/app/tradeSnapshot.ts';
import { upgradeScenarioCommands } from '../../src/app/upgradeScenario.ts';
import { buildStructCosts } from '../../src/app/logisticsSnapshot.ts';
import { portsAt, nodesWithin } from '../../src/sim/index.ts';
import { stationClass } from '../../src/sim/galaxy/ports.ts';
import { buildJobs } from '../../src/app/jobsSnapshot.ts';

/** The bridge's data feeds by name, as values ("modules" -> UiModule[]). */
export type Feeds = { [K in keyof Bridge as Bridge[K] extends Readable<unknown> ? K : never]: Bridge[K] extends Readable<infer T> ? T : never };
export type FeedKey = keyof Feeds;

/** A seeded new game on `ship` (a starter), run `warm` seconds, then `commands`, then `secs` more. */
export function scene(opts: { seed?: number; ship?: string; commands?: (sim: Sim) => Command[]; secs?: number; warm?: number }): Sim {
  const sim = newGame(opts.seed ?? 3, content, opts.ship ?? 'ship.wayfarer');
  const step = (s: number) => { for (let i = 0; i < s * 20; i++) { sim.step(); sim.events.drain(); } };
  step(opts.warm ?? 1);
  for (const c of opts.commands?.(sim) ?? []) sim.enqueue(c);
  step(opts.secs ?? 2);
  return sim;
}

/** Record bridge feeds after `drive` points the bridge at something (select a module, watch a crew member, a station). */
export function record<K extends FeedKey>(sim: Sim, keys: readonly K[], drive?: (b: Bridge) => void): Pick<Feeds, K> {
  const bridge = createBridge(sim);
  drive?.(bridge);
  bridge.refresh();
  const out = {} as Pick<Feeds, K>;
  for (const k of keys) {
    let value: unknown;
    (bridge[k] as Readable<unknown>).subscribe((v) => { value = v; })();
    out[k] = value as Feeds[K];
  }
  return out;
}

export function must<T>(value: T | undefined | null, what: string): T {
  if (value == null) throw Error('Panel recipe found no ' + what);
  return value;
}

/** The jobs board at the nearest station of a class (the start node's for trade): a game taken there, the first offer accepted. */
function jobsAt(cls: 'trade' | 'military' | 'research') {
  const sim = scene({ seed: 3 });
  const here = sim.galaxy.current;
  const near = [...nodesWithin(sim, here, 12)].sort((a, b) => a[1] - b[1]).map(([id]) => id).find((id) => portsAt(sim, id).some((p) => stationClass(p) === cls));
  if (near === undefined) throw Error('Panel recipe found no ' + cls + ' station');
  if (near !== here) sim.enqueue({ type: 'debug.galaxyTeleport', node: near });
  const run = (n: number) => { for (let i = 0; i < n; i++) { sim.step(); sim.events.drain(); } };
  run(40);
  // A new node waits for the ship to be placed (the deploy picker): try spots until one is accepted.
  for (const [x, y] of [[100, 60], [20, 50], [60, 120], [150, 40], [30, 130], [170, 110], [10, 10]] as const) {
    if (sim.sector.state !== 'deploying') break;
    sim.enqueue({ type: 'sector.deploy', x, y });
    run(10);
  }
  run(40);
  const first = must(buildJobs(sim).offers[0], cls + ' offer');
  sim.enqueue({ type: 'jobs.accept', key: first.key });
  for (let i = 0; i < 40; i++) { sim.step(); sim.events.drain(); }
  return record(sim, ['jobs']);
}

export const panels = {
  /** The module inspector on a drone bay: one repair drone out sealing a hull breach, one docked (the drone scenario). */
  droneBay: () => {
    const sim = scene({ seed: 7, ship: 'ship.starter', commands: (s) => droneScenarioCommands(s, false, true), secs: 4 });
    const { modules } = record(sim, ['modules']);
    return { module: must(modules.find((m) => m.def === 'module.droneBay'), 'drone bay') };
  },
  /** The Crew window's Schedule tab: the starting crew on their day plans, the clock a few hours in. */
  schedule: () => {
    const sim = scene({ seed: 3, warm: 1, secs: 2 });
    const { crew, snapshot } = record(sim, ['crew', 'snapshot']);
    return { crew, snapshot };
  },
  /** The jobs board at the start (trade) station: its deliveries, the first already taken. */
  jobsBoard: () => jobsAt('trade'),
  /** The jobs board at the nearest military station: bounties, the first already taken. */
  jobsMilitary: () => jobsAt('military'),
  /** The jobs board at the nearest research station: surveys, the first already taken. */
  jobsResearch: () => jobsAt('research'),
  /** The Trade window with a trade outpost hailed: a deal on the slip (three units bought, two sold). */
  trade: () => {
    const sim = scene({ seed: 3, commands: () => [{ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4 }], secs: 2 });
    const station = must(buildTrade(sim).partners.find((p) => p.station), 'trade station');
    sim.enqueue({ type: 'trade.hail', ship: station.id });
    for (let i = 0; i < 60; i++) { sim.step(); sim.events.drain(); }
    const { trade } = record(sim, ['trade']);
    const partner = must(trade.partners.find((p) => p.id === station.id), 'hailed station');
    const buy = must(partner.lines.find((l) => l.theirs >= 3 && l.sell > 0), 'item to buy');
    const sell = must(partner.lines.find((l) => l.mine >= 2 && l.buy > 0 && l.item !== buy.item && !l.contraband), 'item to sell');
    return { trade, partner: station.id, draft: { [buy.item]: 3, [sell.item]: -2 } as Record<string, number> };
  },
  /** The Power... view of a module on the starting ship: the whole ship's order, the module's own row marked. */
  power: () => {
    const sim = scene({ seed: 3 });
    const { modules } = record(sim, ['modules']);
    const mine = must(modules.find((m) => m.def === 'module.burstLaser'), 'power consumer');
    return { module: mine, modules: modules.filter((m) => m.power !== 0) }; // the panel reads only the drawing and supplying ones
  },
  /** A weapon's upgrade slot: a burst laser with a prism splitter fitted and other upgrades in cargo (the upgrades scenario). */
  upgrade: () => {
    const sim = scene({ seed: 3, commands: upgradeScenarioCommands, secs: 2 });
    const { modules } = record(sim, ['modules']);
    return { module: must(modules.find((m) => m.def === 'module.burstLaser' && m.upgradeSlot?.fitted), 'upgraded burst laser') };
  },
  /** The build menu with a reactor picked: the Power tab, its cards with costs, the reactor marked PLACING. */
  buildMenu: () => {
    const sim = scene({ seed: 3 });
    const feeds = record(sim, ['moduleDefs', 'stock', 'mining']);
    return { ...feeds, structCosts: buildStructCosts(sim), tool: { tool: 'build', build: 'module', moduleDef: 'module.reactor', rot: 0 } as const };
  },
};
