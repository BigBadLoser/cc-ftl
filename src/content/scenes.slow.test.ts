import { describe, expect, it } from 'vitest';
import { ShipC } from '../sim/combat/components';
import { inScene } from '../../test/support/fixtures/scenes';
import { step } from '../../test/support/fixtures/traffic';

/** The natural waits of the scene departures (scenes.test.ts starts the leave timer near its end): the whole `stay` runs here. */
describe('scene departures, the whole stay', () => {
  it('a neutral not holding station jumps out when its business is done, and the observer logs it', () => {
    const { sim, skiff } = inScene(3);
    const s = sim.galaxy.event?.scene.ships[0];
    delete s?.hailed; // (a comms call holds it; here the hail is taken back)
    expect(s?.stay).toBeGreaterThanOrEqual(100);
    const out = step(sim, Math.round(((s?.stay ?? 0) + 60) * 20));
    expect(out.some((e) => e.type === 'ship.fled' && e.ship === skiff)).toBe(true);
    expect(out.filter((e) => e.type === 'scene.observed' && e.rule === 'fled')).toHaveLength(1);
    expect(s?.gone).toBe('fled');
    expect(sim.world.get(skiff, ShipC)).toBeUndefined();
    sim.enqueue({ type: 'galaxy.leaveEvent' });
    step(sim);
    expect(sim.galaxy.event).toBeNull();
  });

  it('a skiff that called holds station', () => {
    const { sim } = inScene(3);
    const s = sim.galaxy.event?.scene.ships[0];
    expect(s?.hailed).toBe(true);
    const out = step(sim, Math.round(((s?.stay ?? 0) + 60) * 20));
    expect(out.some((e) => e.type === 'ship.fled')).toBe(false);
    expect(sim.world.get(s?.contact.ship as number, ShipC)?.state).toBe('active');
  });
});
