import { describe, expect, it } from 'vitest';
import { AllegianceC, CrewC, DraftedC, ModuleC, PrioritiesC, PositionC, ShipC, VehicleBayC, VehicleC, destroyVehicle, placementError, shipGrid, spawnModule } from '../../sim';
import { SuitC } from '../../sim/eva/components';
import { spillItems } from '../../sim/items/stacks';
import { playerCourier } from '../../sim/trade/courier';
import { orderLaunch } from '../../sim/boarding/launch';
import { ferryFree } from '../../sim/ferry/pick';
import { shipIdOf } from '../../sim/regions';
import { NestC } from '../../sim/aliens/components';
import { AwayC, AwaySiteC, SiteRunC } from '../../sim/away/components';
import { awayLeaks } from '../../sim/away/owned';
import { airDraining } from '../../sim/ai/airNeed';
import { SalvageOrderC } from '../../sim/salvage/components';
import { outpostRegion, shuttleOf } from './ferryFixture';
import { of, setup } from './salvageEvaFixture';
import { crewOn, play } from './awayFixture';

/** Salvage on an away site (#286 slice 3): the order keeps a site open on the wreck; the site's run does the trips. */
const partyOn = (sim: ReturnType<typeof setup>['sim'], wreck: number): number[] => crewOn(sim, wreck).filter((c) => sim.world.has(c, AwayC));

describe('salvage on an away site: the order, its site and blocks', () => {
  it('blocks with noShuttle when the player has no shuttle, and opens its site once one is back', () => {
    const { sim, wreck } = setup();
    const shuttle = shuttleOf(sim);
    const parked = sim.world.get(shuttle, VehicleC)!;
    const saved = { ...parked };
    sim.world.remove(shuttle, VehicleC);
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull'] });
    const first = play(sim, 200);
    expect(of(first, 'salvage.blocked')).toMatchObject([{ ship: wreck, reason: 'noShuttle' }]);
    expect(sim.world.get(wreck, SalvageOrderC)).toMatchObject({ status: 'blocked', block: 'noShuttle' });
    expect(sim.world.has(wreck, AwaySiteC)).toBe(false);
    sim.world.add(shuttle, VehicleC, saved);
    const later = play(sim, 400, (a) => of(a, 'away.opened').length > 0);
    expect(of(later, 'away.opened')).toMatchObject([{ ship: wreck, vehicle: shuttle }]);
    expect(sim.world.get(wreck, AwaySiteC)).toMatchObject({ owner: 'salvage', status: 'open', vehicle: shuttle });
    expect(sim.world.get(wreck, SalvageOrderC)).toMatchObject({ status: 'running' });
  });

  it('the site wants a builder and a hauler from the first trip: stripping is construction, the loot to come is hauling', () => {
    const { sim, wreck } = setup();
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech'] });
    play(sim, 40, () => sim.world.has(wreck, AwaySiteC));
    play(sim, 20);
    const demand = sim.world.get(wreck, AwaySiteC)!.demand!;
    expect(demand.construction).toBeGreaterThan(0);
    expect(demand.hauling).toBe(1); // nothing lies loose yet: the loot its jobs will drop is one haul
  });

  it('cancelling closes the site: the party comes home and the wreck stays', () => {
    const { sim, home, wreck } = setup();
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech'] });
    play(sim, 20 * 120, () => partyOn(sim, wreck).length > 0);
    const party = sim.world.query(AwayC);
    expect(partyOn(sim, wreck).length).toBeGreaterThan(0);
    sim.enqueue({ type: 'salvage.cancel', ship: wreck });
    const all = play(sim, 20 * 240, (a) => of(a, 'away.closed').length > 0);
    expect(of(all, 'away.closed')).toMatchObject([{ ship: wreck, reason: 'closed' }]);
    for (const c of party) {
      expect(shipIdOf(sim, sim.world.get(c, PositionC))).toBe(home);
      expect(sim.world.has(c, DraftedC)).toBe(false);
      expect(sim.world.has(c, AwayC)).toBe(false);
    }
    expect(sim.world.has(wreck, AwaySiteC)).toBe(false);
    expect(sim.world.has(wreck, ShipC)).toBe(true); // a cancelled order leaves the wreck
  });

  it('something hostile turning up aboard closes the site and sends the party home; no new site while the order is blocked', () => {
    const { sim, home, wreck } = setup();
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech'] });
    play(sim, 20 * 120, () => partyOn(sim, wreck).length > 0);
    const party = sim.world.query(AwayC);
    const s = sim.world.get(wreck, ShipC)!;
    const nest = sim.world.createEntity();
    sim.world.add(nest, NestC, { ship: wreck, x: s.x + 5, y: s.y + 3, timer: 0, laid: 0 });
    const all = play(sim, 20 * 240, (a) => of(a, 'away.closed').length > 0);
    expect(of(all, 'salvage.blocked')).toMatchObject([{ ship: wreck, reason: 'hostile' }]);
    expect(of(all, 'away.closed')).toMatchObject([{ ship: wreck }]);
    for (const c of party) expect(shipIdOf(sim, sim.world.get(c, PositionC))).toBe(home);
    expect(of(play(sim, 20 * 30), 'away.opened')).toHaveLength(0);
    expect(sim.world.has(wreck, AwaySiteC)).toBe(false);
  });

  it('does not open a site with a shuttle parked at a claimed base: the home crew cannot reach its bay', () => {
    const { sim, wreck } = setup();
    const h = sim.world.get(wreck, ShipC)!;
    const base = outpostRegion(sim, h.x + h.width + 20, h.y, false);
    const g = shipGrid(sim, base)!;
    let bay = 0;
    for (let rot = 0; rot < 4 && !bay; rot++) {
      for (let y = g.y0; y < g.y0 + g.height && !bay; y++) for (let x = g.x0; x < g.x0 + g.width && !bay; x++) if (!placementError(sim, base, 'module.vehicle_bay', x, y, rot)) bay = spawnModule(sim, 'module.vehicle_bay', x, y, rot);
    }
    expect(bay).not.toBe(0);
    const shuttle = shuttleOf(sim);
    const v = sim.world.get(shuttle, VehicleC)!;
    sim.world.get(v.home, VehicleBayC)!.vehicle = 0;
    sim.world.get(bay, VehicleBayC)!.vehicle = shuttle;
    v.home = bay;
    expect(sim.world.has(bay, ModuleC)).toBe(true);
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull'] });
    const all = play(sim, 400);
    expect(of(all, 'away.opened')).toHaveLength(0);
    expect(of(all, 'salvage.blocked')).toMatchObject([{ ship: wreck, reason: 'noShuttle' }]);
  });

  it('the site\'s shuttle destroyed mid-run: nothing away-owned outlives it, no suit is tied to it, nobody is left drafted', () => {
    const { sim, wreck } = setup();
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech'] });
    play(sim, 20 * 120, () => partyOn(sim, wreck).length > 0);
    const party = sim.world.query(AwayC);
    const shuttle = shuttleOf(sim);
    destroyVehicle(sim, shuttle);
    const all = play(sim, 40); // the away tests' play fails on any away-owned state that outlives its owner
    expect(of(all, 'away.stranded')).toMatchObject([{ ship: wreck }]); // the only shuttle: the party is stranded (an urgent alert)
    expect(awayLeaks(sim)).toEqual([]);
    for (const c of party) {
      expect(sim.world.get(c, SuitC)?.vehicle).toBeUndefined();
      if (sim.world.has(c, PositionC)) expect(sim.world.has(c, DraftedC)).toBe(false);
    }
  });

  it('the site\'s shuttle is busy for ferry runs, trade runs and boardings', () => {
    const { sim, wreck } = setup();
    const shuttle = shuttleOf(sim);
    expect(playerCourier(sim)).toMatchObject({ vehicle: shuttle });
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull'] });
    play(sim, 400, (a) => of(a, 'away.opened').length > 0);
    expect(sim.world.get(shuttle, SiteRunC)).toMatchObject({ site: wreck });
    expect(ferryFree(sim, shuttle)).toBe(false);
    expect(playerCourier(sim)).toEqual({ error: 'courierBusy' });
    expect(orderLaunch(sim, shuttle, [], 0)).toBe('shuttleBusy');
  });

  it('seats follow the work, not a team rule: a builder who does not haul and a hauler who does not build both go', () => {
    const crewOf = (sim: ReturnType<typeof setup>['sim']): number[] =>
      [...sim.world.query(CrewC, PrioritiesC)].filter((c) => sim.world.get(c, AllegianceC)?.faction === 'player').sort((a, b) => a - b);
    const { sim, wreck } = setup();
    const [builder, ...rest] = crewOf(sim);
    sim.world.get(builder!, PrioritiesC)!.hauling = 0;
    for (const c of rest) sim.world.get(c, PrioritiesC)!.construction = 0;
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull'] });
    play(sim, 20 * 120, (a) => of(a, 'away.departed').length > 0);
    const party = sim.world.query(AwayC);
    expect(party).toContain(builder);
    expect(party.some((c) => rest.includes(c))).toBe(true);
    expect(sim.world.get(builder!, AwayC)!.cat).toBe('construction');
  });

  it('with nobody willing to strip, the construction seats go untaken and the order shows noCrew', () => {
    const { sim, wreck } = setup();
    for (const c of sim.world.query(CrewC, PrioritiesC)) sim.world.get(c, PrioritiesC)!.construction = 0;
    for (const c of sim.world.query(CrewC, PrioritiesC)) sim.world.get(c, PrioritiesC)!.hauling = 0;
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull'] });
    const all = play(sim, 20 * 120);
    expect(of(all, 'away.departed')).toHaveLength(0);
    expect(sim.world.get(wreck, SalvageOrderC)).toMatchObject({ status: 'blocked', block: 'noCrew' });
  });

  it('loot on the site goes into the shuttle\'s hold, not into storage on the wreck (the site\'s run owns its loot)', () => {
    const { sim, wreck } = setup();
    const s = sim.world.get(wreck, ShipC)!;
    expect(placementError(sim, wreck, 'module.storage_locker', s.x + 6, s.y + 3, 0)).toBeNull();
    spawnModule(sim, 'module.storage_locker', s.x + 6, s.y + 3, 0);
    spillItems(sim, wreck, s.x + 2, s.y + 3, 'item.scrap_hull', 4);
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech'] }); // the locker (comfort) stays
    const all = play(sim, 20 * 400, (a) => of(a, 'item.hauled').filter((e) => e.ship === wreck).length >= 2);
    const hauled = of(all, 'item.hauled').filter((e) => e.ship === wreck);
    expect(hauled.length).toBeGreaterThan(0);
    for (const e of hauled) expect(e.to).toBe('vehicle');
  });

  it('salvage workers are on the air drive like anyone (no exemption): a suited worker on the wreck drains', () => {
    const { sim, wreck } = setup();
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech'] });
    play(sim, 20 * 120, () => partyOn(sim, wreck).some((c) => sim.world.has(c, SuitC) && !sim.world.has(c, DraftedC)));
    const worker = partyOn(sim, wreck).find((c) => sim.world.has(c, SuitC) && !sim.world.has(c, DraftedC))!;
    expect(worker).toBeDefined();
    expect(airDraining(sim, worker)).toBe(true);
  });
});
