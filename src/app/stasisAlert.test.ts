import { describe, expect, it } from 'vitest';
import { CrewC, ModuleC, newGame } from '../sim';
import { slabPlace } from '../sim/stasis/query';
import { content } from '../content';
import { deriveAlerts } from './alertsDerived';
import { newHostiles, prisonerCommands } from './scenarios/prisoners';

describe('stasis alert', () => {
  it('is up while a slab runs on its reserve and gone once the wheel has power again', () => {
    const sim = newGame(3, content);
    sim.step();
    const before = new Set(sim.world.query(CrewC));
    for (const cmd of prisonerCommands(sim)) sim.enqueue(cmd);
    sim.step();
    const [prisoner] = newHostiles(sim, before);
    sim.enqueue({ type: 'debug.imprison', crew: prisoner as number });
    for (let i = 0; i < 4000 && slabPlace(sim, prisoner as number)?.kind !== 'wheel'; i++) sim.step();
    for (let i = 0; i < 3; i++) sim.step();
    expect(deriveAlerts(sim, () => false).has('sf')).toBe(false);
    const wheel = sim.world.query(ModuleC).find((id) => sim.world.get(id, ModuleC)?.def === 'module.stasis_wheel') as number;
    sim.enqueue({ type: 'module.setEnabled', id: wheel, enabled: false });
    for (let i = 0; i < 3; i++) sim.step();
    const alert = deriveAlerts(sim, () => false).get('sf');
    expect(alert?.kind).toBe('stasis.failing');
    expect(alert?.text).toMatch(/^Stasis failing: a prisoner thaws in 0:[34]\d$/);
    sim.enqueue({ type: 'module.setEnabled', id: wheel, enabled: true });
    for (let i = 0; i < 3; i++) sim.step();
    expect(deriveAlerts(sim, () => false).has('sf')).toBe(false);
  });
});
