import { describe, expect, it } from 'vitest';
import { AirlockC, CombatC, ModuleC, ShipC, VehicleC, deserialize, galaxyIndex, newGame, playerShip, serialize, type Sim, type SimEvent } from '../sim';
import { spawnContact } from '../sim/galaxy/arrivals';
import { featureOf, offersHere, portOffers } from '../sim/galaxy/jobOffers';
import { CRATE, crateAboard, expireJobs } from '../sim/galaxy/jobs';
import { stationClass, type Port } from '../sim/galaxy/ports';
import { wreckShip } from '../sim/combat/wreck';
import { ItemStackC } from '../sim/items/components';
import { planStarRoute } from '../sim/galaxy/route';
import { portsAt } from '../sim/galaxy/portIndex';
import { repKey } from '../sim/galaxy/standing';
import { ensureAround } from '../sim/galaxy/state';
import { BREACH_NOTORIETY, MAX_JOBS } from '../sim/galaxy/tuningJobs';
import type { StationJob } from '../sim/galaxy/types';
import { playerStock } from '../sim/story/world';
import { content } from '.';

const rep = (sim: Sim, faction: string): number => sim.story.reputation[repKey(sim, faction)] ?? 0;

/** Put the player at a node, live (a debug teleport, then deploy). */
function goTo(sim: Sim, node: string): void {
  sim.enqueue({ type: 'debug.galaxyTeleport', node });
  sim.step();
  for (const [x, y] of [[100, 60], [20, 50], [60, 120], [150, 40], [30, 130], [170, 110], [10, 10]] as const) {
    if (sim.sector.state === 'active') break;
    sim.enqueue({ type: 'sector.deploy', x, y });
    sim.step();
  }
}

/** The player's node, any board (an offer of any kind), as a game: the first node near the start with a station, depot or den. */
function atBoard(seed = 3): Sim {
  const sim = newGame(seed, content);
  ensureAround(sim, sim.galaxy.current);
  if (!offersHere(sim).length) {
    const node = [...galaxyIndex(sim.galaxy).nodes.keys()].sort().find((n) => portsAt(sim, n).some((p) => p.kind === 'station' || p.kind === 'depot'));
    if (!node) throw new Error('no station');
    goTo(sim, node);
  }
  return sim;
}

/** Every port of the generated map with its offers, in node order. */
function boards(sim: Sim): { port: Port; offers: ReturnType<typeof portOffers> }[] {
  return [...galaxyIndex(sim.galaxy).nodes.keys()].sort().flatMap((n) => portsAt(sim, n).map((port) => ({ port, offers: portOffers(sim, port) })));
}

/** Go to the first port of a station class that posts an offer of `kind` (searching seeds in order), take it, and return the game with its job. */
function takeOffer(kind: 'delivery' | 'bounty' | 'survey', cls: string): { sim: Sim; job: StationJob } {
  for (let seed = 1; seed <= 12; seed++) {
    const sim = newGame(seed, content);
    ensureAround(sim, sim.galaxy.current);
    const hit = boards(sim).find((b) => stationClass(b.port) === cls && b.offers.some((o) => o.kind === kind));
    if (!hit) continue;
    if (hit.port.node !== sim.galaxy.current) goTo(sim, hit.port.node);
    const offer = portOffers(sim, hit.port).find((o) => o.kind === kind)!;
    accept(sim, offer.key);
    const job = sim.galaxy.jobs.find((j) => j.key === offer.key);
    if (job) return { sim, job };
  }
  throw new Error(`no ${kind} offer at a ${cls} station`);
}

const accept = (sim: Sim, key: string) => {
  sim.enqueue({ type: 'jobs.accept', key });
  sim.step();
  return sim.events.drain();
};

/** Step until `done` holds (at most `max` ticks), collecting the events. */
function until(sim: Sim, done: () => boolean, max = 4000): SimEvent[] {
  const seen: SimEvent[] = [];
  for (let i = 0; i < max && !done(); i++) {
    sim.step();
    seen.push(...sim.events.drain());
  }
  return seen;
}

describe('station jobs', () => {
  it('offers the same jobs, with the same keys, until the window turns over', () => {
    const sim = atBoard();
    const a = offersHere(sim);
    expect(a.length).toBeGreaterThan(0);
    expect(offersHere(sim)).toEqual(a);
    for (const o of a) expect(o.reward).toBeGreaterThan(0);
  });

  it('the station type decides the jobs: trade deliveries, military bounties, research surveys, dens a mix', () => {
    const count: Record<string, Record<string, number>> = {};
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sim = newGame(seed, content);
      ensureAround(sim, sim.galaxy.current);
      for (const b of boards(sim)) {
        const cls = stationClass(b.port) ?? b.port.kind;
        for (const o of b.offers) {
          count[cls] ??= {};
          count[cls]![o.kind] = (count[cls]![o.kind] ?? 0) + 1;
          expect(o.station, `${cls} offer carries its station class`).toBe(cls);
        }
      }
    }
    const kinds = (cls: string) => Object.keys(count[cls] ?? {}).sort();
    expect(kinds('trade')).toEqual(['delivery']);
    expect(kinds('military')).toEqual(['bounty']);
    expect(kinds('research')).toEqual(['survey']);
    for (const k of kinds('den')) expect(['bounty', 'delivery']).toContain(k);
  });

  it('a delivery: its crate comes aboard apart from storage; at the destination the station shuttle collects it from the airlock and the delivery pays then', () => {
    const { sim, job } = takeOffer('delivery', 'trade');
    const { item, to, reward, issuer } = job as Required<Pick<StationJob, 'item' | 'count' | 'to' | 'reward' | 'issuer'>>;
    const before = playerStock(sim, item);
    expect(sim.galaxy.jobs).toHaveLength(1);
    const id = job.id;
    // One crate on deck, tagged with the job; the goods are not in the hold, and haulers leave the crate where it is.
    expect(playerStock(sim, item)).toBe(before);
    expect(playerStock(sim, CRATE)).toBe(1);
    const crate = sim.world.query(ItemStackC).find((e) => sim.world.get(e, ItemStackC)?.job === id)!;
    const at = { ...sim.world.get(crate, ItemStackC)! };
    for (let i = 0; i < 300; i++) sim.step();
    expect(sim.world.get(crate, ItemStackC)).toMatchObject({ x: at.x, y: at.y, job: id });
    // Taken: it is no longer on the board.
    expect(offersHere(sim).some((o) => o.key === job.key)).toBe(false);
    const credits = sim.trade.credits;
    const standing = rep(sim, issuer);
    goTo(sim, to);
    sim.events.drain();
    // Arriving does not pay: the station sends its shuttle, which docks and takes the crate when the crew have carried it over.
    const seen = until(sim, () => sim.galaxy.jobs.length === 0);
    expect(sim.galaxy.jobs).toHaveLength(0);
    const types = seen.map((e) => e.type);
    expect(types.indexOf('job.shuttleSent')).toBeGreaterThanOrEqual(0);
    expect(types.indexOf('job.handedOver')).toBeGreaterThan(types.indexOf('job.shuttleSent'));
    expect(seen.find((e) => e.type === 'job.handedOver')).toMatchObject({ id, reward, via: 'shuttle' });
    expect(sim.trade.credits).toBe(credits + reward);
    expect(rep(sim, issuer)).toBe(standing + 1);
    expect(playerStock(sim, CRATE)).toBe(0);
    expect(crateAboard(sim, id)).toBe(false);
    // The shuttle goes home and is gone.
    until(sim, () => sim.world.query(VehicleC).length === 1 || !sim.trade.deals.some((d) => d.handover && d.vehicle), 2000);
    expect(sim.trade.deals.some((d) => d.handover && d.phase === 'done')).toBe(true);
  });

  it('the delivery is not paid before the shuttle has the crate', () => {
    const { sim, job } = takeOffer('delivery', 'trade');
    goTo(sim, job.to!);
    const credits = sim.trade.credits;
    until(sim, () => sim.trade.deals.some((d) => d.handover && d.phase === 'load'));
    expect(sim.galaxy.jobs).toHaveLength(1);
    expect(sim.trade.credits).toBe(credits);
    expect(crateAboard(sim, job.id)).toBe(true);
  });

  it('with no working airlock the crate is handed across by hand at once, still paying', () => {
    const { sim, job } = takeOffer('delivery', 'trade');
    goTo(sim, job.to!);
    for (const id of sim.world.query(AirlockC, ModuleC)) sim.world.get(id, ModuleC)!.enabled = false;
    const seen = until(sim, () => sim.galaxy.jobs.length === 0, 200);
    expect(seen.find((e) => e.type === 'job.handedOver')).toMatchObject({ id: job.id, via: 'instant' });
    expect(sim.trade.credits).toBeGreaterThanOrEqual(job.reward);
    expect(playerStock(sim, CRATE)).toBe(0);
  });

  it('in combat the shuttle is held back, the crate stays and the job stays open; when it is over the shuttle comes', () => {
    const { sim, job } = takeOffer('delivery', 'trade');
    goTo(sim, job.to!);
    // A hostile ship at the node (any bounty target will do).
    const foe = boards(sim).flatMap((b) => b.offers).find((o) => o.kind === 'bounty')!;
    const c = { id: 9001, faction: foe.targetFaction!, shipgen: foe.shipgen!, seed: foe.seed ?? 0, depth: 1, since: 0 };
    expect(spawnContact(sim, sim.galaxy.current, c)).toBe(true);
    sim.events.drain();
    until(sim, () => sim.sector.inCombat, 40);
    expect(sim.sector.inCombat).toBe(true);
    for (const d of sim.trade.deals) expect(d.handover).toBeUndefined();
    for (let i = 0; i < 100; i++) sim.step();
    expect(sim.galaxy.jobs).toHaveLength(1);
    expect(playerStock(sim, CRATE)).toBe(1);
    expect(sim.trade.deals.some((d) => d.handover && d.phase !== 'failed')).toBe(false);
    wreckShip(sim, (c as { ship?: number }).ship!);
    until(sim, () => sim.galaxy.jobs.length === 0);
    expect(sim.galaxy.jobs).toHaveLength(0);
  });

  it('a delivery not made in time costs reputation and notoriety; the crate is broken open and its goods spill as stolen goods', () => {
    const sim = atBoard();
    const offer = offersHere(sim).find((o) => o.kind === 'delivery')!;
    const before = playerStock(sim, offer.item!);
    accept(sim, offer.key);
    const job = sim.galaxy.jobs[0]!;
    expireJobs(sim, job.due + 1);
    expect(sim.galaxy.jobs).toHaveLength(0);
    expect(playerStock(sim, CRATE)).toBe(0);
    expect(playerStock(sim, offer.item!)).toBe(before);
    expect(playerStock(sim, 'item.stolen_goods')).toBe(offer.count!);
    expect(rep(sim, job.issuer)).toBe(-1);
    expect(sim.galaxy.heat.notoriety).toBe(BREACH_NOTORIETY);
  });

  it('breaking a crate open on deck fails the delivery and spills its goods as stolen goods', () => {
    const sim = atBoard();
    const offer = offersHere(sim).find((o) => o.kind === 'delivery')!;
    const before = playerStock(sim, offer.item!);
    accept(sim, offer.key);
    const job = sim.galaxy.jobs[0]!;
    sim.enqueue({ type: 'jobs.openCrate', id: job.id });
    sim.step();
    expect(sim.galaxy.jobs).toHaveLength(0);
    expect(playerStock(sim, CRATE)).toBe(0);
    expect(playerStock(sim, offer.item!)).toBe(before);
    expect(playerStock(sim, 'item.stolen_goods')).toBe(offer.count!);
    expect(rep(sim, job.issuer)).toBe(-1);
    expect(sim.galaxy.heat.notoriety).toBe(BREACH_NOTORIETY);
    sim.enqueue({ type: 'jobs.openCrate', id: job.id });
    sim.step();
    expect(sim.events.drain().some((e) => e.type === 'command.rejected' && e.reason === 'noJob')).toBe(true);
  });

  it('accepting a distant delivery reveals the route, so the starmap can plot it', () => {
    let tested = 0;
    for (const seed of [1, 3, 7, 42]) {
      const sim = atBoard(seed);
      const far = offersHere(sim).filter((o) => o.kind === 'delivery').sort((a, b) => planStarRoute(sim.galaxy, sim.galaxy.current, b.to!, { known: false })!.path.length - planStarRoute(sim.galaxy, sim.galaxy.current, a.to!, { known: false })!.path.length)[0];
      if (!far) continue;
      const full = planStarRoute(sim.galaxy, sim.galaxy.current, far.to!, { known: false })!;
      if (full.path.length < 3) continue;
      const hidden = full.path.slice(1, -1).some((n) => sim.galaxy.discovered[n] === undefined);
      accept(sim, far.key);
      const known = planStarRoute(sim.galaxy, sim.galaxy.current, far.to!);
      expect(known, `seed ${seed} (${hidden ? 'had' : 'no'} unknown legs)`).not.toBeNull();
      expect(known!.path).toEqual(full.path);
      tested++;
    }
    expect(tested).toBeGreaterThan(0);
  });

  it('a bounty places its named target at an unvisited node; the kill completes it without paying, and it is handed in at a military station of the issuer', () => {
    const { sim, job } = takeOffer('bounty', 'military');
    expect(sim.galaxy.nodes[job.node!]?.contacts.some((c) => c.bounty === job.id && c.name === job.target)).toBe(true);
    // The issuer marks the target's node on the map.
    expect(sim.galaxy.discovered[job.node!]).toBeDefined();
    const issuingNode = portsAt(sim, sim.galaxy.current).find((p) => p.id === job.from)!.node;
    goTo(sim, job.node!);
    const target = sim.world.query(ShipC).find((id) => sim.world.get(id, ShipC)?.bounty === job.id);
    expect(target).toBeDefined();
    const credits = sim.trade.credits;
    const c = sim.world.get(playerShip(sim), CombatC)!;
    c.target = { ship: target!, moduleId: 0 };
    wreckShip(sim, target!);
    // Leave at once, before the galaxy system's next tally (a teleport settles the losses first): the kill still counts.
    sim.events.drain();
    const away = [...galaxyIndex(sim.galaxy).nodes.keys()].sort().find((n) => portsAt(sim, n).every((p) => stationClass(p) !== 'military'))!;
    goTo(sim, away);
    expect(sim.events.drain().some((e) => e.type === 'job.completed' && e.id === job.id)).toBe(true);
    // Completed: not a task any more, not paid yet, kept as a claim that never expires.
    expect(sim.galaxy.jobs.some((j) => j.id === job.id)).toBe(false);
    expect(sim.trade.credits).toBe(credits);
    expect(sim.galaxy.claims.map((j) => j.id)).toEqual([job.id]);
    expireJobs(sim, job.due + 1000);
    expect(sim.galaxy.claims).toHaveLength(1);
    // The claim survives a save.
    expect(deserialize(serialize(sim), content).galaxy.claims).toEqual(sim.galaxy.claims);
    // Handing in is refused away from a matching station, then pays at one.
    sim.enqueue({ type: 'jobs.handIn', id: job.id });
    sim.step();
    expect(sim.events.drain().some((e) => e.type === 'command.rejected' && e.reason === 'notHere')).toBe(true);
    expect(sim.trade.credits).toBe(credits);
    goTo(sim, issuingNode);
    const standing = rep(sim, job.issuer);
    sim.enqueue({ type: 'jobs.handIn', id: job.id });
    sim.step();
    const ev = sim.events.drain();
    expect(ev.find((e) => e.type === 'job.handedIn')).toMatchObject({ id: job.id, reward: job.reward });
    expect(sim.trade.credits).toBe(credits + job.reward);
    expect(rep(sim, job.issuer)).toBe(standing + 1);
    expect(sim.galaxy.claims).toHaveLength(0);
  });

  it('a survey is completed by entering its node, never expires, and is handed in at a research station of the issuer only', () => {
    const { sim, job } = takeOffer('survey', 'research');
    expect(featureOf(sim, job.node!)).toBe(job.feature);
    expect(job.reward).toBeGreaterThan(0);
    expect(sim.galaxy.discovered[job.node!]).toBeDefined();
    const issuingNode = portsAt(sim, sim.galaxy.current).find((p) => p.id === job.from)!.node;
    const credits = sim.trade.credits;
    goTo(sim, job.node!);
    until(sim, () => sim.galaxy.claims.length > 0, 100);
    expect(sim.galaxy.jobs).toHaveLength(0);
    expect(sim.galaxy.claims.map((j) => j.id)).toEqual([job.id]);
    expect(sim.trade.credits).toBe(credits);
    goTo(sim, issuingNode);
    sim.enqueue({ type: 'jobs.handIn', id: job.id });
    sim.step();
    expect(sim.trade.credits).toBe(credits + job.reward);
    expect(sim.galaxy.claims).toHaveLength(0);
  });

  it('a claim is handed in only at the issuer\'s own station type: a trade station of the same faction does not take a bounty', () => {
    const { sim, job } = takeOffer('bounty', 'military');
    sim.galaxy.jobs = [];
    sim.galaxy.claims = [{ ...job }];
    const trade = boards(sim).find((b) => stationClass(b.port) === 'trade' && b.port.owner === job.issuer);
    if (!trade) return; // this seed's issuer runs no trade station in reach: nothing to check
    goTo(sim, trade.port.node);
    sim.enqueue({ type: 'jobs.handIn', id: job.id });
    sim.step();
    expect(sim.events.drain().some((e) => e.type === 'command.rejected' && e.reason === 'notHere')).toBe(true);
    expect(sim.galaxy.claims).toHaveLength(1);
  });

  it('the debug scenarios set up a handover and hand-ins that work', () => {
    const sim = newGame(3, content);
    ensureAround(sim, sim.galaxy.current);
    // A fresh game has no station ship at the start node: put one beside the ship, as the scenario does.
    sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 5 });
    sim.enqueue({ type: 'debug.jobScenario', name: 'handover' });
    sim.step();
    expect(sim.galaxy.jobs.map((j) => j.kind)).toEqual(['delivery']);
    const seen = until(sim, () => sim.galaxy.jobs.length === 0);
    expect(seen.find((e) => e.type === 'job.handedOver')).toMatchObject({ via: 'shuttle' });
    for (const name of ['bounty', 'survey'] as const) {
      const other = newGame(3, content);
      ensureAround(other, other.galaxy.current);
      other.enqueue({ type: 'debug.jobScenario', name });
      other.step();
      expect(other.galaxy.claims).toHaveLength(1);
      for (const [x, y] of [[100, 60], [20, 50], [60, 120], [150, 40], [30, 130], [170, 110], [10, 10]] as const) {
        if (other.sector.state === 'active') break;
        other.enqueue({ type: 'sector.deploy', x, y });
        other.step();
      }
      const credits = other.trade.credits;
      other.enqueue({ type: 'jobs.handIn', id: other.galaxy.claims[0]!.id });
      other.step();
      expect(other.trade.credits).toBe(credits + 400);
    }
  });

  it('holds at most MAX_JOBS, refuses unknown offers, and saves', () => {
    const sim = atBoard();
    for (let i = 0; i < MAX_JOBS; i++) sim.galaxy.jobs.push({ id: 200 + i, key: `k${i}`, kind: 'bounty', issuer: 'navy', from: 'x#0', reward: 1, due: 999 });
    const offer = offersHere(sim)[0]!;
    expect(accept(sim, offer.key).some((e) => e.type === 'command.rejected' && e.reason === 'tooMany')).toBe(true);
    sim.galaxy.jobs = [];
    expect(accept(sim, 'nope').some((e) => e.type === 'command.rejected' && e.reason === 'noOffer')).toBe(true);
    accept(sim, offer.key);
    const back = deserialize(serialize(sim), content);
    expect(back.galaxy.jobs).toEqual(sim.galaxy.jobs);
    expect(back.galaxy.jobLog).toEqual(sim.galaxy.jobLog);
    expect(back.galaxy.claims).toEqual(sim.galaxy.claims);
  });
});
