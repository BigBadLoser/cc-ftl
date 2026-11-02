import { describe, expect, it } from 'vitest';
import { AboardC, CrewC, PositionC, ShipC, StorageC, Struct, VehicleC, deserialize, placementError, removeModule, serialize, shipGrid, spawnModule, suitDef, suitTile, writeStruct, type SimEvent } from '../../sim';
import { shipIdOf } from '../../sim/regions';
import { SalvageCrewC, SalvageTripC } from '../../sim/salvage/components';
import { EvaFloatC, SuitC } from '../../sim/eva/components';
import { NeedsC } from '../../sim/crew/components';
import { vehicleSuits } from '../../sim/eva/shuttle';
import { carryAboard } from '../../sim/salvage/teamCrew';
import { StunC } from '../../sim/robots/components';
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

  it('keeps the shuttle suits through a cargo run: a worker picked up while it is away hands theirs back, the rest are tied again on return', () => {
    const { sim, wreck } = setup(3, smallHold(4));
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech'] });
    const shuttle = shuttleOf(sim);
    const outOn = (c: number): boolean => shipIdOf(sim, sim.world.get(c, PositionC)) === wreck;
    let carried = false;
    let tied = false;
    let away: number[] = [];
    for (let i = 0; i < 20 * 60 * 10 && !tied; i++) {
      play(sim, 1);
      const trip = sim.world.get(shuttle, SalvageTripC);
      const out = trip?.crew.filter(outOn) ?? [];
      if (trip?.run?.stage === 'home' && out.length > 0 && !carried) {
        // Away on the run: the suits outside are untied from the shuttle but still its own.
        for (const c of out) expect(sim.world.get(c, SuitC)?.vehicle).toBeUndefined();
        const fork = deserialize(serialize(sim), content);
        const v = fork.world.get(shuttle, VehicleC)!;
        const suits = vehicleSuits(fork, v);
        carryAboard(fork, out[0]!, shuttle); // the forced pickup of a recall that ran out of time
        expect(fork.world.has(out[0]!, SuitC)).toBe(false);
        expect(vehicleSuits(fork, v)).toBe(suits + 1);
        carried = true;
        away = out;
      }
      if (carried && !trip?.run && trip?.phase === 'work') {
        for (const c of away.filter(outOn)) expect(sim.world.get(c, SuitC)?.vehicle).toBe(shuttle);
        tied = true;
      }
    }
    expect(carried).toBe(true);
    expect(tied).toBe(true);
  });

  it('never leaves a low-air rider behind on a cargo run: one boxed in on the wreck is picked up', () => {
    const { sim, wreck } = setup(3, smallHold(4));
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech'] });
    const shuttle = shuttleOf(sim);
    const all: SimEvent[] = [];
    let boxed = 0;
    let left = false;
    let departed = false;
    for (let i = 0; i < 20 * 60 * 10 && !departed && of(all, 'salvage.teamHome').length === 0; i++) {
      // No airlock on the wreck: everyone low on air rides along (and nobody tires, so the shift goes on).
      for (const c of sim.world.query(SalvageCrewC)) {
        const s = sim.world.get(c, SuitC);
        if (s) s.air = suitDef(sim).airSec * 0.5;
        const n = sim.world.get(c, NeedsC);
        if (n) [n.rest, n.hunger] = [100, 100];
      }
      all.push(...play(sim, 1));
      const run = sim.world.get(shuttle, SalvageTripC)?.run;
      const v = sim.world.get(shuttle, VehicleC)!;
      if (boxed && v.hover !== wreck && shipIdOf(sim, sim.world.get(boxed, PositionC)) === wreck) left = true;
      if (boxed && run?.stage === 'home') departed = true;
      if (run?.stage === 'call' && !boxed) {
        const rider = run.riders.find((c) => shipIdOf(sim, sim.world.get(c, PositionC)) === wreck);
        const p = rider && sim.world.get(rider, PositionC);
        if (!rider || !p) continue;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) writeStruct(sim.sector.grid, p.toX + dx, p.toY + dy, Struct.Wall);
        boxed = rider;
      }
    }
    expect(boxed).not.toBe(0);
    expect(left).toBe(false);
    expect(departed).toBe(true);
    expect(sim.world.get(boxed, AboardC)?.vehicle).toBe(shuttle);
  });

  it('picks up a worker stuck on the wreck before their air runs out, and the shift goes on', () => {
    const { sim, wreck } = setup(3);
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech'] });
    const shuttle = shuttleOf(sim);
    const all: SimEvent[] = [];
    let stuck = 0;
    let carried = false;
    for (let i = 0; i < 20 * 60 * 15 && !carried; i++) {
      for (const c of sim.world.query(SalvageCrewC)) {
        const n = sim.world.get(c, NeedsC);
        if (n) [n.rest, n.hunger] = [100, 100];
      }
      all.push(...play(sim, 1));
      const trip = sim.world.get(shuttle, SalvageTripC);
      if (stuck) carried = sim.world.get(stuck, AboardC)?.vehicle === shuttle;
      else if (trip?.phase === 'work' && !trip.run) {
        // A worker on the wreck is put out of action, low on air: they cannot walk or float to a refill.
        const c = trip.crew.find((m) => shipIdOf(sim, sim.world.get(m, PositionC)) === wreck && !sim.world.has(m, EvaFloatC));
        if (c === undefined) continue;
        sim.world.add(c, StunC, { until: sim.tick + 20 * 60 * 60 });
        sim.world.get(c, SuitC)!.air = suitDef(sim).airSec * 0.3;
        stuck = c;
      }
    }
    expect(stuck).not.toBe(0);
    expect(of(all, 'suit.airOut')).toEqual([]);
    expect(carried).toBe(true);
    expect(sim.world.get(shuttle, SalvageTripC)?.phase).toBe('work');
  });
});
