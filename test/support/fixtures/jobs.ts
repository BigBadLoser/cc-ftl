/** Shared setup for the station-job tests: a game at a board, an accepted offer, and the delivery arrived at its destination (both cached per worker). */
import { content } from '../content';
import type { SimEvent } from '../../../src/sim/events';
import { galaxyIndex, ensureAround } from '../../../src/sim/galaxy/state';
import { offersHere, portOffers } from '../../../src/sim/galaxy/jobOffers';
import { portsAt } from '../../../src/sim/galaxy/portIndex';
import { stationClass, type Port } from '../../../src/sim/galaxy/ports';
import { repKey } from '../../../src/sim/galaxy/standing';
import type { StationJob } from '../../../src/sim/galaxy/types';
import { newGame } from '../../../src/sim/newGame';
import type { Sim } from '../../../src/sim/sim';
import { cachedWorld } from '../world';

export const rep = (sim: Sim, faction: string): number => sim.story.reputation[repKey(sim, faction)] ?? 0;

/** Put the player at a node, live (a debug teleport, then deploy). */
export function goTo(sim: Sim, node: string): void {
  sim.enqueue({ type: 'debug.galaxyTeleport', node });
  sim.step();
  for (const [x, y] of [[100, 60], [20, 50], [60, 120], [150, 40], [30, 130], [170, 110], [10, 10]] as const) {
    if (sim.sector.state === 'active') break;
    sim.enqueue({ type: 'sector.deploy', x, y });
    sim.step();
  }
}

/** A new game of `seed` with the map around the start generated (cached per worker; each call is a fresh clone). */
export const aroundGame = (seed: number): Sim =>
  cachedWorld(`jobs.around.${seed}`, () => {
    const sim = newGame(seed, content);
    ensureAround(sim, sim.galaxy.current);
    return sim;
  });

/** The player's node, any board (an offer of any kind), as a game: the first node near the start with a station, depot or den. */
export function atBoard(seed = 3): Sim {
  const sim = aroundGame(seed);
  if (!offersHere(sim).length) {
    const node = [...galaxyIndex(sim.galaxy).nodes.keys()].sort().find((n) => portsAt(sim, n).some((p) => p.kind === 'station' || p.kind === 'depot'));
    if (!node) throw new Error('no station');
    goTo(sim, node);
  }
  return sim;
}

/** Every port of the generated map with its offers, in node order. */
export function boards(sim: Sim): { port: Port; offers: ReturnType<typeof portOffers> }[] {
  return [...galaxyIndex(sim.galaxy).nodes.keys()].sort().flatMap((n) => portsAt(sim, n).map((port) => ({ port, offers: portOffers(sim, port) })));
}

export const accept = (sim: Sim, key: string) => {
  sim.enqueue({ type: 'jobs.accept', key });
  sim.step();
  return sim.events.drain();
};

/** A game that has taken the first offer of `kind` at a station class (searching seeds in order): the game and its one job. Cached; each call is a fresh clone. */
export function takeOffer(kind: 'delivery' | 'bounty' | 'survey', cls: string): { sim: Sim; job: StationJob } {
  const sim = cachedWorld(`jobs.take.${kind}.${cls}`, () => {
    for (let seed = 1; seed <= 12; seed++) {
      const g = aroundGame(seed);
      const hit = boards(g).find((b) => stationClass(b.port) === cls && b.offers.some((o) => o.kind === kind));
      if (!hit) continue;
      if (hit.port.node !== g.galaxy.current) goTo(g, hit.port.node);
      const offer = portOffers(g, hit.port).find((o) => o.kind === kind)!;
      accept(g, offer.key);
      if (g.galaxy.jobs.some((j) => j.key === offer.key)) return g;
    }
    throw new Error(`no ${kind} offer at a ${cls} station`);
  });
  return { sim, job: sim.galaxy.jobs[0]! };
}

/** The accepted trade delivery with the player already at its destination (events from the arrival are not carried over). */
export function arrivedDelivery(): { sim: Sim; job: StationJob } {
  const sim = cachedWorld('jobs.arrived.delivery.trade', () => {
    const { sim: s, job } = takeOffer('delivery', 'trade');
    goTo(s, job.to!);
    return s;
  });
  return { sim, job: sim.galaxy.jobs[0]! };
}

/** The arrived delivery stepped to the moment the player's shuttle is out with the crate on board (cached): the run on to the drop-off is the test's. */
export function shuttleOut(): { sim: Sim; job: StationJob } {
  const sim = cachedWorld('jobs.shuttleOut.delivery.trade', () => {
    const { sim: s } = arrivedDelivery();
    until(s, () => s.trade.deals.some((d) => d.handover && d.phase === 'out'));
    return s;
  });
  return { sim, job: sim.galaxy.jobs[0]! };
}

/** Step until `done` holds (at most `max` ticks), collecting the events. */
export function until(sim: Sim, done: () => boolean, max = 4000): SimEvent[] {
  const seen: SimEvent[] = [];
  for (let i = 0; i < max && !done(); i++) {
    sim.step();
    seen.push(...sim.events.drain());
  }
  return seen;
}
