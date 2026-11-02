import { describe, expect, it } from 'vitest';
import { AboardC, CrewC, PositionC, ShipC, StorageC, Struct, VehicleC, deserialize, placementError, removeModule, serialize, shipGrid, spawnModule, suitDef, suitTile, writeStruct, type SimEvent } from '../../sim';
import { shipIdOf } from '../../sim/regions';
import { SalvageCrewC, SalvageTripC } from '../../sim/salvage/components';
import { SuitC } from '../../sim/eva/components';
import { content } from '../index';
import { shuttleOf, storages } from './ferryFixture';
import { looseScrap, of, play, scrapHome, setup, smallHold } from './salvageEvaFixture';

describe('salvage teams: the shuttle and EVA loop', () => {
  it('sends a suited team by shuttle, carries the scrap to it with cargo runs home, brings the crew home, and removes the wreck', () => {
    const { sim, home, wreck } = setup(3, smallHold(4));
    const before = scrapHome(sim, home);
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech', 'energy', 'weapons', 'comfort'] });
    let lastLoose = 0;
    const all: SimEvent[] = [];
    for (let i = 0; i < 20 * 60 * 30 && of(all, 'salvage.done').length === 0; i++) {
      if (sim.world.has(wreck, ShipC)) lastLoose = looseScrap(sim, wreck);
      all.push(...play(sim, 1));
    }
    const sent = of(all, 'salvage.teamSent');
    expect(sent.length).toBeGreaterThan(0);
    expect(sent[0]!.vehicle).toBe(shuttleOf(sim));
    // The team carried the loot to the hovering shuttle (haul jobs into its hold), and someone flew it home to unload mid-shift.
    expect(of(all, 'item.hauled').filter((e) => e.to === 'vehicle' && e.ship === wreck).length).toBeGreaterThan(0);
    expect(of(all, 'salvage.cargoRun').length).toBeGreaterThan(0);
    expect(of(all, 'suit.airOut')).toHaveLength(0); // no airlock on this wreck: nobody stayed out past their air while the shuttle was away
    expect(of(all, 'salvage.done')).toMatchObject([{ ship: wreck, removed: true }]);
    expect(sim.world.has(wreck, ShipC)).toBe(false);
    expect(lastLoose).toBe(0); // nothing was left lying on the wreck when it went
    // Everyone is back aboard the home ship, out of their suits and no longer on the team.
    const rest = play(sim, 20 * 120, () => sim.world.query(SalvageTripC).length === 0);
    for (const c of sent.flatMap((e) => e.crew)) {
      if (!sim.world.has(c, CrewC)) continue;
      expect(sim.world.has(c, SalvageCrewC)).toBe(false);
      expect(sim.world.has(c, AboardC)).toBe(false);
      expect(shipIdOf(sim, sim.world.get(c, PositionC))).toBe(home);
      expect(sim.world.has(c, SuitC)).toBe(false);
    }
    expect(of([...all, ...rest], 'salvage.teamHome').at(-1)).toMatchObject({ ship: wreck, reason: 'done' });
    expect(scrapHome(sim, home)).toBeGreaterThan(before);
    expect(sim.world.get(shuttleOf(sim), VehicleC)).toMatchObject({ state: 'stowed', pilot: 0 });
  });

  it('is deterministic and survives a save mid-shift', () => {
    const a = setup(5);
    const b = setup(5);
    for (const s of [a, b]) s.sim.enqueue({ type: 'salvage.order', ship: s.wreck, types: ['hull', 'tech'] });
    play(a.sim, 20 * 90);
    play(b.sim, 20 * 90);
    expect(serialize(a.sim)).toBe(serialize(b.sim));
    const c = deserialize(serialize(a.sim), content);
    play(a.sim, 20 * 90);
    play(c, 20 * 90);
    expect(serialize(c)).toBe(serialize(a.sim));
  });

  it('a cargo run that finds no room at home fetches the crew still on the wreck before the shift ends', () => {
    const { sim, home, wreck } = setup(3, smallHold(4));
    for (const id of storages(sim, home)) sim.world.remove(id, StorageC); // nowhere to put scrap: the hold comes back full
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech'] });
    let leftOut = false;
    const all: SimEvent[] = [];
    for (let i = 0; i < 20 * 60 * 10 && of(all, 'salvage.teamHome').length === 0; i++) {
      all.push(...play(sim, 1));
      const trip = sim.world.query(SalvageTripC).map((v) => sim.world.get(v, SalvageTripC)!)[0];
      if (trip?.run?.stage === 'unload' && trip.crew.some((c) => shipIdOf(sim, sim.world.get(c, PositionC)) === wreck)) leftOut = true;
    }
    expect(of(all, 'salvage.cargoRun').length).toBeGreaterThan(0);
    expect(leftOut).toBe(true); // someone stayed out while the hold went home
    expect(of(all, 'salvage.teamHome')).toMatchObject([{ ship: wreck, reason: 'noRoom' }]);
    for (const c of of(all, 'salvage.teamSent').flatMap((e) => e.crew)) {
      expect(shipIdOf(sim, sim.world.get(c, PositionC))).toBe(home);
      expect(sim.world.has(c, SalvageCrewC)).toBe(false);
    }
  });

  it('never leaves a worker on the wreck when the home bay goes during a cargo run: the shuttle flies back and recalls them', () => {
    const { sim, wreck } = setup(3, smallHold(4));
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech'] });
    const shuttle = shuttleOf(sim);
    let removed = false;
    const all: SimEvent[] = [];
    for (let i = 0; i < 20 * 60 * 10 && of(all, 'salvage.teamHome').length === 0; i++) {
      all.push(...play(sim, 1));
      const trip = sim.world.get(shuttle, SalvageTripC);
      const v = sim.world.get(shuttle, VehicleC)!;
      const out = trip?.crew.some((c) => shipIdOf(sim, sim.world.get(c, PositionC)) === wreck);
      if (!removed && trip?.run?.stage === 'home' && v.state === 'flying' && out) {
        removeModule(sim, v.home);
        removed = true;
      }
    }
    expect(removed).toBe(true);
    expect(of(all, 'salvage.teamHome')).toMatchObject([{ ship: wreck, reason: 'lost' }]);
    for (const c of of(all, 'salvage.teamSent').flatMap((e) => e.crew)) expect(shipIdOf(sim, sim.world.get(c, PositionC))).not.toBe(wreck);
  });

  it('takes along a low-air worker who cannot reach the airlock on the wreck', () => {
    const { sim, wreck } = setup(3, smallHold(4));
    const g = shipGrid(sim, wreck)!;
    let lock = 0;
    for (let rot = 0; rot < 4 && !lock; rot++) {
      for (let y = g.y0; y < g.y0 + g.height && !lock; y++) for (let x = g.x0; x < g.x0 + g.width && !lock; x++) if (!placementError(sim, wreck, 'module.airlock', x, y, rot)) lock = spawnModule(sim, 'module.airlock', x, y, rot);
    }
    expect(lock).not.toBe(0);
    const at = suitTile(sim, lock)!;
    writeStruct(sim.sector.grid, at.x, at.y, Struct.Wall); // jammed: its suit tile cannot be reached
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech'] });
    const all: SimEvent[] = [];
    for (let i = 0; i < 20 * 60 * 10 && of(all, 'salvage.cargoRun').length === 0; i++) {
      for (const c of sim.world.query(SalvageCrewC)) {
        const s = sim.world.get(c, SuitC);
        if (s) s.air = suitDef(sim).airSec * 0.5; // low, but above the refill mark
      }
      all.push(...play(sim, 1));
    }
    const run = of(all, 'salvage.cargoRun')[0]!;
    const team = of(all, 'salvage.teamSent').at(-1)!.crew;
    expect(team.length).toBeGreaterThan(1);
    expect(run.riders).toEqual(team.filter((c) => c !== run.pilot));
  });
});
