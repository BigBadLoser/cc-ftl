/**
 * Dev-only starmap playtest (nothing in src/ imports this): a new game travels N jumps through the real sim, heading for
 * exits of the current sector (rotating gate, rift and plain lanes), with FTL charge and fuel topped up like a pilot
 * and a trader would. After each jump it rebuilds the starmap the way the UI does and checks it; every `saveEvery`
 * jumps it saves, reloads and compares. Returns stats and the list of failed checks.
 */
import {
  CombatC, FTL_CHARGE_SEC, deserialize, edgeBetween, galaxyIndex, newGame, planStarRoute, playerShip, serialize, type Sim,
} from '../../src/sim';
import { jumpCosts } from '../../src/sim/galaxy/costs';
import { giveItems } from '../../src/sim/story/effects';
import { playerStock } from '../../src/sim/story/world';
import { buildStarmap } from '../../src/app/starmapSnapshot';
import { prefetchGalaxy, prefetchStart } from '../../src/app/galaxyPrefetch';
import { content } from '../../src/content';

export interface PlaytestResult {
  stats: Record<string, number | string>;
  failures: string[];
  log: string[];
}

export function playtest(seed: number, jumps: number, saveEvery = 10, prefetch = 0): PlaytestResult {
  let sim: Sim = newGame(seed, content);
  // With `prefetch`, run the app's prefetcher like the game does: the start ring first, then `prefetch` calls between jumps.
  const prefetchMs: number[] = [];
  let startMs = 0;
  if (prefetch) {
    const t0 = performance.now();
    prefetchStart(sim);
    startMs = performance.now() - t0;
  }
  const failures: string[] = [];
  const log: string[] = [];
  const fail = (msg: string) => failures.push(`jump ${done}: ${msg}`);
  const sectorsSeen = new Set<string>();
  const regionsSeen = new Set<string>();
  const buildMs: number[] = [];
  const stepMs: number[] = [];
  let done = 0;
  let gates = 0;
  let rifts = 0;
  let crossings = 0;
  let saves = 0;
  let target: string | null = null;
  const kinds = ['gate', 'rift', 'lane'] as const;

  for (let guard = 0; done < jumps && guard < jumps * 20; guard++) {
    let t = performance.now();
    const map = buildStarmap(sim);
    buildMs.push(performance.now() - t);
    const here = map.sectors.find((s) => s.id === map.currentSector);
    sectorsSeen.add(map.currentSector);
    if (map.currentRegion) regionsSeen.add(map.currentRegion);

    // Checks on the map the UI would draw.
    if (!here) fail(`current sector ${map.currentSector} missing from the map`);
    else {
      if (!here.known) fail('current sector not known');
      if (!here.outline) fail('current sector has no outline');
      if ((here.region ?? null) !== map.currentRegion) fail('currentRegion does not match the sector');
    }
    const cur = map.nodes.find((n) => n.current);
    if (!cur || cur.id !== sim.galaxy.current) fail('current node flag wrong');
    const adj = new Set((galaxyIndex(sim.galaxy).adjacent.get(sim.galaxy.current) ?? []).map((e) => (e.a === sim.galaxy.current ? e.b : e.a)));
    for (const n of map.nodes) if (n.reachable !== adj.has(n.id)) fail(`reachable flag wrong on ${n.id}`);
    for (const e of map.exits) if (!map.sectors.some((s) => s.id === e.to)) fail(`exit ${e.id} leads to a missing sector`);
    if (map.currentRegion && !map.regions.some((r) => r.id === map.currentRegion && r.current && r.known)) fail('current region not marked current and known');

    // Pick an exit of this sector, rotating the kinds we prefer. Like a player: plot to its gateway (routes only run
    // through discovered space), then jump across from there.
    if (!target || target === sim.galaxy.current || !map.exits.some((e) => e.id === target)) {
      const want = kinds[done % kinds.length];
      const pool = map.exits.filter((e) => e.kind === want);
      const list = pool.length ? pool : map.exits;
      const exit = list[(done * 7) % Math.max(1, list.length)];
      if (!exit) {
        fail('no exit from this sector');
        break;
      }
      target = exit.id;
    }
    const lane = galaxyIndex(sim.galaxy).edges.get(target);
    if (!lane) {
      fail(`exit ${target} is not a generated edge`);
      break;
    }
    const gateway = galaxyIndex(sim.galaxy).nodes.get(lane.a)?.sector === map.currentSector ? lane.a : lane.b;
    const far = gateway === lane.a ? lane.b : lane.a;
    let next: string | undefined;
    if (sim.galaxy.current === gateway) {
      next = far;
      target = null;
    } else {
      next = planStarRoute(sim.galaxy, sim.galaxy.current, gateway)?.path[1];
      if (!next) {
        fail(`no route to the gateway ${gateway} of a shown exit`);
        target = null;
        break;
      }
    }
    const edge = edgeBetween(sim.galaxy, sim.galaxy.current, next);
    if (!edge) {
      fail(`no edge to ${next}`);
      break;
    }
    if (edge.kind === 'hyperlane' && edge.fuel !== jumpCosts('hyperlane', edge.length, !!edge.gate).fuel) fail(`fuel on ${edge.id} does not match its costs`);

    for (let k = 0; k < prefetch; k++) {
      const t0 = performance.now();
      if (!prefetchGalaxy(sim)) break;
      prefetchMs.push(performance.now() - t0);
    }
    // Top up like a pilot and a trader would, then jump through the real command.
    const combat = sim.world.get(playerShip(sim)?.id ?? -1, CombatC);
    if (combat) combat.ftl = FTL_CHARGE_SEC;
    if (playerStock(sim, 'item.fuel') < edge.fuel + 2) giveItems(sim, 'item.fuel', 20);
    const fuelBefore = playerStock(sim, 'item.fuel');
    const fromSector = galaxyIndex(sim.galaxy).nodes.get(sim.galaxy.current)?.sector;
    sim.events.drain();
    sim.enqueue({ type: 'galaxy.jump', to: next });
    t = performance.now();
    sim.step();
    stepMs.push(performance.now() - t);
    const rejected = sim.events.drain().filter((e) => e.type === 'command.rejected');
    if (rejected.length) {
      fail(`jump rejected: ${JSON.stringify(rejected[0])}`);
      break;
    }
    if (sim.galaxy.current !== next) fail(`did not arrive at ${next}`);
    const spent = fuelBefore - playerStock(sim, 'item.fuel');
    if (spent !== edge.fuel) fail(`spent ${spent} fuel, the edge said ${edge.fuel}`);
    done++;
    if (edge.gate) gates++;
    if (edge.rift) rifts++;
    const toSector = galaxyIndex(sim.galaxy).nodes.get(next)?.sector;
    if (toSector !== fromSector) crossings++;
    log.push(`${done}: ${edge.kind}${edge.gate ? '+gate' : ''}${edge.rift ? '+rift' : ''} -> ${next} (${edge.fuel} fuel)`);

    // Save and reload: the reloaded game must draw the same map.
    if (done % saveEvery === 0) {
      const before = JSON.stringify({ ...buildStarmap(sim), rev: 0 });
      const loaded = deserialize(serialize(sim), content);
      const after = JSON.stringify({ ...buildStarmap(loaded), rev: 0 });
      if (before !== after) fail('the map differs after save and reload');
      sim = loaded;
      saves++;
    }
  }
  const avg = (l: number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0);
  return {
    failures, log,
    stats: {
      seed, jumps: done, sectorCrossings: crossings, gates, rifts, saves, sectors: sectorsSeen.size, regions: regionsSeen.size,
      chunks: Object.keys(sim.galaxy.chunks).length, buildMsAvg: +avg(buildMs).toFixed(1), buildMsMax: +Math.max(...buildMs).toFixed(1),
      jumpMsAvg: +avg(stepMs).toFixed(1), jumpMsMax: +Math.max(...stepMs).toFixed(1),
      startPrefetchMs: +startMs.toFixed(0), prefetchCallMsMax: +Math.max(0, ...prefetchMs).toFixed(1),
    },
  };
}
