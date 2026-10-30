import { describe, expect, it } from 'vitest';
import { AboardC, DraftedC, EmbarkOrderC, ModuleC, PathC, PositionC, RecallC, VehicleC, deserialize, placementError, serialize, spawnModule, stampShip, type Sim } from '../../sim';
import { content } from '../index';
import { shipIdOf } from '../../sim/regions';
import { crewOn, dockParty, modulesOf, nth, of, run, setup, shuttleOf } from './boardingFixture';

const home = (sim: Sim, c: number): boolean => shipIdOf(sim, sim.world.get(c, PositionC)) === nth(sim, 1);

describe('recall', () => {
  it('walks the party to the docked shuttle, flies home, stows and steps out', () => {
    const sim = setup();
    const { shuttle, pilot, party } = dockParty(sim);
    sim.enqueue({ type: 'crew.sabotage', ids: party, module: modulesOf(sim, 2, 'module.reactor')[0]! });
    run(sim, 100);
    sim.enqueue({ type: 'crew.recall', ids: party });
    const out = run(sim, 3000, () => !sim.world.has(shuttle, RecallC) && party.every((c) => home(sim, c)));
    expect(sim.world.get(shuttle, VehicleC)!.state).toBe('stowed');
    expect(of(out, 'crew.recallStarted')).toEqual([{ type: 'crew.recallStarted', vehicle: shuttle, ship: nth(sim, 2), crew: [...party].sort((a, b) => a - b) }]);
    expect(of(out, 'crew.sabotageEnded').map((e) => e.reason)).toEqual(['cancelled', 'cancelled']);
    expect(of(out, 'vehicle.undocked')).toHaveLength(1);
    expect(of(out, 'vehicle.stowed')).toHaveLength(1);
    expect(of(out, 'crew.recalled')).toHaveLength(1);
    expect(of(out, 'crew.recallFailed')).toEqual([]);
    for (const c of party) {
      expect(home(sim, c)).toBe(true);
      expect(sim.world.has(c, DraftedC)).toBe(false); // home again: back to their duties
    }
    expect(sim.world.get(shuttle, VehicleC)!.pilot).toBe(pilot);
    expect(crewOn(sim, 2).filter((c) => party.includes(c))).toEqual([]);
  });

  it('survives save and load while the party walks and while the shuttle flies', () => {
    const finish = (saveWhen: 'boarding' | 'flying' | null): string => {
      let sim = setup();
      const { shuttle, party } = dockParty(sim);
      sim.enqueue({ type: 'crew.sabotage', ids: party, module: modulesOf(sim, 2, 'module.reactor')[0]! });
      run(sim, 120); // the party is deep in the ship
      sim.enqueue({ type: 'crew.recall', ids: party });
      run(sim, 2);
      if (saveWhen) {
        run(sim, 3000, () => sim.world.get(shuttle, RecallC)?.state === saveWhen);
        expect(sim.world.get(shuttle, RecallC)?.state).toBe(saveWhen);
        sim = deserialize(serialize(sim), content);
      }
      run(sim, 3000, () => party.every((c) => home(sim, c)));
      expect(party.every((c) => home(sim, c))).toBe(true);
      return `${sim.tick}|${sim.world.get(shuttle, VehicleC)!.state}|${sim.world.has(shuttle, RecallC)}`;
    };
    const base = finish(null);
    expect(finish('boarding')).toBe(base);
    expect(finish('flying')).toBe(base);
  });

  it('docks at a home airlock when the bay is down', () => {
    const sim = setup();
    const { shuttle, party } = dockParty(sim);
    sim.world.get(sim.world.get(shuttle, VehicleC)!.home, ModuleC)!.hp = 0;
    sim.enqueue({ type: 'crew.recall', ids: party });
    const out = run(sim, 3000, () => party.every((c) => home(sim, c)));
    expect(sim.world.get(shuttle, VehicleC)!.state).toBe('docked');
    expect(shipIdOf(sim, sim.world.get(sim.world.get(shuttle, VehicleC)!.dock, ModuleC))).toBe(nth(sim, 1));
    expect(of(out, 'crew.recallFailed')).toEqual([]);
    expect(party.every((c) => home(sim, c))).toBe(true);
  });

  it('fails with a reason and leaves the crew put when there is no shuttle to reach', () => {
    const sim = setup();
    const { shuttle, pilot, party } = dockParty(sim);
    sim.enqueue({ type: 'vehicle.undock', vehicle: shuttle }); // the shuttle leaves
    run(sim, 3);
    const where = party.map((c) => ({ ...sim.world.get(c, PositionC)! }));
    sim.enqueue({ type: 'crew.recall', ids: party });
    const out = run(sim, 60);
    expect(of(out, 'command.rejected')).toEqual([{ type: 'command.rejected', command: 'crew.recall', reason: 'noShuttle' }]);
    expect(of(out, 'crew.recallFailed')).toEqual([{ type: 'crew.recallFailed', vehicle: 0, crew: [...party].sort((a, b) => a - b), reason: 'noShuttle' }]);
    party.forEach((c, i) => expect(sim.world.get(c, PositionC)).toMatchObject({ x: where[i]!.x, y: where[i]!.y }));
    expect(sim.world.has(shuttle, RecallC)).toBe(false);
    expect(sim.world.has(pilot, AboardC)).toBe(true);
  });

  it('fails when the shuttle cannot go home at all, or the crew is on their own ship', () => {
    const sim = setup();
    const { shuttle, party } = dockParty(sim);
    sim.world.get(sim.world.get(shuttle, VehicleC)!.home, ModuleC)!.hp = 0;
    for (const m of sim.world.query(ModuleC)) if (sim.world.get(m, ModuleC)!.def === 'module.airlock' && shipIdOf(sim, sim.world.get(m, ModuleC)) === nth(sim, 1)) sim.world.get(m, ModuleC)!.hp = 0;
    sim.enqueue({ type: 'crew.recall', ids: party });
    expect(of(run(sim, 5), 'command.rejected').map((e) => e.reason)).toEqual(['noHome']);
    expect(sim.world.has(shuttle, RecallC)).toBe(false);
    sim.enqueue({ type: 'crew.recall', ids: crewOn(sim, 1) });
    expect(of(run(sim, 5), 'command.rejected').map((e) => e.reason)).toEqual(['notAboard']);
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

  it('seats the party in the second shuttle when the first one is cut off', () => {
    const { sim, shuttles, airlocks, crew } = twoDocks();
    sim.world.get(airlocks[0]!, ModuleC)!.hp = 0; // the first shuttle's airlock is down
    sim.world.get(airlocks[1]!, ModuleC)!.powered = true; // (the ring has no reactor; the command is read before the power system runs)
    sim.enqueue({ type: 'crew.recall', ids: crew });
    const out = run(sim, 2);
    expect(of(out, 'command.rejected')).toEqual([]);
    expect(of(out, 'crew.recallFailed')).toEqual([]);
    expect(of(out, 'crew.recallStarted').map((e) => e.vehicle)).toEqual([shuttles[1]]);
    expect(sim.world.has(shuttles[0]!, RecallC)).toBe(false);
    for (const c of crew) expect(sim.world.get(c, EmbarkOrderC)?.vehicle).toBe(shuttles[1]);
  });
});
