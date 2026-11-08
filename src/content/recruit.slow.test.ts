import { describe, expect, it } from 'vitest';
import { AboardC, PositionC, VehicleC, deserialize, serialize } from '../sim';
import { AllegianceC } from '../sim/fight/components';
import { shipGrid, shipIdOf } from '../sim/regions';
import { isTileWalkable } from '../sim/modules/walk';
import { ForHireC } from '../sim';
import { atBack, playerCrew, run } from './recruitFixture';
import { content } from '.';

// Slow tier: the natural-length version of the stuck-run test in recruit.test.ts (which starts a few seconds short of the give-up deadline).
describe('crew for hire: stuck runs, full wait', () => {
  for (const lost of ['airlock', 'bay'] as const) it(`after the whole wait, a run stuck on the way home with the recruit aboard is given up as a hire: paid once, the recruit lands as player crew; survives a reload (${lost} lost)`, () => {
    const { sim, c, cost, credits, crew } = atBack();
    const d = sim.trade.deals[0]!;
    sim.world.destroyEntity(d.airlock); // the airlock the shuttle was to dock at is gone
    const v = sim.world.get(d.vehicle, VehicleC)!;
    if (lost === 'bay') sim.world.destroyEntity(v.home); // and so is the hangar bay it would stow in
    run(sim, () => false, 1500);
    const reloaded = deserialize(serialize(sim), content); // save/load in the middle of the blocked stage
    run(reloaded, () => reloaded.trade.deals[0]?.phase === 'done', 4000);
    run(reloaded, () => false, 200);
    const s = reloaded;
    expect(s.trade.deals[0]?.phase).toBe('done');
    expect(s.trade.credits).toBe(credits - cost); // the fee is charged exactly once
    expect(s.world.get(c, AllegianceC)?.faction).toBe('player');
    expect(s.world.has(c, ForHireC)).toBe(false);
    expect(s.world.get(c, AboardC)).toBeUndefined();
    const pos = s.world.get(c, PositionC);
    expect(pos).toBeDefined();
    const shuttle = s.world.get(s.world.query(VehicleC)[0]!, VehicleC)!;
    expect(shipIdOf(s, pos)).toBe(shuttle.homeShip); // on the player's ship
    expect(isTileWalkable(s, shipGrid(s, shuttle.homeShip)!, pos!.x, pos!.y)).toBe(true);
    expect(playerCrew(s).length).toBe(crew + 1);
    expect(s.story.flags['stat.hired']).toBe(1);
    expect(s.trade.deals.some((x) => x.phase !== 'done' && x.phase !== 'failed')).toBe(false);
  });
});
