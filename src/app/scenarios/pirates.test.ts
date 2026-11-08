import { describe, expect, it } from 'vitest';
import { newGame, type Sim } from '../../sim';
import { content } from '../../content';
import { encountersOf, resultOf } from '../encounterSnapshot';
import { patrolNode } from './patrol';
import { piratesCommands } from './pirates';

/** The scenario's start, stepped until the interdiction halts the trip. */
function interdicted(opts: Parameters<typeof piratesCommands>[2] = {}): Sim {
  const sim = newGame(3, content);
  for (let i = 0; i < 20; i++) sim.step();
  for (const cmd of piratesCommands(sim, patrolNode(sim)!, opts)) sim.enqueue(cmd);
  for (let i = 0; i < 400 && sim.galaxy.travel?.phase !== 'interdicted' && sim.sector.state !== 'deploying'; i++) {
    sim.step();
    sim.story.active = null;
  }
  return sim;
}

describe('?scenario=pirates', () => {
  it('pirates interdict mid-jump; the comms window has the captain, their demand, their ship and evade / bribe / fight', () => {
    const sim = interdicted();
    expect(sim.galaxy.travel?.phase).toBe('interdicted');
    const card = encountersOf(sim).find((e) => e.kind === 'interdict')!;
    expect(card.choices.map((c) => c.choice)).toEqual(['evade', 'bribe', 'fight']);
    const h = card.hail!;
    expect(h.hostile).toBe(true);
    expect(h.title).toBe('Interdiction');
    expect(h.caller.role).toBe('Captain of the');
    expect(h.look).not.toBeNull();
    expect(h.holo?.faction).toBe('pirates');
    expect(h.transcript.filter((l) => l.kind === 'speech')).toHaveLength(2);
    expect(h.readout.find((r) => r.label === 'Strength')?.value).toBe(card.threat);
    expect(h.readout.find((r) => r.label === 'Ships')?.value).toBe(String(card.ships));
  });

  it('hunters say so; a bribe the ship cannot afford is disabled with the reason', () => {
    const sim = interdicted({ hunt: true, broke: true });
    const card = encountersOf(sim).find((e) => e.kind === 'interdict')!;
    expect(card.hail?.caller.status?.label).toBe('Hunting you');
    const bribe = card.choices.find((c) => c.choice === 'bribe')!;
    expect(bribe.enabled).toBe(false);
    expect(bribe.why).toMatch(/^Need \d+ credits$/);
  });

  it('the answers keep their sim behaviour: a bribe pays and the trip goes on, fight drops out to the event grid', () => {
    const sim = interdicted();
    const e = sim.galaxy.encounters.find((x) => x.kind === 'interdict')!;
    const credits = sim.trade.credits;
    sim.enqueue({ type: 'galaxy.respond', encounter: e.id, choice: 'bribe' });
    sim.step();
    expect(sim.trade.credits).toBeLessThan(credits);
    expect(sim.galaxy.travel?.phase).not.toBe('interdicted');
    expect(resultOf(sim)?.text).toMatch(/^Paid the /);

    const fight = interdicted();
    const f = fight.galaxy.encounters.find((x) => x.kind === 'interdict')!;
    fight.enqueue({ type: 'galaxy.respond', encounter: f.id, choice: 'fight' });
    fight.step();
    expect(fight.galaxy.event).toBeTruthy();
    expect(fight.sector.state).toBe('deploying');
  });

  it('a fleet that has gone still opens the window, with static', () => {
    const sim = interdicted();
    const e = sim.galaxy.encounters.find((x) => x.kind === 'interdict')!;
    sim.galaxy.fleets = sim.galaxy.fleets.filter((f) => f.id !== e.fleet);
    const h = encountersOf(sim).find((x) => x.kind === 'interdict')!.hail!;
    expect(h.holo).toBeNull();
    expect(h.look).toBeNull();
  });
});
