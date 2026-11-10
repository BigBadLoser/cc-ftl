/** The shuttle panel and crew mood lines of the salvage playtest (#404). */
import { describe, expect, it } from 'vitest';
import { MoodC } from '../sim';
import { AwaySiteC } from '../sim/away/components';
import { SalvageOrderC } from '../sim/salvage/components';
import { boarding } from '../content/ships/salvage404Fixture';
import { play } from '../content/ships/awayFixture';
import { buildShuttles } from './shuttleSnapshot';
import { buildCrewLists } from './crewSnapshot';

describe('salvage run panel and strain (#404)', () => {
  it("Call off on a salvage site's run ends the order (no ferry.cancel: that run has no ferry), and says why it waits", () => {
    const { sim, wreck, shuttle } = boarding();
    const ferry = () => buildShuttles(sim).shuttles.find((x) => x.id === shuttle)?.ferry;
    expect(ferry()?.cancel).toEqual({ type: 'away.recall', ship: wreck }); // a site of another owner: its party is called home
    sim.world.get(wreck, AwaySiteC)!.owner = 'salvage';
    sim.world.add(wreck, SalvageOrderC, { types: ['hull'], status: 'running', done: 0, since: sim.tick });
    expect(ferry()?.cancel).toEqual({ type: 'salvage.cancel', ship: wreck });
    sim.world.get(wreck, AwaySiteC)!.block = 'noCrew';
    expect(ferry()?.status).toBe('Salvage: waiting for crew rested and fed enough to go');
    sim.enqueue(ferry()!.cancel);
    play(sim, 20);
    expect(sim.world.has(wreck, SalvageOrderC)).toBe(false);
    expect(sim.world.get(wreck, AwaySiteC)?.status ?? 'closed').not.toBe('open');
  });

  it('the mood line shows a stressor that can set off a break whatever the mood', () => {
    const { sim, crew } = boarding();
    const [c] = crew as [number];
    play(sim, 20 * 10, () => sim.world.has(c, MoodC));
    const ui = () => buildCrewLists(sim).crew.find((x) => x.id === c)?.mood;
    expect(ui()?.strain).toBe('');
    sim.world.get(c, MoodC)!.grief = 600; // a friend died: grief can set off a break at any mood
    expect(ui()?.strain).toBe('grief');
  });
});
