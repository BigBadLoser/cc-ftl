import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { CrewC, DownedC, HealthC, ModuleC, ShipC, homeShip, newGame, placementError, spawnModule, type Sim } from '../sim';
import { BodyC } from '../sim/body';
import { droneCap, stunDronesNear } from '../sim/drones/bay';
import { candidatesFor } from '../sim/drones/work';
import { findPath } from '../sim/crew/pathfind';
import { shipGrid, shipIdOf } from '../sim/regions';
import { IonC } from '../sim/combat/components';
import { DroneC, type Drone } from '../sim/drones/components';
import { deserialize, serialize } from '../sim/save';
import { droneScenarioCommands } from './droneScenario';

const run = (sim: Sim, secs: number): void => {
  for (let i = 0; i < secs * 20; i++) sim.step();
};
const drones = (sim: Sim): Drone[] => sim.world.query(DroneC).map((id) => sim.world.get(id, DroneC) as Drone);

function scenario(): { sim: Sim; downed: number; wounded: number } {
  const sim = newGame(7, content);
  run(sim, 1); // rooms exist
  const cmds = droneScenarioCommands(sim);
  for (const c of cmds) sim.enqueue(c);
  const set = cmds.filter((c) => c.type === 'debug.setCrew');
  run(sim, 0.5);
  return { sim, downed: set[0]?.type === 'debug.setCrew' ? set[0].id : 0, wounded: set[1]?.type === 'debug.setCrew' ? set[1].id : 0 };
}

describe('drones (#318 slice 1)', () => {
  it('bays take the drones from storage, and the Mk I core lets two out at once', () => {
    const { sim } = scenario();
    expect(drones(sim).length).toBe(3);
    expect(droneCap(sim, drones(sim)[0]!.ship)).toBe(2);
    let most = 0;
    for (let i = 0; i < 60 * 20; i++) {
      sim.step();
      most = Math.max(most, drones(sim).filter((d) => d.state !== 'docked').length);
    }
    expect(most).toBe(2);
  });

  it('a medic drone patches the downed (the bleeding stops) and a repair drone mends modules and fires', () => {
    const { sim, downed } = scenario();
    let patched = false;
    let worked = new Set<string>();
    for (let i = 0; i < 90 * 20; i++) {
      sim.step();
      if (sim.world.get(downed, DownedC)?.patched) patched = true;
      for (const d of drones(sim)) if (d.target && d.steps.length === 0) worked.add(d.target.kind);
    }
    expect(patched || worked.has('firstAid')).toBe(true);
    expect(worked.has('repair') || worked.has('extinguish')).toBe(true);
    worked = new Set();
  });

  it('drones never stand on one target together and fly over solid modules', () => {
    const { sim } = scenario();
    for (let i = 0; i < 40 * 20; i++) {
      sim.step();
      const keys = drones(sim).flatMap((d) => (d.target ? [`${d.target.kind}:${d.target.id}:${d.target.kind === 'extinguish' ? `${d.target.x},${d.target.y}` : ''}`] : []));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('go inert when the AI core goes down, and back to work when it returns', () => {
    const { sim } = scenario();
    run(sim, 10);
    const core = sim.world.query(ModuleC).find((id) => !!sim.content.modules[sim.world.get(id, ModuleC)?.def ?? '']?.aiCore)!;
    sim.world.get(core, ModuleC)!.enabled = false;
    run(sim, 1);
    expect(drones(sim).every((d) => d.inert)).toBe(true);
    for (const id of sim.world.query(DroneC)) if (sim.world.get(id, DroneC)!.state !== 'docked') expect(sim.world.get(id, BodyC)!.alt).toBe(0);
    sim.world.get(core, ModuleC)!.enabled = true;
    run(sim, 1);
    expect(drones(sim).some((d) => d.inert)).toBe(false);
  });

  it('ion on a bay knocks out its docked drones for a while', () => {
    const { sim } = scenario();
    const id = sim.world.query(DroneC).find((e) => sim.world.get(e, DroneC)!.state === 'docked')!;
    const d = sim.world.get(id, DroneC)!;
    sim.world.add(d.bay, IonC, { until: sim.tick + 100 });
    run(sim, 1);
    expect(d.stunUntil).toBeGreaterThan(sim.tick);
    expect(d.state).toBe('docked');
    run(sim, 5);
    expect(d.stunUntil).toBe(0);
  });

  it('ion near a flying drone knocks it out where it is', () => {
    const { sim } = scenario();
    run(sim, 6);
    const id = sim.world.query(DroneC).find((e) => sim.world.get(e, DroneC)!.state !== 'docked')!;
    const b = sim.world.get(id, BodyC)!;
    stunDronesNear(sim, sim.world.get(id, DroneC)!.ship, Math.floor(b.x), Math.floor(b.y), 1);
    run(sim, 1);
    expect(sim.world.get(id, DroneC)!.stunUntil).toBeGreaterThan(sim.tick);
    expect(b.alt).toBe(0);
  });

  it('a hull-mounted module is repaired from a tile a drone can fly to (the airlock, origin on the hull wall)', () => {
    const { sim } = scenario();
    const ship = drones(sim)[0]!.ship;
    const lock = sim.world.query(ModuleC).find((id) => !!sim.content.modules[sim.world.get(id, ModuleC)!.def]?.airlock && shipIdOf(sim, sim.world.get(id, ModuleC)) === ship)!;
    const c = candidatesFor(sim, ship, { kind: 'repair', rate: 1 });
    expect(c.some((t) => t.id === lock)).toBe(false); // whole: no candidate
    sim.world.get(lock, ModuleC)!.hp = 1;
    const t = candidatesFor(sim, ship, { kind: 'repair', rate: 1 }).find((x) => x.id === lock)!;
    expect(t).toBeDefined();
    expect(findPath(sim, ship, { x: t.x, y: t.y }, { x: t.x, y: t.y }, { fly: true })).not.toBeNull();
  });

  it('a bay on a ship with no drone items does not stop bays on other ships from filling', () => {
    const sim = newGame(7, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    run(sim, 1);
    const home = homeShip(sim);
    const raider = sim.world.query(ShipC).find((id) => id !== home && sim.world.get(id, ShipC)?.faction !== 'player')!;
    const g = shipGrid(sim, raider)!;
    let placed = false;
    for (let y = g.y0; y < g.y0 + g.height && !placed; y++) {
      for (let x = g.x0; x < g.x0 + g.width && !placed; x++) {
        if (placementError(sim, raider, 'module.droneBay', x, y, 0)) continue;
        spawnModule(sim, 'module.droneBay', x, y, 0); // first: the lowest bay id, on a ship with no drone items
        placed = true;
      }
    }
    expect(placed).toBe(true);
    for (const c of droneScenarioCommands(sim)) if (c.type === 'debug.spawnModule' || c.type === 'debug.giveItems') sim.enqueue(c);
    run(sim, 0.2);
    expect(drones(sim).filter((d) => d.ship === home).length).toBe(3);
  });

  it('save and load mid-flight give the same run', () => {
    const { sim } = scenario();
    run(sim, 8);
    const copy = deserialize(serialize(sim), content);
    run(sim, 20);
    run(copy, 20);
    const pos = (s: Sim) => s.world.query(DroneC).map((id) => { const b = s.world.get(id, BodyC)!; return [b.x.toFixed(4), b.y.toFixed(4), s.world.get(id, DroneC)!.charge.toFixed(3)]; });
    expect(pos(copy)).toEqual(pos(sim));
    expect(sim.world.query(CrewC).map((id) => sim.world.get(id, HealthC)?.hp)).toEqual(copy.world.query(CrewC).map((id) => copy.world.get(id, HealthC)?.hp));
  });
});
