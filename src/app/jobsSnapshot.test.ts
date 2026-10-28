import { describe, expect, it } from 'vitest';
import { ModuleC, WeaponC, galaxyIndex, newGame, shipIdOf } from '../sim';
import { portsAt } from '../sim/galaxy/portIndex';
import { stationClass } from '../sim/galaxy/ports';
import { spawnContact } from '../sim/galaxy/arrivals';
import { offersHere, portOffers } from '../sim/galaxy/jobOffers';
import { ensureAround } from '../sim/galaxy/state';
import { content } from '../content';
import { buildJobs } from './jobsSnapshot';
import { buildStarmap } from './starmapSnapshot';

describe('buildJobs', () => {
  it('lists the offers at the start station with names, rewards and distances, and moves a taken one to the held jobs', () => {
    const sim = newGame(3, content);
    ensureAround(sim, sim.galaxy.current);
    const board = buildJobs(sim);
    expect(board.here).not.toBeNull();
    expect(board.offers.length).toBeGreaterThan(0);
    const o = board.offers[0]!;
    expect(o.id).toBeNull();
    expect(o.title).toMatch(/^(Deliver a sealed crate \(\d+ .+\)|Destroy the .+|Survey .+)$/);
    expect(o.hops).toBeGreaterThan(0);
    sim.enqueue({ type: 'jobs.accept', key: o.key });
    sim.step();
    const after = buildJobs(sim);
    expect(after.active.map((j) => j.key)).toEqual([o.key]);
    expect(after.offers.some((j) => j.key === o.key)).toBe(false);
  });
});

describe('buildJobs target strength', () => {
  it('shows a bounty target\'s guns, shields and hull next to ours, and matches the ship that appears', () => {
    let checked = 0;
    for (let seed = 1; seed <= 12 && checked < 2; seed++) {
      const sim = newGame(seed, content);
      ensureAround(sim, sim.galaxy.current);
      // Bounties are posted at military stations and depots: go to the first one (the start station is a trade station).
      const node = [...galaxyIndex(sim.galaxy).nodes.keys()].sort().find((n) => portsAt(sim, n).some((p) => stationClass(p) === 'military' && portOffers(sim, p).length > 0));
      if (!node) continue;
      sim.enqueue({ type: 'debug.galaxyTeleport', node });
      sim.step();
      for (const [x, y] of [[100, 60], [20, 50], [60, 120], [150, 40], [30, 130], [170, 110], [10, 10]] as const) {
        if (sim.sector.state === 'active') break;
        sim.enqueue({ type: 'sector.deploy', x, y });
        sim.step();
      }
      const board = buildJobs(sim);
      expect(board.mine?.guns).toBeGreaterThan(0);
      for (const o of board.offers) {
        if (o.kind === 'delivery') expect(o.target).toBeNull();
        if (o.kind !== 'bounty') continue;
        expect(o.target).not.toBeNull();
        expect(['outmatched', 'even', 'weaker']).toContain(o.target!.read);
        expect(buildJobs(sim).offers.find((x) => x.key === o.key)!.target).toEqual(o.target); // deterministic
        // The same key generates the real ship: its working guns are the ones the card promised.
        const raw = offersHere(sim).find((x) => x.key === o.key)!;
        const c = { id: 9000 + checked, faction: raw.targetFaction!, shipgen: raw.shipgen!, seed: raw.seed ?? 0, depth: raw.depth ?? 1, since: 0 };
        expect(spawnContact(sim, sim.galaxy.current, c)).toBe(true);
        const guns = sim.world.query(WeaponC).filter((m) => shipIdOf(sim, sim.world.get(m, ModuleC)) === (c as { ship?: number }).ship).length;
        expect(guns).toBe(o.target!.strength.guns);
        checked++;
        break;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('buildJobs hand-in', () => {
  it('lists a finished bounty only where its issuer\'s military station takes it in, and not as a held job', () => {
    const sim = newGame(3, content);
    ensureAround(sim, sim.galaxy.current);
    expect(buildJobs(sim).handIn).toEqual([]);
    sim.enqueue({ type: 'debug.jobScenario', name: 'bounty' });
    sim.step();
    for (const [x, y] of [[100, 60], [20, 50], [60, 120], [150, 40], [30, 130], [170, 110], [10, 10]] as const) {
      if (sim.sector.state === 'active') break;
      sim.enqueue({ type: 'sector.deploy', x, y });
      sim.step();
    }
    const here = buildJobs(sim);
    expect(here.active).toEqual([]);
    expect(here.handIn.map((c) => [c.kind, c.reward, c.here])).toEqual([['bounty', 400, true]]);
    expect(buildStarmap(sim).nodes.every((n) => !n.jobs?.length)).toBe(true);
  });
});

describe('buildStarmap job markers', () => {
  it('marks the destination of a held delivery or bounty on its (discovered) node', () => {
    const sim = newGame(3, content);
    ensureAround(sim, sim.galaxy.current);
    for (const o of buildJobs(sim).offers.slice(0, 2)) sim.enqueue({ type: 'jobs.accept', key: o.key });
    sim.step();
    expect(sim.galaxy.jobs.length).toBeGreaterThan(0);
    const nodes = buildStarmap(sim).nodes;
    for (const j of sim.galaxy.jobs) {
      const at = nodes.find((n) => n.id === (j.kind === 'delivery' ? j.to : j.node));
      if (!at?.known) { expect(at?.jobs ?? []).toEqual([]); continue; }
      expect(at.jobs?.some((m) => m.kind === j.kind && (j.kind === 'delivery' ? /^Deliver a sealed crate \(\d+ .+\)/ : /^Bounty: .+/).test(m.label))).toBe(true);
    }
    expect(nodes.filter((n) => !n.known).every((n) => !n.jobs?.length)).toBe(true);
    expect(nodes.some((n) => n.jobs?.length)).toBe(true);
  });
});
