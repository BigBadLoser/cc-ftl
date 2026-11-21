import { describe, expect, it } from 'vitest';
import { CrewC } from '../sim/crew/components';
import { addInjury } from '../sim/crew/injure';
import { playerCrew } from '../sim/story/world';
import type { Sim } from '../sim/sim';
import { cachedNewGame } from '../../test/support/content';
import { buildHealth } from './healthDetail';

const human = (sim: Sim): number => playerCrew(sim).find((id) => sim.world.get(id, CrewC)?.species === 'species.human') as number;

describe('the crew Health tab (#601)', () => {
  it('the Health tab says it plainly: the summary, the worst injury per part, red only for care needed now', () => {
    const sim = cachedNewGame(3);
    const id = human(sim);
    expect(buildHealth(sim, id)!.summary).toEqual({ alert: '', text: 'Healthy.', fine: true });
    expect(buildHealth(sim, id)!.parts.every((p) => p.state === 'Fine' && p.tone === 'fine')).toBe(true);
    addInjury(sim, id, 'part.arm_left', 'injury.cut', undefined, 'blade');
    addInjury(sim, id, 'part.arm_left', 'injury.fracture', undefined, 'blade');
    addInjury(sim, id, 'part.leg_left', 'injury.bruise');
    const h = buildHealth(sim, id)!;
    expect(h.summary).toEqual({ alert: 'Bleeding.', text: 'Needs first aid and a medic.', fine: false });
    expect(h.bleeding).toBe('slow');
    const arm = h.parts.find((p) => p.id === 'part.arm_left')!;
    expect(arm).toMatchObject({ state: 'Fracture, untreated', more: 1, tone: 'alert' });
    expect(arm.card!.injuries[0]!.got).toBe('Got it: a blade or a blow, day 1.');
    expect(h.parts.find((p) => p.id === 'part.leg_left')).toMatchObject({ state: 'Bruise, healing', tone: 'plain' });
    expect(h.parts).toHaveLength(10);
    expect(h.operations).toBeNull();
    sim.world.get(id, CrewC)!.species = 'species.robot';
    expect(buildHealth(sim, id)).toBeNull();
  });
});
