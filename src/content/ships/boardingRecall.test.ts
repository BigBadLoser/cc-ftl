import { describe, expect, it } from 'vitest';
import { SuitC, AboardC, DraftedC, EquipC, FighterC, HealthC, ModuleC, StunC, PathC, PositionC, VehicleC, deserialize, placementError, serialize, spawnModule, stampShip, type Sim } from '../../sim';
import { AwayC, AwaySiteC, SiteRunC } from '../../sim/away/components';
import { orderLaunch } from '../../sim/boarding/launch';
import { nearestExterior } from '../../sim/eva/shuttle';
import { content } from '../index';
import { shipIdOf } from '../../sim/regions';
import { airlockOf, crewOn, dockParty, launchParty, modulesOf, nth, of, raiderCrew, run, setup, shuttleOf } from './boardingFixture';

const home = (sim: Sim, c: number): boolean => shipIdOf(sim, sim.world.get(c, PositionC)) === nth(sim, 1);

/** Recall (#287): a boarding is an away site, and `crew.recall` calls its party members home through the site's run. */
describe('recall', () => {
  it('walks the party to the docked shuttle, flies home, stows and steps out; the site closes', () => {
    const sim = setup();
    const { shuttle, party } = launchParty(sim);
    sim.enqueue({ type: 'crew.sabotage', ids: party, module: modulesOf(sim, 2, 'module.reactor')[0]! });
    run(sim, 100);
    sim.enqueue({ type: 'crew.recall', ids: party });
    const out = run(sim, 3000, () => !sim.world.has(shuttle, SiteRunC) && party.every((c) => home(sim, c)));
    expect(sim.world.get(shuttle, VehicleC)!.state).toBe('stowed');
    expect(of(out, 'crew.recallStarted')).toEqual([{ type: 'crew.recallStarted', vehicle: shuttle, ship: nth(sim, 2), crew: [...party].sort((a, b) => a - b), left: [] }]);
    expect(of(out, 'crew.sabotageEnded').map((e) => e.reason)).toEqual(['cancelled', 'cancelled']);
    expect(of(out, 'vehicle.undocked')).toHaveLength(1);
    expect(of(out, 'vehicle.stowed')).toHaveLength(1);
    expect(of(out, 'away.returned')).toMatchObject([{ ship: nth(sim, 2), vehicle: shuttle }]);
    expect(of(out, 'away.closed')).toMatchObject([{ ship: nth(sim, 2), reason: 'closed' }]);
    expect(of(out, 'crew.recallFailed')).toEqual([]);
    for (const c of party) {
      expect(home(sim, c)).toBe(true);
      expect(sim.world.has(c, DraftedC)).toBe(false); // home again: back to their duties
      expect(sim.world.has(c, AwayC)).toBe(false);
    }
    expect(crewOn(sim, 2).filter((c) => party.includes(c))).toEqual([]);
  });

  it('survives save and load while the party walks and while the shuttle flies', () => {
    const finish = (saveWhen: 'stay' | 'home' | null): string => {
      let sim = setup();
      const { shuttle, party } = launchParty(sim);
      sim.enqueue({ type: 'crew.sabotage', ids: party, module: modulesOf(sim, 2, 'module.reactor')[0]! });
      run(sim, 120); // the party is deep in the ship
      sim.enqueue({ type: 'crew.recall', ids: party });
      run(sim, 2);
      if (saveWhen) {
        run(sim, 3000, () => sim.world.get(shuttle, SiteRunC)?.phase === saveWhen);
        expect(sim.world.get(shuttle, SiteRunC)?.phase).toBe(saveWhen);
        sim = deserialize(serialize(sim), content);
      }
      run(sim, 3000, () => party.every((c) => home(sim, c)));
      expect(party.every((c) => home(sim, c))).toBe(true);
      return `${sim.tick}|${sim.world.get(shuttle, VehicleC)!.state}|${sim.world.has(shuttle, SiteRunC)}`;
    };
    const base = finish(null);
    expect(finish('stay')).toBe(base);
    expect(finish('home')).toBe(base);
  });

  it('docks at a home airlock when the bay is down', () => {
    const sim = setup();
    const { shuttle, party } = launchParty(sim);
    sim.world.get(sim.world.get(shuttle, VehicleC)!.home, ModuleC)!.hp = 0;
    sim.enqueue({ type: 'crew.recall', ids: party });
    const out = run(sim, 3000, () => party.every((c) => home(sim, c)));
    expect(sim.world.get(shuttle, VehicleC)!.state).toBe('docked');
    expect(shipIdOf(sim, sim.world.get(sim.world.get(shuttle, VehicleC)!.dock, ModuleC))).toBe(nth(sim, 1));
    expect(of(out, 'crew.recallFailed')).toEqual([]);
    expect(party.every((c) => home(sim, c))).toBe(true);
  });

  it('a boarder recalled under fire walks back to the shuttle: the fight does not send them hunting the defender', () => {
    const sim = setup();
    const { shuttle, party } = launchParty(sim, 1);
    const c = party[0]!;
    sim.world.add(c, EquipC, { weapon: 'item.rifle' }); // armed: it would fight back
    const at = sim.world.get(c, PositionC)!;
    const raider = raiderCrew(sim)[0]!; // a defender wakes up beside them; both outlast the fight
    sim.world.remove(raider, StunC);
    sim.world.add(raider, PositionC, { x: at.x, y: at.y - 1, toX: at.x, toY: at.y - 1, progress: 0, facing: 0 });
    for (const id of [c, raider]) sim.world.get(id, HealthC)!.max = sim.world.get(id, HealthC)!.hp = 100000;
    run(sim, 200, () => (sim.world.get(c, FighterC)?.mode ?? 'idle') !== 'idle');
    expect(sim.world.get(c, FighterC)?.mode).not.toBe('idle'); // in the fight
    sim.enqueue({ type: 'crew.recall', ids: party });
    const out = run(sim, 2000, () => home(sim, c) && !sim.world.has(shuttle, SiteRunC));
    expect(of(out, 'crew.recallStarted')).toHaveLength(1);
    expect(home(sim, c)).toBe(true);
  });

  it('a party landed by hand (shuttle panel, no launch) is recalled the same way: it joins a boarding site, the shuttle brings everyone home', () => {
    const sim = setup();
    const { shuttle, pilot, party } = dockParty(sim);
    sim.enqueue({ type: 'crew.sabotage', ids: party, module: modulesOf(sim, 2, 'module.reactor')[0]! });
    run(sim, 100);
    sim.enqueue({ type: 'crew.recall', ids: party });
    const out = run(sim, 3000, () => !sim.world.has(shuttle, SiteRunC) && [...party, pilot].every((c) => home(sim, c)));
    expect(of(out, 'command.rejected')).toEqual([]);
    expect(of(out, 'crew.recallFailed')).toEqual([]);
    expect(of(out, 'crew.recallStarted')).toEqual([{ type: 'crew.recallStarted', vehicle: shuttle, ship: nth(sim, 2), crew: [...party].sort((a, b) => a - b), left: [] }]);
    expect(of(out, 'crew.sabotageEnded').map((e) => e.reason)).toEqual(['cancelled', 'cancelled']);
    expect(of(out, 'away.opened')).toMatchObject([{ ship: nth(sim, 2), vehicle: shuttle }]);
    expect(sim.world.get(shuttle, VehicleC)!.state).toBe('stowed');
    for (const c of [...party, pilot]) {
      expect(home(sim, c)).toBe(true); // the one left sitting in the shuttle comes home with it
      expect(sim.world.has(c, AwayC)).toBe(false);
      expect(sim.world.has(c, AboardC)).toBe(false);
    }
    expect(sim.world.has(nth(sim, 2), AwaySiteC)).toBe(false);
  });

  it('fails with a reason and leaves the crew put when no shuttle of theirs is docked at the ship, or they are on their own ship', () => {
    const sim = setup();
    const { shuttle, party } = dockParty(sim);
    sim.enqueue({ type: 'vehicle.undock', vehicle: shuttle });
    run(sim, 30, () => sim.world.get(shuttle, VehicleC)!.state !== 'docked');
    const where = party.map((c) => ({ ...sim.world.get(c, PositionC)! }));
    sim.enqueue({ type: 'crew.recall', ids: party });
    const out = run(sim, 60);
    expect(of(out, 'command.rejected')).toEqual([{ type: 'command.rejected', command: 'crew.recall', reason: 'notAboard' }]);
    expect(of(out, 'crew.recallFailed')).toEqual([{ type: 'crew.recallFailed', vehicle: 0, crew: [...party].sort((a, b) => a - b), reason: 'notAboard' }]);
    expect(sim.world.has(nth(sim, 2), AwaySiteC)).toBe(false);
    party.forEach((c, i) => expect(sim.world.get(c, PositionC)).toMatchObject({ x: where[i]!.x, y: where[i]!.y }));
    sim.enqueue({ type: 'crew.recall', ids: crewOn(sim, 1) });
    expect(of(run(sim, 5), 'command.rejected').map((e) => e.reason)).toEqual(['notAboard']);
  });
});

describe('recall of part of the party', () => {
  it('brings the recalled home and goes back for the rest: the site stays open while anyone is out', () => {
    const sim = setup();
    const { shuttle, party } = launchParty(sim, 3);
    const [first, ...stay] = [...party].sort((a, b) => a - b) as [number, ...number[]];
    sim.enqueue({ type: 'crew.recall', ids: [first] });
    const out = run(sim, 4000, () => home(sim, first) && sim.world.get(shuttle, SiteRunC)?.phase === 'stay');
    expect(of(out, 'crew.recallStarted')).toEqual([{ type: 'crew.recallStarted', vehicle: shuttle, ship: nth(sim, 2), crew: [first], left: [] }]);
    expect(of(out, 'away.returned')).toMatchObject([{ crew: [first] }]);
    expect(home(sim, first)).toBe(true);
    expect(sim.world.get(shuttle, SiteRunC)?.phase).toBe('stay'); // back at the enemy for those who stayed
    expect(sim.world.has(nth(sim, 2), AwaySiteC)).toBe(true);
    for (const c of stay) expect(shipIdOf(sim, sim.world.get(c, PositionC))).toBe(nth(sim, 2));
  });

  it('a second launch at a ship a party already boards is refused', () => {
    const sim = setup();
    launchParty(sim, 1);
    expect(orderLaunch(sim, shuttleOf(sim, 1), crewOn(sim, 1).slice(0, 1), airlockOf(sim, 2))).not.toBeNull();
  });
});

describe('recall with several docked shuttles', () => {
  /** A hostile ring ship with two airlocks, each with a player shuttle (clones of the player's) docked, and two crew standing inside it. */
  function twoDocks(): { sim: Sim; shuttles: number[]; airlocks: number[]; crew: number[] } {
    const sim = setup();
    const rows = ['.'.repeat(14), '.' + '#'.repeat(12) + '.', ...Array.from({ length: 10 }, () => '.#' + '_'.repeat(10) + '#.'), '.' + '#'.repeat(12) + '.', '.'.repeat(14)];
    const ringId = stampShip(sim, { name: 'ring', rows }, { faction: 'hostile', state: 'active', x: 200, y: 200 });
    const spots: { x: number; y: number }[] = [];
    for (let y = 200; y < 214; y++) for (let x = 200; x < 214; x++) if (placementError(sim, ringId, 'module.airlock', x, y, 0) === null) spots.push({ x, y });
    const airlocks = [spots[0]!, spots[spots.length - 1]!].map((p) => spawnModule(sim, 'module.airlock', p.x, p.y, 0));
    const proto = sim.world.get(shuttleOf(sim, 1), VehicleC)!;
    const shuttles = airlocks.map((a) => {
      const id = sim.world.createEntity();
      sim.world.add(id, VehicleC, { ...proto, state: 'docked', dock: a, pilot: 0, passengers: [], dest: null });
      return id;
    });
    const crew = crewOn(sim, 1).slice(0, 2);
    const floor = [{ x: 205, y: 205 }, { x: 206, y: 205 }];
    crew.forEach((c, i) => {
      sim.world.remove(c, AboardC);
      sim.world.add(c, PositionC, { x: floor[i]!.x, y: floor[i]!.y, toX: floor[i]!.x, toY: floor[i]!.y, progress: 0, facing: 0 });
      sim.world.add(c, PathC, { steps: [] });
      sim.world.add(c, DraftedC, { target: null });
    });
    return { sim, shuttles, airlocks, crew };
  }

  /** Crew member 0 in a suit on the outside of the ring (only a suit can stand or walk there, so the only route to a hatch or a module is across the hull). */
  function suitedOutside(): { sim: Sim; crew: number; store: number } {
    const { sim, crew } = twoDocks();
    const c = crew[0]!;
    sim.world.add(c, PositionC, { x: 205, y: 200, toX: 205, toY: 200, progress: 0, facing: 0 });
    sim.world.add(c, SuitC, { worn: true });
    for (const a of sim.world.query(ModuleC)) if (sim.world.get(a, ModuleC)!.def === 'module.airlock') sim.world.get(a, ModuleC)!.powered = true;
    return { sim, crew: c, store: spawnModule(sim, 'module.storage', 207, 207, 0) };
  }

  it('recalls a suited boarder whose only route is across the hull', () => {
    const sim = setup();
    const { shuttle, party } = launchParty(sim, 1);
    const c = party[0]!;
    // Out on the raider's hull ring in a suit: the only way back to the docked shuttle is across the hull.
    const spot = nearestExterior(sim, nth(sim, 2), { x: 0, y: 0 }, 1)[0]!;
    Object.assign(sim.world.get(c, PositionC)!, { x: spot.x, y: spot.y, toX: spot.x, toY: spot.y, progress: 0 });
    sim.world.add(c, SuitC, { worn: true, air: 600 });
    sim.enqueue({ type: 'crew.recall', ids: [c] });
    const out = run(sim, 3000, () => home(sim, c) && !sim.world.has(shuttle, SiteRunC));
    expect(of(out, 'command.rejected')).toEqual([]);
    expect(of(out, 'crew.recallStarted')).toHaveLength(1);
    expect(home(sim, c)).toBe(true);
    expect(sim.world.has(shuttle, SiteRunC)).toBe(false);
  });

  it('sends a suited boarder to sabotage a module the same way', () => {
    const { sim, crew, store } = suitedOutside();
    sim.enqueue({ type: 'crew.sabotage', ids: [crew], module: store });
    const out = run(sim, 1);
    expect(of(out, 'command.rejected')).toEqual([]);
    expect(of(out, 'crew.sabotageStarted')).toHaveLength(1);
  });
});
