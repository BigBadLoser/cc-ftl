import { describe, expect, it } from 'vitest';
import { AllegianceC, CrewC, PositionC, ShipC, TraderC, newGame, placementError, playerShip, spawnModule, type Sim } from '../sim';
import { content } from '../content';
import { PrisonerC } from '../sim/fight/components';
import { sealPrisoner, stowSlab } from '../sim/stasis/freeze';
import { footprintBlockedByCrew } from '../sim/modules/spawn';
import { playerCrew } from '../sim/story/world';
import { prisonerDeals } from './prisonerSnapshot';

/** The starter game with a navy station and a navy prisoner sealed in a wheel. */
function game(): { sim: Sim; station: number; prisoner: number } {
  const sim = newGame(3, content);
  sim.step();
  sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4, owner: 'navy' });
  const at = sim.world.get(playerCrew(sim)[0]!, PositionC)!;
  sim.enqueue({ type: 'debug.spawnCrew', ship: playerShip(sim)!, x: at.x, y: at.y, role: 'role.security', faction: 'hostile' });
  sim.step();
  const ship = playerShip(sim)!;
  const s = sim.world.get(ship, ShipC)!;
  let wheel = 0;
  for (let y = s.y; y < s.y + s.height && !wheel; y++) {
    for (let x = s.x; x < s.x + s.width && !wheel; x++) {
      if (placementError(sim, ship, 'module.stasis_wheel', x, y, 0) === null && !footprintBlockedByCrew(sim, ship, 'module.stasis_wheel', x, y, 0)) wheel = spawnModule(sim, 'module.stasis_wheel', x, y, 0);
    }
  }
  const station = sim.world.query(TraderC).find((id) => sim.world.get(id, TraderC)?.station)!;
  const prisoner = sim.world.query(CrewC).find((id) => sim.world.get(id, AllegianceC)?.faction === 'hostile')!;
  sim.enqueue({ type: 'debug.imprison', crew: prisoner, from: 'navy' });
  sim.step();
  sealPrisoner(sim, prisoner, playerCrew(sim)[0]!);
  stowSlab(sim, prisoner, wheel);
  return { sim, station, prisoner };
}

describe('prisoner deals snapshot', () => {
  it('shows the offer as a button, then the run under way with a cancel in its place', () => {
    const { sim, station, prisoner } = game();
    const [row] = prisonerDeals(sim, station);
    expect(row).toMatchObject({ id: prisoner, wanted: true, frozen: true, offer: { ok: true } });
    expect(row?.offer.label).toMatch(/^Ransom ₵\d+$/);
    sim.enqueue({ type: 'prisoner.handOver', crew: prisoner, station });
    sim.step();
    expect(prisonerDeals(sim, station)[0]?.offer).toMatchObject({ ok: false, status: 'Loading your shuttle…', cancel: expect.any(Number) });
    expect(sim.world.get(prisoner, PrisonerC)).toBeDefined();
  });
});
