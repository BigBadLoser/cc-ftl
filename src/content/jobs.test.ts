import { describe, expect, it } from 'vitest';
import { CombatC, ShipC, deserialize, galaxyIndex, newGame, playerShip, serialize, type Sim } from '../sim';
import { offersHere, portOffers } from '../sim/galaxy/jobOffers';
import { expireJobs } from '../sim/galaxy/jobs';
import { wreckShip } from '../sim/combat/wreck';
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
  for (const [x, y] of [[100, 60], [20, 50]] as const) {
    if (sim.sector.state === 'active') break;
    sim.enqueue({ type: 'sector.deploy', x, y });
    sim.step();
  }
}

/** A game at a node with job offers (the first station node near the start, in id order). */
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

const accept = (sim: Sim, key: string) => {
  sim.enqueue({ type: 'jobs.accept', key });
  sim.step();
  return sim.events.drain();
};

describe('station jobs', () => {
  it('offers the same jobs, with the same keys, until the window turns over', () => {
    const sim = atBoard();
    const a = offersHere(sim);
    expect(a.length).toBeGreaterThan(0);
    expect(offersHere(sim)).toEqual(a);
    for (const o of a) expect(o.reward).toBeGreaterThan(0);
  });

  it('a delivery: the goods come aboard, are handed over at the destination, and pay', () => {
    const sim = atBoard();
    const offer = offersHere(sim).find((o) => o.kind === 'delivery');
    expect(offer).toBeDefined();
    const { item, count, to, reward, issuer } = offer as Required<Pick<StationJob, 'item' | 'count' | 'to' | 'reward' | 'issuer'>>;
    const before = playerStock(sim, item);
    accept(sim, offer!.key);
    expect(sim.galaxy.jobs).toHaveLength(1);
    expect(playerStock(sim, item)).toBe(before + count);
    // Taken: it is no longer on the board.
    expect(offersHere(sim).some((o) => o.key === offer!.key)).toBe(false);
    const credits = sim.trade.credits;
    const standing = rep(sim, issuer);
    goTo(sim, to);
    for (let i = 0; i < 40 && sim.galaxy.jobs.length; i++) sim.step();
    expect(sim.galaxy.jobs).toHaveLength(0);
    expect(sim.trade.credits).toBe(credits + reward);
    expect(rep(sim, issuer)).toBe(standing + 1);
    expect(playerStock(sim, item)).toBe(before);
  });

  it('a delivery not made in time costs reputation and notoriety (the goods were kept)', () => {
    const sim = atBoard();
    const offer = offersHere(sim).find((o) => o.kind === 'delivery')!;
    accept(sim, offer.key);
    const job = sim.galaxy.jobs[0]!;
    expireJobs(sim, job.due + 1);
    expect(sim.galaxy.jobs).toHaveLength(0);
    expect(rep(sim, job.issuer)).toBe(-1);
    expect(sim.galaxy.heat.notoriety).toBe(BREACH_NOTORIETY);
  });

  it('a bounty places its named target at an unvisited node and pays when the player destroys it there', () => {
    const sim = atBoard();
    // Bounties come up half the time a slot is drawn: look over the ports in reach for one.
    let offer = offersHere(sim).find((o) => o.kind === 'bounty');
    for (const n of [...galaxyIndex(sim.galaxy).nodes.keys()].sort()) {
      if (offer) break;
      offer = portsAt(sim, n).flatMap((p) => portOffers(sim, p)).find((o) => o.kind === 'bounty');
      if (offer) goTo(sim, n);
    }
    expect(offer).toBeDefined();
    accept(sim, offer!.key);
    const job = sim.galaxy.jobs.find((j) => j.kind === 'bounty')!;
    expect(sim.galaxy.nodes[job.node!]?.contacts.some((c) => c.bounty === job.id && c.name === job.target)).toBe(true);
    // The issuer marks the target's node on the map.
    expect(sim.galaxy.discovered[job.node!]).toBeDefined();
    goTo(sim, job.node!);
    const target = sim.world.query(ShipC).find((id) => sim.world.get(id, ShipC)?.bounty === job.id);
    expect(target).toBeDefined();
    const credits = sim.trade.credits;
    const c = sim.world.get(playerShip(sim), CombatC)!;
    c.target = { ship: target!, moduleId: 0 };
    wreckShip(sim, target!);
    // Jump away at once, before the galaxy system's next tally: the kill still counts.
    sim.enqueue({ type: 'debug.chargeFtl' });
    sim.step();
    const next = (galaxyIndex(sim.galaxy).adjacent.get(sim.galaxy.current) ?? []).map((e) => (e.a === sim.galaxy.current ? e.b : e.a))[0]!;
    sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [next] });
    sim.step();
    expect(sim.sector.state).toBe('hyperspace');
    expect(sim.galaxy.jobs.some((j) => j.id === job.id)).toBe(false);
    expect(sim.trade.credits).toBe(credits + job.reward);
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
  });
});
