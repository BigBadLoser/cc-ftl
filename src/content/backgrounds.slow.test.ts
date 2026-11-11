import { describe, expect, it } from 'vitest';
import { content } from './index';
import { SKILLS, crewRollRng, jobLevel, rollCrewWith, rollStartingCrew, shipJobs, startingRoles } from '../sim';
import { starterShips } from './ships/starterShips';

/** The background roll's distribution over many seeds (docs/TRAITS.md 10.6, 10.13 step 3). */
describe('background rolls, seeded sweep', () => {
  const N = 2000;
  const people = Array.from({ length: N }, (_, seed) => rollCrewWith(crewRollRng(seed, 0, 0), 'role.crew', content));

  it('give one or two strengths, a few middling skills and some blanks: a total about 14', () => {
    const totals = people.map((p) => Object.values(p.skills ?? {}).reduce((n, v) => n + (v ?? 0), 0));
    const mean = totals.reduce((a, b) => a + b, 0) / N;
    expect(mean).toBeGreaterThan(11);
    expect(mean).toBeLessThan(15.5);
    const top = people.map((p) => Math.max(...Object.values(p.skills ?? {}).map((v) => v ?? 0)));
    expect(top.filter((t) => t >= 4 && t <= 8).length / N).toBeGreaterThan(0.9);
    const blanks = people.map((p) => SKILLS.filter((k) => !p.skills?.[k]).length);
    expect(blanks.reduce((a, b) => a + b, 0) / N).toBeGreaterThan(3);
    for (const p of people) for (const k of SKILLS) expect(p.skills?.[k] ?? 0).toBeLessThanOrEqual(8);
  });

  it('roll interests (most have one or two, at most one passionate) and a rare won’t-do', () => {
    const counts = people.map((p) => (p.interests?.keen.length ?? 0) + (p.interests?.passionate.length ?? 0));
    expect(counts.filter((c) => c === 0).length / N).toBeCloseTo(0.15, 1);
    for (const p of people) expect(p.interests?.passionate.length ?? 0).toBeLessThanOrEqual(1);
    const refuse = people.filter((p) => p.wontDo?.length).length / N;
    expect(refuse).toBeGreaterThan(0.02);
    expect(refuse).toBeLessThan(0.12);
    expect(people.filter((p) => p.background?.knack).length / N).toBeCloseTo(0.12, 1);
  });

  it('leave Helm or Repair weak in some starting crews, which a reroll or two of the weak berths fixes (the Ship’s jobs list shows it)', () => {
    for (const ship of ['ship.starter', ...starterShips.map((s) => s.id)]) {
      const def = (content.ships as Record<string, (typeof content.ships)['ship.starter']>)[ship];
      if (!def) continue;
      const jobs = shipJobs(def, content).filter((j) => j.id === 'helm' || j.id === 'repair');
      const covered = (seed: number, rerolls: number): boolean => {
        const crew = rollStartingCrew(seed, startingRoles(content, ship).map((role) => ({ role, rerolls })), content);
        return jobs.every((j) => crew.some((c) => jobLevel(j, c.skills ?? {}) >= 3));
      };
      let first = 0;
      let within = 0;
      for (let seed = 0; seed < 300; seed++) {
        if (covered(seed, 0)) first++;
        if ([0, 1, 2, 3].some((r) => covered(seed, r))) within++;
      }
      expect(first / 300, ship).toBeGreaterThan(0.2); // no berth hint: the crews are rolled as they come
      expect(within / 300, ship).toBeGreaterThan(0.75);
    }
  });
});
