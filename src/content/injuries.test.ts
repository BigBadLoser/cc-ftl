import { describe, expect, it } from 'vitest';
import { CrewC, DownedC, HealthC, JobC, PrioritiesC } from '../sim/crew/components';
import { InjuriesC } from '../sim/crew/injuryTypes';
import { capacitiesOf, canBeInjured, injuriesOf, isBleeding, partCondition } from '../sim/crew/body';
import { addInjury, damageCrew, injureOnDown } from '../sim/crew/injure';
import { injuryStep } from '../sim/crew/injuryCare';
import { SCAR_AFTER_SEC } from '../sim/crew/tuningInjury';
import { stat, statBreakdown } from '../sim/stats';
import { playerCrew } from '../sim/story/world';
import type { Sim } from '../sim/sim';
import { TICK_HZ } from '../sim/time';
import { play } from './scenario';
import { cachedNewGame } from '../../test/support/content';
import { cachedScenario } from '../../test/support/scenario';
import { eventsOf, run } from '../../test/support/sim';
import { expectReplayable } from '../../test/support/world';
import { injuries } from './injuries';

const human = (sim: Sim, n = 0): number => playerCrew(sim).filter((id) => sim.world.get(id, CrewC)?.species === 'species.human')[n] as number;

/** Shoot crew member `id` with `hp`-point bullets (topped back up each time) until one injures them; the shots taken (at most 60). */
function shootUntilInjured(sim: Sim, id: number, hp: number): number {
  for (let n = 1; n <= 60; n++) {
    sim.world.get(id, HealthC)!.hp = 100;
    damageCrew(sim, id, hp, 'bullet');
    if (injuriesOf(sim, id).length) return n;
  }
  return 0;
}

describe('crew injuries (#601)', () => {
  it('a hit over the threshold rolls an injury from its source tables, and the roll replays and survives a save', () => {
    const sim = cachedNewGame(3);
    const id = human(sim);
    for (let n = 0; n < 40; n++) damageCrew(sim, id, injuries.sources.bullet.threshold - 1, 'bullet'); // under the threshold: hp only
    expect(injuriesOf(sim, id)).toHaveLength(0);
    expect(shootUntilInjured(sim, id, injuries.sources.bullet.seriousAt)).toBeGreaterThan(0);
    const [inj] = injuriesOf(sim, id);
    expect(Object.keys(injuries.sources.bullet.parts)).toContain(inj!.part);
    expect(injuries.sources.bullet.serious).toContain(inj!.kind); // a hit of `seriousAt` is serious
    expect(inj!.sev).toBe('serious');
    const events = sim.events.drain();
    expect(eventsOf(events, 'crew.injured')).toEqual([{ type: 'crew.injured', crew: id, part: inj!.part, kind: inj!.kind, severity: 'serious' }]);
    const build = (): Sim => {
      const s = cachedNewGame(3);
      shootUntilInjured(s, human(s), 12);
      return s;
    };
    expect(injuriesOf(build(), id)).toEqual(injuriesOf(build(), id));
    expectReplayable(build, 60, { saveAt: 30 });
  });

  it('capacities scale the stats under the injury origin: broken legs slow walking, a lost eye spoils aim', () => {
    const sim = cachedNewGame(3);
    const id = human(sim);
    const move = stat(sim, id, 'moveSpeed');
    const aim = stat(sim, id, 'gunnery');
    addInjury(sim, id, 'part.leg_left', 'injury.fracture');
    addInjury(sim, id, 'part.leg_right', 'injury.fracture');
    expect(capacitiesOf(sim, id).moving).toBeCloseTo(0.5, 6);
    expect(stat(sim, id, 'moveSpeed') / move).toBeCloseTo(1 - injuries.capacities.moving.stats.moveSpeed * 0.5, 6);
    expect(statBreakdown(sim, id, 'moveSpeed').parts.some((p) => p.origin === 'injury')).toBe(true);
    addInjury(sim, id, 'part.eye_left', 'injury.organ_damage', 'destroyed');
    const sight = capacitiesOf(sim, id).sight;
    expect(sight).toBeCloseTo(injuries.capacities.sight.floor + (1 - injuries.capacities.sight.floor) * 0.5, 6);
    if (aim > 0) expect(stat(sim, id, 'gunnery') / aim).toBeCloseTo(1 - injuries.capacities.sight.stats.gunnery * (1 - sight), 6);
  });

  it('a bleeding wound costs hp while standing, and first aid from a crewmate stops it where they stand', () => {
    const sim = cachedNewGame(3);
    const id = human(sim);
    addInjury(sim, id, 'part.arm_left', 'injury.cut');
    expect(isBleeding(sim, id)).toBe(true);
    const hp = sim.world.get(id, HealthC)!;
    hp.hp = 80;
    const events = run(sim, 60 * TICK_HZ, { until: (s) => !isBleeding(s, id) });
    expect(sim.world.query(JobC).some((j) => sim.world.get(j, JobC)?.kind === 'aid')).toBe(false); // done and gone
    expect(isBleeding(sim, id)).toBe(false);
    const aid = eventsOf(events, 'crew.patched').find((e) => e.crew === id);
    expect(aid?.by).toBeTruthy();
    expect(aid?.by).not.toBe(id);
    expect(eventsOf(events, 'crew.jobDone').some((e) => e.kind === 'aid')).toBe(true);
    expect(injuriesOf(sim, id)[0]!.age).toBeLessThan(injuries.kinds['injury.cut'].bleedSec); // stopped by the medic, not by itself
    expect(hp.hp).toBeLessThan(80); // it bled meanwhile (no regeneration while bleeding)
  });

  it('a medic treats a serious injury at a medical bed, after which it heals; one left untreated sets as a scar', () => {
    const built = cachedScenario('injuries');
    const sim = built.sim;
    const gunner = playerCrew(sim).find((id) => injuriesOf(sim, id).some((i) => i.kind === 'injury.fracture'))!;
    const events = play(built, 240 * TICK_HZ, { until: (s) => injuriesOf(s, gunner).some((i) => i.sev === 'serious' && !!i.treated) });
    const treated = eventsOf(events, 'crew.injuryTreated').find((e) => e.crew === gunner);
    expect(treated?.by).toBeTruthy();
    expect(treated?.by).not.toBe(gunner);
    const frac = injuriesOf(sim, gunner).find((i) => i.kind === 'injury.fracture')!;
    expect(frac.treated).toBeGreaterThanOrEqual(1);
    // Healing only runs once treated: step the rule on its own to the end of the kind's healing time.
    const heal = injuries.kinds['injury.fracture'].healSec;
    for (let t = 0; t < heal; t += 10) injuryStep(sim, gunner, 10);
    expect(injuriesOf(sim, gunner).some((i) => i.kind === 'injury.fracture')).toBe(false);
    expect(partCondition(sim, gunner, 'part.leg_left')).toBe(1);

    const other = cachedNewGame(3);
    const id = human(other);
    addInjury(other, id, 'part.arm_right', 'injury.fracture');
    for (let t = 0; t < SCAR_AFTER_SEC * 8 && injuriesOf(other, id)[0]!.sev === 'serious'; t += 10) injuryStep(other, id, 10);
    const inj = injuriesOf(other, id)[0]!;
    expect(inj.sev).toBe('scar');
    expect(inj.heal).toBe(0); // no healing ever ran untreated
    expect(partCondition(other, id, 'part.arm_right')).toBeCloseTo(1 - injuries.kinds['injury.fracture'].scarLoss, 6);
  });

  it('a destroyed eye stays lost, and takes no further injury', () => {
    const sim = cachedNewGame(3);
    const id = human(sim);
    addInjury(sim, id, 'part.eye_right', 'injury.organ_damage');
    addInjury(sim, id, 'part.eye_right', 'injury.organ_damage');
    addInjury(sim, id, 'part.eye_right', 'injury.organ_damage'); // 3 x 0.4: past zero, destroyed
    expect(injuriesOf(sim, id)).toEqual([expect.objectContaining({ part: 'part.eye_right', sev: 'destroyed' })]);
    for (let t = 0; t < 4 * 3600; t += 10) injuryStep(sim, id, 10);
    addInjury(sim, id, 'part.eye_right', 'injury.cut');
    expect(injuriesOf(sim, id)).toEqual([expect.objectContaining({ part: 'part.eye_right', sev: 'destroyed' })]);
    expect(partCondition(sim, id, 'part.eye_right')).toBe(0);
    expect(capacitiesOf(sim, id).sight).toBeLessThan(1);
  });

  it('a lost vital organ downs the crew member, and a stabilised bed does not stop the bleed-out', () => {
    const sim = cachedNewGame(3);
    const id = human(sim);
    for (const c of playerCrew(sim)) sim.world.get(c, PrioritiesC)!.medical = 0; // nobody carries them off: the test is the vitals rule
    addInjury(sim, id, 'part.heart', 'injury.organ_damage', 'destroyed');
    run(sim, 2);
    const downed = sim.world.get(id, DownedC);
    expect(downed).toBeDefined();
    downed!.stabilized = true;
    const bleed = downed!.bleed;
    run(sim, TICK_HZ);
    expect(sim.world.get(id, DownedC)!.bleed).toBeLessThan(bleed);
  });

  it('the tables are whole: every part a source can hit has a kind of each severity that fits it, and each capacity\'s shares sum to 1', () => {
    const fits = (kinds: readonly string[], part: string): boolean => kinds.some((k) => {
      const parts = (injuries.kinds as Record<string, { parts?: readonly string[] }>)[k]?.parts;
      return !parts || parts.includes(part);
    });
    for (const [source, def] of Object.entries(injuries.sources)) {
      for (const part of Object.keys(def.parts)) {
        expect(Object.keys(injuries.parts), source).toContain(part);
        expect(fits(def.serious, part), `${source} serious on ${part}`).toBe(true);
        expect(fits(def.minor, part), `${source} minor on ${part}`).toBe(true);
      }
    }
    const shares: Record<string, number> = {};
    for (const p of Object.values(injuries.parts) as { capacity: string; share?: number }[]) shares[p.capacity] = (shares[p.capacity] ?? 0) + (p.share ?? 0);
    for (const cap of Object.keys(injuries.capacities)) expect(shares[cap], cap).toBeCloseTo(1, 9);
  });

  it('robots and creatures take no injuries, whatever hits them', () => {
    const sim = cachedNewGame(3);
    const id = human(sim);
    sim.world.get(id, CrewC)!.species = 'species.robot';
    expect(canBeInjured(sim, id)).toBe(false);
    for (let n = 0; n < 40; n++) {
      sim.world.get(id, HealthC)!.hp = 100;
      damageCrew(sim, id, 40, 'blast');
      damageCrew(sim, id, 40, 'fire', { dose: true });
    }
    injureOnDown(sim, id);
    expect(sim.world.has(id, InjuriesC)).toBe(false);
    sim.world.get(id, CrewC)!.species = 'species.alien_hunter';
    expect(canBeInjured(sim, id)).toBe(false);
    sim.enqueue({ type: 'debug.setCrew', id, injuries: [{ part: 'part.brain', kind: 'injury.concussion' }] });
    expect(eventsOf(run(sim, 1), 'command.rejected')).toHaveLength(1);
    expect(sim.world.has(id, InjuriesC)).toBe(false);
  });
});
