import { describe, expect, it } from 'vitest';
import { AboardC, ModuleC, SurrenderedC, VehicleC, accessTile, captureReady, playerReach, type ModuleDef, type Sim } from '../../sim';
import { content } from '../index';
import { dockParty, modulesOf, nth, raiderCrew, run, setup, ship } from './boardingFixture';

describe('a surrendered ship stays capturable while the player can reach it', () => {
  /** The raiders give up; the party is aboard. */
  function surrendered(): { sim: Sim; shuttle: number; party: number[] } {
    const sim = setup();
    const d = dockParty(sim);
    for (const c of raiderCrew(sim)) sim.world.add(c, SurrenderedC, { tick: sim.tick });
    return { sim, ...d };
  }

  it('does not wreck it while boarders stand aboard, nor after they step into the docked shuttle', () => {
    const { sim, shuttle, party } = surrendered();
    run(sim, 100);
    expect(ship(sim, 2).state).toBe('active');
    expect(captureReady(sim, nth(sim, 2))).toBe(true);
    for (const c of party) sim.enqueue({ type: 'vehicle.embark', crew: c, vehicle: shuttle });
    run(sim, 400, () => party.every((c) => sim.world.has(c, AboardC)));
    expect(party.every((c) => sim.world.has(c, AboardC))).toBe(true);
    run(sim, 200);
    expect(playerReach(sim, nth(sim, 2))).toBe(true);
    expect(ship(sim, 2).state).toBe('active'); // used to become a wreck here
  });

  it('keeps it for a shuttle that hovers beside it, then wrecks it once the player is gone', () => {
    const { sim, shuttle, party } = surrendered();
    for (const c of party) sim.enqueue({ type: 'vehicle.embark', crew: c, vehicle: shuttle });
    run(sim, 400, () => party.every((c) => sim.world.has(c, AboardC)));
    sim.enqueue({ type: 'vehicle.undock', vehicle: shuttle });
    run(sim, 3);
    sim.enqueue({ type: 'vehicle.hover', vehicle: shuttle, ship: nth(sim, 2) });
    run(sim, 400);
    expect(sim.world.get(shuttle, VehicleC)!.hover).toBe(nth(sim, 2));
    expect(ship(sim, 2).state).toBe('active');
    sim.enqueue({ type: 'vehicle.return', vehicle: shuttle });
    run(sim, 1500, () => ship(sim, 2).state === 'wreck');
    expect(ship(sim, 2).state).toBe('wreck'); // nothing of ours can reach it any more: given up as a derelict
  });

  it('is still taken when the party steps back out and holds the bridge', () => {
    const { sim, shuttle, party } = surrendered();
    for (const c of party) sim.enqueue({ type: 'vehicle.embark', crew: c, vehicle: shuttle });
    run(sim, 400, () => party.every((c) => sim.world.has(c, AboardC)));
    run(sim, 60);
    sim.enqueue({ type: 'vehicle.disembark', vehicle: shuttle });
    run(sim, 5);
    const helm = modulesOf(sim, 2, 'module.helm')[0]!;
    const m = sim.world.get(helm, ModuleC)!;
    const at = accessTile(content.modules['module.helm'] as ModuleDef, m.x, m.y, m.rot)!;
    sim.enqueue({ type: 'crew.moveGroup', ids: party, x: at.x, y: at.y, ship: nth(sim, 2) });
    run(sim, 3000, () => ship(sim, 2).state === 'prize');
    expect(ship(sim, 2)).toMatchObject({ state: 'prize', faction: 'player' });
  });
});
