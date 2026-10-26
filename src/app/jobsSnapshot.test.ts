import { describe, expect, it } from 'vitest';
import { ModuleC, WeaponC, newGame, shipIdOf } from '../sim';
import { spawnContact } from '../sim/galaxy/arrivals';
import { offersHere } from '../sim/galaxy/jobOffers';
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
    expect(o.title).toMatch(/^(Deliver \d+× .+|Destroy the .+)$/);
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
      expect(at.jobs?.some((m) => m.kind === j.kind && (j.kind === 'delivery' ? /^Deliver \d+× .+/ : /^Bounty: .+/).test(m.label))).toBe(true);
    }
    expect(nodes.filter((n) => !n.known).every((n) => !n.jobs?.length)).toBe(true);
    expect(nodes.some((n) => n.jobs?.length)).toBe(true);
  });
});
