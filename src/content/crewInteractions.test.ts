import { describe, expect, it } from 'vitest';
import { content } from './index';
import { CarriedC, CrewC, DownedC, FighterC, PositionC, TICK_HZ, TraitsC, newGame, type Sim, type SimEvent } from '../sim';
import { startBreak } from '../sim/systems/breakdown';
import { relationshipSystem } from '../sim/systems/relationship';
import { bondBoth, bondTo, ensurePerson, friendsOf, opinionOf, personOf } from '../sim/crew/bonds';
import { rescueSources } from '../sim/crew/bondSources';
import { available, spotOf, tryInteractions } from '../sim/crew/interact';
import { InteractionC } from '../sim/crew/interactionTypes';
import { ensureMood } from '../sim/crew/mood';
import { BOND_RESCUED, BOND_RESCUER, BOND_TANTRUM } from '../sim/tuning';

function pair(): { sim: Sim; a: number; b: number } {
  const sim = newGame(5, content, 'ship.starter', false);
  sim.step();
  const [a, b] = sim.world.query(CrewC).filter((id) => sim.world.get(id, CrewC)!.species === 'species.human') as [number, number];
  const pa = sim.world.get(a, PositionC)!, pb = sim.world.get(b, PositionC)!;
  pb.x = pb.toX = pa.x + 1; pb.y = pb.toY = pa.y; // side by side
  for (const id of [a, b]) { ensurePerson(sim, id); ensureMood(sim, id); }
  return { sim, a, b };
}
/** Offer the pair the interaction on successive passes until one begins (the roll is hashed on the pass number). */
function until(sim: Sim, a: number, b: number): string | null {
  for (let k = 1; k < 4000; k++) {
    sim.tick = k * 100;
    const d = tryInteractions(sim, a, b, 1);
    if (d) return d.id;
  }
  return null;
}
const settle = (sim: Sim, ...ids: number[]): void => { for (const id of ids) sim.world.remove(id, InteractionC); };

describe('interactions', () => {
  it('two idle crew side by side chat: both carry the interaction, both opinions move, nothing is logged', () => {
    const { sim, a, b } = pair();
    sim.events.drain();
    expect(spotOf(sim, a)).toBe('idle');
    expect(until(sim, a, b)).toBe('interaction.chat');
    expect(sim.world.get(a, InteractionC)!.with).toBe(b);
    expect(sim.world.get(b, InteractionC)!.with).toBe(a);
    const pa = personOf(sim, a), pb = personOf(sim, b);
    expect(opinionOf(sim, pa, pb)!.score).not.toBe(0);
    expect(opinionOf(sim, pb, pa)!.score).not.toBe(0);
    expect(sim.events.drain().filter((e) => e.type === 'crew.interaction')).toEqual([]);
  });

  it('is deterministic: the same state on the same pass rolls the same', () => {
    const one = pair(), two = pair();
    expect(until(one.sim, one.a, one.b)).toBe(until(two.sim, two.a, two.b));
    expect(one.sim.tick).toBe(two.sim.tick);
    expect(opinionOf(one.sim, personOf(one.sim, one.a), personOf(one.sim, one.b))!.score).toBe(opinionOf(two.sim, personOf(two.sim, two.a), personOf(two.sim, two.b))!.score);
  });

  it('a pair does not chat while one is busy, working or in another interaction', () => {
    const { sim, a, b } = pair();
    sim.world.get(a, CrewC)!.activity = 'working';
    expect(until(sim, a, b)).toBeNull();
    sim.world.get(a, CrewC)!.activity = 'idle';
    sim.world.add(b, InteractionC, { id: 'x', outcome: 'x', icon: 'chat', with: a, since: 0, until: 1e9 });
    expect(available(sim, b)).toBe(false);
    expect(until(sim, a, b)).toBeNull();
  });

  it('rivals who meet shout: a log event, both moods dip, both opinions fall, and they cannot chat', () => {
    const { sim, a, b } = pair();
    bondBoth(sim, a, b, -60, 'row');
    sim.world.get(a, CrewC)!.activity = 'working'; // busy people shout too, they do not chat
    sim.events.drain();
    expect(until(sim, a, b)).toBe('interaction.shout');
    const ev = sim.events.drain() as SimEvent[];
    expect(ev.some((e) => e.type === 'crew.interaction' && e.id === 'interaction.shout')).toBe(true);
    expect(ensureMood(sim, a).row).toBeGreaterThan(0);
    expect(opinionOf(sim, personOf(sim, a), personOf(sim, b))!.score).toBeLessThan(-60);
    settle(sim, a, b);
    sim.world.get(a, CrewC)!.activity = 'idle';
    sim.world.get(b, CrewC)!.activity = 'idle';
    const bad = until(sim, a, b);
    expect(bad).not.toBe('interaction.chat');
  });

  it('Hot-headed crew lose opinion twice as fast; Peacemakers gain 1.5 times as fast', () => {
    const { sim, a, b } = pair();
    sim.world.add(a, TraitsC, { ids: ['trait.hot_headed'] });
    sim.world.add(b, TraitsC, { ids: ['trait.peacemaker'] });
    bondTo(sim, a, b, -4, 'badChat');
    bondTo(sim, b, a, 4, 'chat');
    expect(opinionOf(sim, personOf(sim, a), personOf(sim, b))!.score).toBe(-8);
    expect(opinionOf(sim, personOf(sim, b), personOf(sim, a))!.score).toBe(6);
  });
});

describe('shared danger and tantrums', () => {
  it('a rescue: the patient thinks much more of the rescuer than the rescuer of the patient, and only once', () => {
    const { sim, a, b } = pair();
    sim.world.add(b, DownedC, { bleed: 100, stabilized: false, bed: 0 });
    sim.world.add(b, CarriedC, { carrier: a });
    rescueSources(sim);
    rescueSources(sim);
    expect(opinionOf(sim, personOf(sim, b), personOf(sim, a))!.score).toBe(BOND_RESCUED);
    expect(opinionOf(sim, personOf(sim, a), personOf(sim, b))!.score).toBe(BOND_RESCUER);
  });

  it('fighting side by side makes friends of a compatible pair, once per fight', () => {
    const { sim, a, b } = pair();
    for (const id of [a, b]) sim.world.add(id, FighterC, { mode: 'engage', target: 0, ordered: 0, engage: true, cooldown: 0, planned: 0 });
    for (let i = 0; i < 40; i++) {
      sim.tick = i * 100 + ((100 - (a % 100)) % 100); // the pass of the lower id
      relationshipSystem(sim);
    }
    const op = opinionOf(sim, personOf(sim, a), personOf(sim, b))!;
    expect(op.reasons.find((r) => r.id === 'fought')!.d).toBeGreaterThan(0);
    expect(op.reasons.find((r) => r.id === 'fought')!.d).toBeLessThanOrEqual(12.1); // one fight, not forty passes
  });

  it('a tantrum costs the one who threw it the regard of those who heard it', () => {
    const { sim, a, b } = pair();
    startBreak(sim, a, { kind: 'tantrum', tier: 'moderate', context: 'lowMood', ticks: 20 * TICK_HZ });
    expect(opinionOf(sim, personOf(sim, b), personOf(sim, a))!.score).toBe(BOND_TANTRUM);
    expect(friendsOf(sim, personOf(sim, b))).toHaveLength(0);
  });
});
