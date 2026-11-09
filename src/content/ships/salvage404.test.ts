/** Regressions of the salvage playtest (#404): passages, the site's shuttle, seals on the wreck (Call off and strain: app/salvageRun.test.ts). */
import { describe, expect, it } from 'vitest';
import { AboardC, JobC, NeedsC, ShipC, VehicleC, Struct, shipGrid, type Job } from '../../sim';
import { SiteRunC } from '../../sim/away/components';
import { passageFits, staySec } from '../../sim/away/crew';
import { siteShuttleOk } from '../../sim/away/handlers';
import { passagesOf } from '../../sim/away/passage';
import { breachTiles } from '../../sim/crew/breach';
import { SuitC } from '../../sim/eva/components';
import { vehicleSuits } from '../../sim/eva/shuttle';
import { spillItems } from '../../sim/items/stacks';
import { TransferC } from '../../sim/logistics/components';
import { writeStruct } from '../../sim/structure';
import { AWAY_GO_STAY_SEC, AWAY_HOME_HUNGER, AWAY_HOME_REST } from '../../sim/tuning';
import { shuttleOf } from './ferryFixture';
import { setup } from './salvageEvaFixture';
import { crewOn, landed, play } from './awayFixture';
import { boarding } from './salvage404Fixture';

describe('salvage playtest (#404)', () => {
  it('a passage takes crew who can stay a while, not only those at 60 rest and hunger', () => {
    const { sim, shuttle, crew } = boarding();
    const job = sim.world.get(passagesOf(sim, shuttle)[0]!, JobC) as Job;
    const [c] = crew as [number];
    const n = sim.world.get(c, NeedsC)!;
    // Half a waking day in (rest 45) and fed a while ago (hunger 70): hours of rest and minutes of food left. The old gate (60) refused this.
    Object.assign(n, { rest: 45, hunger: 70 });
    expect(staySec(sim, c)).toBeGreaterThan(AWAY_GO_STAY_SEC);
    expect(passageFits(sim, c, job)).toBe(true);
    // Due home within the minimum stay: no passage.
    Object.assign(n, { rest: AWAY_HOME_REST + 2, hunger: 90 });
    expect(passageFits(sim, c, job)).toBe(false);
    Object.assign(n, { rest: 90, hunger: AWAY_HOME_HUNGER + 5 });
    expect(passageFits(sim, c, job)).toBe(false);
  });

  it('no auto transfer is queued off a site its own shuttle serves (it would wait for, or take, that shuttle)', () => {
    const { sim, wreck, shuttle } = landed();
    const s = sim.world.get(wreck, ShipC)!;
    spillItems(sim, wreck, s.x + 3, s.y + 3, 'item.scrap_hull', 60); // more than a hold: the watch would queue at once
    play(sim, 20 * 10);
    expect(sim.world.get(shuttle, SiteRunC)).toBeDefined();
    expect(sim.world.query(TransferC).filter((t) => sim.world.get(t, TransferC)?.from === wreck)).toEqual([]);
  });

  it('a site does not take a shuttle a transfer holds while its pilot walks to it', () => {
    const { sim, home, wreck } = setup(3);
    const shuttle = shuttleOf(sim);
    expect(siteShuttleOk(sim, shuttle)).toBe(true);
    const t = sim.world.createEntity();
    sim.world.add(t, TransferC, { from: wreck, to: home, items: [], total: 1, moved: 0, status: 'boarding', vehicle: shuttle, pilot: 0, trips: 0, fails: 0, retryAt: 0, since: sim.tick });
    expect(siteShuttleOk(sim, shuttle)).toBe(false);
  });

  it('no breach seal is posted on a wreck of the player side (it would wait for metal forever)', () => {
    const { sim, wreck } = setup(3);
    const s = sim.world.get(wreck, ShipC)!;
    s.faction = 'player';
    writeStruct(shipGrid(sim, wreck)!, s.x + 3, s.y + 1, Struct.Space); // a hole in the top wall
    play(sim, 20 * 30);
    expect(breachTiles(sim).filter((b) => b.ship === wreck)).toEqual([]);
    const seals = sim.world.query(JobC).filter((j) => {
      const job = sim.world.get(j, JobC)!;
      return job.kind === 'build' && job.category === 'firefighting' && job.x >= s.x && job.x < s.x + s.width && job.y >= s.y && job.y < s.y + s.height;
    });
    expect(seals).toEqual([]);
    s.state = 'disabled'; // the same hole on a ship that is kept up is a breach
    expect(breachTiles(sim).some((b) => b.ship === wreck)).toBe(true);
  });

  it('a suit worn into a shuttle goes into its stock (it was carried home and stowed there, or lost to a second suit at the hatch)', () => {
    const { sim, home } = setup(3);
    const shuttle = shuttleOf(sim);
    const v = sim.world.get(shuttle, VehicleC)!;
    const before = vehicleSuits(sim, v);
    const [c] = crewOn(sim, home) as [number];
    sim.world.add(c, SuitC, { worn: true, air: 100 });
    sim.enqueue({ type: 'vehicle.embark', crew: c, vehicle: shuttle });
    play(sim, 20 * 60, () => sim.world.has(c, AboardC));
    expect(sim.world.has(c, AboardC)).toBe(true);
    expect(sim.world.has(c, SuitC)).toBe(false);
    expect(vehicleSuits(sim, v)).toBe(before + 1);
  });
});
