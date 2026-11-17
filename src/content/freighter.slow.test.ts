import { describe, expect, it } from 'vitest';
import { ShipC } from '../sim';
import { run } from '../../test/support/sim';
import { buildScene, firesOn, fired, freighterOf, timer, withRaiders } from '../../test/support/fixtures/freighter';

/** The reactor clock end to end on its natural time (the fast tier starts the same branches near the deadline): unrepaired, the freighter burns, then blows. */
describe('distress freighter: the natural clock', () => {
  it('left alone for the whole clock the freighter breaks out fires, then blows into a wreck', { timeout: 120000 }, () => {
    const sim = buildScene(4, { c: withRaiders('none') });
    const freighter = freighterOf(sim);
    const t = timer(sim);
    expect(t.afterSec).toBeGreaterThanOrEqual(150);
    run(sim, (t.at as number) - (t.fires!.leadSec * 20) - sim.tick - 20);
    expect(firesOn(sim, freighter)).toBe(0);
    run(sim, 3 * 20);
    expect(firesOn(sim, freighter)).toBeGreaterThan(0);
    run(sim, (t.at as number) - sim.tick + 3 * 20);
    expect(t.blown).toBe(true);
    expect(sim.world.get(freighter, ShipC)?.state).toBe('wreck');
    expect(fired(sim)).toEqual(expect.arrayContaining(['reactorBlew', 'destroyed']));
  });
});
