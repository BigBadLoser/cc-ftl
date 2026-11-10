import { describe, expect, it } from 'vitest';
import { AboardC, CrewC, PositionC, ShipC, StorageC, Struct, VehicleC, deserialize, placementError, removeModule, serialize, shipGrid, spawnModule, suitDef, suitTile, writeStruct, type SimEvent } from '../../sim';
import { shipIdOf } from '../../sim/regions';
import { AwayC, AwaySiteC, SiteRunC } from '../../sim/away/components';
import { EvaFloatC, SuitC } from '../../sim/eva/components';
import { NeedsC } from '../../sim/crew/components';
import { hatchSpot } from '../../sim/eva/shuttle';
import { StunC } from '../../sim/robots/components';
import { content } from '../index';
import { shuttleOf, storages } from './ferryFixture';
import { looseScrap, of, scrapHome, setup, smallHold } from './salvageEvaFixture';
import { play } from './awayFixture';

/**
 * Salvage on an away site (#286 slice 3), the long runs: the checks of the old salvage team's tests, ported to the site's run (the special-case
 * table of docs/DESIGN.md "How the general design covers each salvage special case"). `play` audits away-owned state every tick.
 */
type Sim = ReturnType<typeof setup>['sim'];
const outOn = (sim: Sim, c: number, wreck: number): boolean => sim.world.has(c, PositionC) && shipIdOf(sim, sim.world.get(c, PositionC)) === wreck;
const partyOut = (sim: Sim, wreck: number): number[] => sim.world.query(AwayC).filter((c) => outOn(sim, c, wreck) && !sim.world.has(c, EvaFloatC));
const phase = (sim: Sim, shuttle: number): string | undefined => sim.world.get(shuttle, SiteRunC)?.phase;
/** Keep the party rested and fed (nobody goes home for a need), so the run carries on. */
function fresh(sim: Sim): void {
  for (const c of sim.world.query(AwayC)) {
    const n = sim.world.get(c, NeedsC);
    if (n) [n.rest, n.hunger] = [100, 100];
  }
}
function wreckAirlock(sim: Sim, wreck: number): number {
  const g = shipGrid(sim, wreck)!;
  for (let rot = 0; rot < 4; rot++) {
    for (let y = g.y0; y < g.y0 + g.height; y++) for (let x = g.x0; x < g.x0 + g.width; x++) if (!placementError(sim, wreck, 'module.airlock', x, y, rot)) return spawnModule(sim, 'module.airlock', x, y, rot);
  }
  return 0;
}

describe('salvage on an away site: the shuttle and EVA loop', () => {
  it('sends a suited party by shuttle, stages the scrap for its hold with trips home, brings everyone home, and removes the wreck', () => {
    const { sim, home, wreck } = setup(3, smallHold(4));
    const before = scrapHome(sim, home);
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech', 'energy', 'weapons', 'comfort'] });
    let lastLoose = 0;
    let party = new Set<number>();
    const all: SimEvent[] = [];
    for (let i = 0; i < 20 * 60 * 30 && of(all, 'salvage.done').length === 0; i++) {
      if (sim.world.has(wreck, ShipC)) lastLoose = looseScrap(sim, wreck);
      for (const c of sim.world.query(AwayC)) party.add(c);
      all.push(...play(sim, 1));
    }
    expect(of(all, 'away.opened')).toMatchObject([{ ship: wreck, vehicle: shuttleOf(sim) }]);
    // The party carried the loot into the site's staging zone (the shuttle loads it from there), and trips home unloaded it while the
    // site stayed open.
    expect(of(all, 'item.hauled').filter((e) => e.to === 'zone' && e.ship === wreck).length).toBeGreaterThan(0);
    expect(of(all, 'away.departed').filter((e) => e.home).length).toBeGreaterThan(1);
    expect(of(all, 'suit.airOut')).toHaveLength(0); // no airlock on this wreck: nobody ran dry while the shuttle was away
    expect(of(all, 'salvage.done')).toMatchObject([{ ship: wreck, removed: true }]);
    expect(sim.world.has(wreck, ShipC)).toBe(false);
    expect(lastLoose).toBe(0); // nothing was left lying on the wreck when it went
    // Everyone is back aboard the home ship and no longer of a party; the site closed with its run.
    const rest = play(sim, 20 * 120, () => sim.world.query(SiteRunC).length === 0);
    expect(of([...all, ...rest], 'away.closed')).toMatchObject([{ ship: wreck, reason: 'closed' }]);
    party = new Set([...party].filter((c) => sim.world.has(c, CrewC)));
    expect(party.size).toBeGreaterThan(0);
    for (const c of party) {
      expect(sim.world.has(c, AwayC)).toBe(false);
      expect(sim.world.has(c, AboardC)).toBe(false);
      expect(shipIdOf(sim, sim.world.get(c, PositionC))).toBe(home);
    }
    expect(scrapHome(sim, home)).toBeGreaterThan(before);
    expect(sim.world.get(shuttleOf(sim), VehicleC)).toMatchObject({ state: 'stowed', pilot: 0 });
  });

  it('is deterministic and survives a save mid-run', () => {
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

  it('a trip home that finds no room keeps the hold loaded and carries on: the site shows noRoom, the loot waits, nobody is left short', () => {
    const { sim, home, wreck } = setup(3, smallHold(4));
    for (const id of storages(sim, home)) sim.world.remove(id, StorageC); // nowhere to put scrap: the hold comes back full
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech'] });
    const shuttle = shuttleOf(sim);
    let leftOut = false;
    const all: SimEvent[] = [];
    for (let i = 0; i < 20 * 60 * 10 && sim.world.get(wreck, AwaySiteC)?.block !== 'noRoom'; i++) {
      all.push(...play(sim, 1));
      if (phase(sim, shuttle) === 'board' && partyOut(sim, wreck).length > 0) leftOut = true;
    }
    expect(leftOut).toBe(true); // someone stayed out while the hold went home
    expect(sim.world.get(wreck, AwaySiteC)?.block).toBe('noRoom');
    const held = sim.world.get(shuttle, VehicleC)!.cargo.reduce((n, q) => n + q.count, 0);
    expect(held).toBeGreaterThan(0);
    all.push(...play(sim, 20 * 120));
    expect(sim.world.has(wreck, AwaySiteC)).toBe(true); // the site goes on
    expect(of(all, 'suit.airOut')).toEqual([]);
  });

  it('never strands a worker when the home bay goes during a trip home: the shuttle docks or hovers at home and goes back', () => {
    const { sim, wreck } = setup(3, smallHold(4));
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech'] });
    const shuttle = shuttleOf(sim);
    let removed = false;
    let backAfter = false;
    const all: SimEvent[] = [];
    for (let i = 0; i < 20 * 60 * 10 && !backAfter; i++) {
      fresh(sim);
      all.push(...play(sim, 1));
      const v = sim.world.get(shuttle, VehicleC)!;
      if (!removed && phase(sim, shuttle) === 'home' && v.state === 'flying' && partyOut(sim, wreck).length > 0) {
        removeModule(sim, v.home);
        removed = true;
      } else if (removed && phase(sim, shuttle) === 'stay') backAfter = true;
    }
    expect(removed).toBe(true);
    expect(backAfter).toBe(true);
    expect(of(all, 'suit.airOut')).toEqual([]);
  });

  it('workers whose tank cannot cover a round trip, with the wreck\'s airlock out of reach, get the last call and ride the trip out aboard', () => {
    // A small tank (120 s): no refill covers a round trip with margin, so everyone staying out when the hold goes home must ride.
    const { sim, wreck } = setup(3, { ...smallHold(4), suit: { ...content.suit!, airSec: 120 } });
    const lock = wreckAirlock(sim, wreck);
    expect(lock).not.toBe(0);
    const at = suitTile(sim, lock)!;
    writeStruct(sim.sector.grid, at.x, at.y, Struct.Wall); // jammed: its suit tile cannot be reached
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech'] });
    const all: SimEvent[] = [];
    let rode = false;
    for (let i = 0; i < 20 * 60 * 10 && !(rode && of(all, 'away.departed').some((e) => e.home)); i++) {
      fresh(sim);
      all.push(...play(sim, 1));
      rode ||= sim.world.query(AwayC).some((c) => sim.world.get(c, AwayC)?.ride);
    }
    expect(rode).toBe(true);
    const trip = of(all, 'away.departed').find((e) => e.home)!;
    expect(trip).toBeDefined();
    for (const c of sim.world.query(AwayC)) if (outOn(sim, c, wreck)) expect(sim.world.get(c, AwayC)?.ride).toBeUndefined(); // nobody short stayed out
    expect(of(all, 'suit.airOut')).toEqual([]);
  });

  it('suits belong to whoever wears them: while the shuttle is away no worker\'s suit is tied to it, and every worker out keeps theirs', () => {
    const { sim, wreck } = setup(3, smallHold(4));
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech'] });
    const shuttle = shuttleOf(sim);
    play(sim, 20 * 120, () => partyOut(sim, wreck).length > 0);
    let away = false;
    for (let i = 0; i < 20 * 60 * 10 && !away; i++) {
      fresh(sim);
      play(sim, 1);
      if (phase(sim, shuttle) === 'home' && partyOut(sim, wreck).length > 0) {
        for (const c of partyOut(sim, wreck)) {
          expect(sim.world.get(c, SuitC)?.worn).toBe(true);
          expect(sim.world.get(c, SuitC)?.vehicle).toBeUndefined();
        }
        away = true;
      }
    }
    expect(away).toBe(true);
  });

  it('a worker boxed in on the wreck, short of any round trip, is never left behind: the shuttle stays, and lifts them in the end', () => {
    const { sim, wreck } = setup(3, smallHold(4));
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech'] });
    const shuttle = shuttleOf(sim);
    // Away from the hatch spot (a worker standing by it can still refill there).
    const far = (c: number): boolean => {
      const q = sim.world.get(c, PositionC)!;
      const at = hatchSpot(sim, shuttle);
      return !!at && Math.hypot(q.x - at.x, q.y - at.y) > 4 && !sim.world.get(c, AwayC)?.landing;
    };
    play(sim, 20 * 400, () => phase(sim, shuttle) === 'stay' && partyOut(sim, wreck).some(far));
    const boxed = partyOut(sim, wreck).find(far)!;
    expect(boxed).toBeDefined();
    const p = sim.world.get(boxed, PositionC)!;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) writeStruct(sim.sector.grid, p.x + dx, p.y + dy, Struct.Wall);
    sim.world.get(boxed, SuitC)!.air = suitDef(sim).airSec * 0.12; // short of any round trip: the shuttle may not leave them
    let left = false;
    for (let i = 0; i < 20 * 60 * 5 && sim.world.get(boxed, AboardC)?.vehicle !== shuttle; i++) {
      fresh(sim);
      play(sim, 1);
      if (outOn(sim, boxed, wreck) && phase(sim, shuttle) === 'home') left = true;
    }
    expect(left).toBe(false);
    expect(sim.world.get(boxed, AboardC)?.vehicle).toBe(shuttle);
  });

  it('a worker put out of action on the wreck is brought aboard before their air runs out, and the site goes on', () => {
    const { sim, wreck } = setup(3);
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech'] });
    const shuttle = shuttleOf(sim);
    const all: SimEvent[] = [];
    let stuck = 0;
    let carried = false;
    for (let i = 0; i < 20 * 60 * 15 && !carried; i++) {
      fresh(sim);
      all.push(...play(sim, 1));
      if (stuck) carried = sim.world.get(stuck, AboardC)?.vehicle === shuttle;
      else if (phase(sim, shuttle) === 'stay') {
        const c = partyOut(sim, wreck).find((m) => !sim.world.get(m, AwayC)?.landing);
        if (c === undefined) continue;
        sim.world.add(c, StunC, { until: sim.tick + 20 * 60 * 60 });
        sim.world.get(c, SuitC)!.air = suitDef(sim).airSec * 0.3;
        stuck = c;
      }
    }
    expect(stuck).not.toBe(0);
    expect(of(all, 'suit.airOut')).toEqual([]);
    expect(carried).toBe(true);
    expect(sim.world.get(wreck, AwaySiteC)?.status).toBe('open');
  });

  it('a trip home turns back without unloading when a worker left on the wreck is put out of action, and picks them up', () => {
    const { sim, wreck } = setup(3, smallHold(4));
    sim.enqueue({ type: 'salvage.order', ship: wreck, types: ['hull', 'tech'] });
    const shuttle = shuttleOf(sim);
    const all: SimEvent[] = [];
    let stuck = 0;
    let unloaded = false;
    let carried = false;
    for (let i = 0; i < 20 * 60 * 15 && !carried; i++) {
      fresh(sim);
      all.push(...play(sim, 1));
      if (stuck) {
        if (phase(sim, shuttle) === 'board') unloaded = true;
        carried = sim.world.get(stuck, AboardC)?.vehicle === shuttle;
      } else if (phase(sim, shuttle) === 'home' && sim.world.get(shuttle, VehicleC)!.state === 'flying') {
        const c = partyOut(sim, wreck)[0];
        if (c === undefined) continue;
        sim.world.add(c, StunC, { until: sim.tick + 20 * 60 * 60 });
        sim.world.get(c, SuitC)!.air = suitDef(sim).airSec * 0.3;
        stuck = c;
      }
    }
    expect(stuck).not.toBe(0);
    expect(unloaded).toBe(false); // turned back without stopping at home
    expect(of(all, 'suit.airOut')).toEqual([]);
    expect(carried).toBe(true);
  });
});
