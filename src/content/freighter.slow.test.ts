import { describe, expect, it } from 'vitest';
import { ShipC } from '../sim/combat/components';
import { ModuleC } from '../sim/modules/components';
import { cachedWorld } from '../../test/support/world';
import { run } from '../../test/support/sim';
import { buildScene, expectPartyMends, firesOn, fired, freighterOf, spec, timer, withRaiders } from '../../test/support/fixtures/freighter';

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

/** Seeds 8 and 9 of the end-to-end rescue (the fast tier runs 3 and 6): the same claims on the scene as `buildScene` leaves it. */
describe('distress freighter: the rescue on more seeds', () => {
  it.each([8, 9])('end to end (seed %i): the party flies over, mends the reactor before the clock runs out, and comes home', (seed) => {
    const sim = cachedWorld(`freighter:${seed}:help:none`, () => buildScene(seed, { help: true, c: withRaiders('none') }));
    expectPartyMends(sim);
  }, 120000);

  it('spawns damaged and stays put; the damage is what the spec rolled', () => {
    const sim = cachedWorld('freighter:3:approach:none', () => buildScene(3, { c: withRaiders('none') }));
    const freighter = freighterOf(sim);
    const s = spec(sim);
    expect(sim.world.get(freighter, ShipC)?.faction).toBe('neutral');
    expect(s.damaged?.length).toBe(2);
    expect(s.failing).toHaveLength(1);
    const m = sim.world.get(s.failing![0]!, ModuleC)!;
    expect(m.def).toBe('module.reactor');
    expect(m.hp).toBe(Math.round((200 * (s.damage![0]!.pct)) / 100));
    run(sim, 60 * 20);
    expect(sim.world.get(freighter, ShipC)?.state).not.toBe('fled');
    expect(sim.world.get(s.failing![0]!, ModuleC)!.hp).toBe(m.hp); // its own crew cannot mend it
  });
});
