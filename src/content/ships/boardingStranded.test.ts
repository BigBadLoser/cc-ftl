import { describe, expect, it } from 'vitest';
import { jumpWarnings, AboardC, AllegianceC, CombatC, CrewC, DeadC, ModuleC, VehicleC } from '../../sim';
import { loseStrandedCrew } from '../../sim/boarding/stranded';
import { FTL_CHARGE_SEC } from '../../sim/tuning';
import { shipIdOf } from '../../sim/regions';
import { crewOn, dockParty, nth, of, run, setup, ship } from './boardingFixture';

describe('stranded parties are lost', () => {
  it('die with the ship when it is destroyed', () => {
    const sim = setup();
    const { party } = dockParty(sim);
    for (const m of sim.world.query(ModuleC)) if (shipIdOf(sim, sim.world.get(m, ModuleC)) === nth(sim, 2)) sim.world.get(m, ModuleC)!.hp = 0; // shot to pieces
    const out = run(sim, 100, () => ship(sim, 2).state === 'wreck');
    expect(ship(sim, 2).state).toBe('wreck');
    for (const c of party) expect(sim.world.has(c, DeadC)).toBe(true);
    const died = of(out, 'crew.died').map((e) => e.crew);
    for (const c of party) expect(died).toContain(c);
    expect(of(out, 'ship.destroyed')).toEqual([{ type: 'ship.destroyed', ship: nth(sim, 2) }]);
  });

  it('leave the crew when the ship jumps away: removed with an event, the rest untouched', () => {
    const sim = setup();
    const { party, pilot, shuttle } = dockParty(sim);
    const before = sim.world.query(CrewC).filter((c) => sim.world.get(c, AllegianceC)?.faction === 'player').length;
    sim.world.get(nth(sim, 2), CombatC)!.ftl = FTL_CHARGE_SEC;
    sim.enqueue({ type: 'combat.flee', ship: nth(sim, 2) });
    const out = run(sim, 5);
    expect(ship(sim, 2).state).toBe('fled');
    expect(of(out, 'crew.leftWithShip').map((e) => e.crew).sort()).toEqual([...party].sort());
    for (const e of of(out, 'crew.leftWithShip')) expect(e).toMatchObject({ ship: nth(sim, 2), how: 'fled' });
    for (const c of party) expect(sim.world.has(c, CrewC)).toBe(false);
    expect(sim.world.query(CrewC).filter((c) => sim.world.get(c, AllegianceC)?.faction === 'player')).toHaveLength(before - party.length);
    expect(sim.world.has(pilot, AboardC)).toBe(true); // the shuttle's pilot was not aboard the ship
    expect(sim.world.has(shuttle, VehicleC)).toBe(true);
    expect(of(out, 'ship.fled')).toHaveLength(1);
    expect(of(out, 'crew.died')).toEqual([]);
    run(sim, 200); // and the world keeps running cleanly (audit each tick)
  });

  it('are also lost when the ship is lifted out of the node', () => {
    const sim = setup();
    const { party } = dockParty(sim);
    expect(loseStrandedCrew(sim, nth(sim, 2), 'lifted').sort()).toEqual([...party].sort());
    expect(of(run(sim, 1), 'crew.leftWithShip').map((e) => e.how)).toEqual(['lifted', 'lifted']);
    expect(crewOn(sim, 2).filter((c) => sim.world.get(c, AllegianceC)?.faction === 'player')).toEqual([]);
  });
});

describe('a jump with a party aboard another ship', () => {
  it('lists the party as crew the jump would leave behind (the jump warning reads this)', () => {
    const sim = setup();
    const { party, pilot, shuttle } = dockParty(sim);
    const warn = jumpWarnings(sim, nth(sim, 1));
    expect(warn.crew.sort()).toEqual([...party, pilot].sort()); // the party and the pilot waiting in the shuttle
    expect(warn.vehicles).toEqual([shuttle]); // docked at the other ship, so it stays too
  });
});
