import { describe, expect, it } from 'vitest';
import { ModuleC } from '../../sim/modules/components';
import { shipIds, shipIdOf } from '../../sim/regions';
import type { ContentRegistry } from '../../sim/registry';
import { deserialize, serialize } from '../../sim/save';
import type { Sim } from '../../sim/sim';
import { vehicleViews } from '../../sim/vehicles/queries';
import { airlockOf, embark, shuttleOf, shuttleSetup as setup } from '../../../test/support/fixtures/shuttle';
import { crewOn, eventsOf, run } from '../../../test/support/sim';
import { content } from '../index';

/** The absence and replay runs of vehicles.test.ts at full length (the fast file cuts them short once the claim has had its chance to fail). */
describe('shuttle runs, full length', () => {
  const reg: ContentRegistry = {
    ...content,
    ships: { ...content.ships, 'ship.raiderBoarder': { ...content.ships['ship.raiderBoarder'], boarding: { party: 2, afterSec: 3, losingBelow: 0.6 } } },
  };

  it('point defence does not engage without an AI core', () => {
    const sim = setup();
    for (const i of sim.world.query(ModuleC)) {
      const m = sim.world.get(i, ModuleC)!;
      if (shipIdOf(sim, m) === shipIds(sim)[0] as number && m.def === 'module.aiCore') m.enabled = false;
    }
    const shuttle = shuttleOf(sim, 2);
    embark(sim, crewOn(sim, 2).slice(0, 1), shuttle);
    sim.enqueue({ type: 'vehicle.dock', vehicle: shuttle, airlock: airlockOf(sim, 1) });
    const out = run(sim, 20 * 25);
    expect(eventsOf(out, 'vehicle.damaged').filter((e) => e.source === 'pointDefence')).toHaveLength(0);
  });

  it('the plain raider never boards', () => {
    const sim = setup(1, reg, 'ship.raider');
    const out = run(sim, 20 * 60);
    expect(eventsOf(out, 'vehicle.launched')).toHaveLength(0);
  });

  it('is deterministic, and survives a save and load mid-flight', () => {
    const a = setup(3, reg, 'ship.raiderBoarder');
    const b = setup(3, reg, 'ship.raiderBoarder');
    const untilFlying = (sim: Sim): void => {
      for (let i = 0; i < 20 * 60 && !vehicleViews(sim).some((v) => v.state === 'flying'); i++) sim.step();
      run(sim, 40);
    };
    untilFlying(a);
    untilFlying(b);
    expect(serialize(a)).toBe(serialize(b));
    expect(vehicleViews(a).some((v) => v.state === 'flying')).toBe(true);
    const loaded = deserialize(serialize(a), reg);
    run(a, 20 * 20);
    run(loaded, 20 * 20);
    expect(serialize(loaded)).toBe(serialize(a));
  });
});
