import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { ShipC, homeShip, newGame, type Sim, type SimEvent } from '../sim';
import { ALT, BodyC } from '../sim/body';
import { DroneC, type Drone } from '../sim/drones/components';
import { stunDrone } from '../sim/drones/bay';
import { shipGrid, shipIdOf } from '../sim/regions';
import { droneInReach } from '../sim/drones/target';
import { CrewC, PositionC } from '../sim';
import { droneScenarioCommands } from './droneScenario';

const drones = (sim: Sim): Drone[] => sim.world.query(DroneC).map((id) => sim.world.get(id, DroneC) as Drone);

/** The player's ship with two bays and two defence drones, and a missile-armed Lancer 40 tiles off. Events of the run so far. */
function fight(seed = 7): { sim: Sim; events: SimEvent[]; step: (secs: number) => void } {
  const sim = newGame(seed, content);
  const events: SimEvent[] = [];
  const step = (secs: number): void => {
    for (let i = 0; i < secs * 20; i++) {
      sim.step();
      events.push(...sim.events.drain());
    }
  };
  step(1);
  for (const c of droneScenarioCommands(sim, true)) sim.enqueue(c);
  step(1);
  const me = sim.world.get(homeShip(sim), ShipC)!;
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.lancer', x: me.x + me.width + 40, y: Math.max(0, me.y - 20) });
  return { sim, events, step };
}

describe('drones in space (#318 slice 2)', () => {
  it('defence drones launch through the hatch when a fight starts, circle the ship and shoot down missiles', () => {
    const { sim, events, step } = fight();
    expect(drones(sim).map((d) => d.def)).toEqual(['drone.defence', 'drone.defence']);
    step(4);
    expect(events.some((e) => e.type === 'combat.started')).toBe(true);
    expect(drones(sim).every((d) => d.state === 'launch' || d.space)).toBe(true);
    step(6);
    for (const id of sim.world.query(DroneC)) {
      expect(sim.world.get(id, DroneC)?.space).toBe(true);
      expect(sim.world.get(id, BodyC)?.alt).toBe(ALT.cruise);
    }
    step(120);
    const byDrone = events.filter((e) => e.type === 'projectile.intercepted' && e.by);
    expect(byDrone.length).toBeGreaterThan(0);
    // Never a provocation, never a shot at a ship.
    expect(events.some((e) => e.type === 'ship.provoked')).toBe(false);
  });

  it('a flee waits for the drones out in space, and they come home and lift with the ship', () => {
    const { sim, events, step } = fight();
    step(15);
    expect(drones(sim).filter((d) => d.space).length).toBe(2);
    sim.enqueue({ type: 'debug.chargeFtl' });
    step(0.1);
    sim.enqueue({ type: 'combat.flee', ship: homeShip(sim) });
    step(0.2);
    expect(events.some((e) => e.type === 'drone.recall')).toBe(true);
    expect(sim.sector.state).toBe('active');
    step(8);
    expect(sim.sector.state).toBe('hyperspace');
    // Both made it back in time: none lost, both docked when the ship lifted (they travel in its packet).
    expect(events.filter((e) => e.type === 'drone.lost').length).toBe(0);
    const lifted = (sim.sector.packet?.entities ?? []).map((e) => (e.c as Record<string, unknown>).drone as Drone | undefined).filter((d): d is Drone => !!d);
    expect(lifted.map((d) => d.state)).toEqual(['docked', 'docked']);
  });

  it('drones still out when the wait is over are left behind and lost', () => {
    const { sim, events, step } = fight();
    step(15);
    for (const id of sim.world.query(DroneC)) stunDrone(sim, id, 60); // knocked out in space: they drift
    sim.enqueue({ type: 'debug.chargeFtl' });
    step(0.1);
    sim.enqueue({ type: 'combat.flee', ship: homeShip(sim) });
    step(3);
    expect(sim.sector.state).toBe('active'); // still waiting for them
    step(5);
    expect(sim.sector.state).toBe('hyperspace');
    expect(events.filter((e) => e.type === 'drone.lost').length).toBe(2);
    expect((sim.sector.packet?.entities ?? []).some((e) => !!(e.c as Record<string, unknown>).drone)).toBe(false);
  });

  it('an enemy drone in space is shot by point defence and defence drones, and its wreck is gone', () => {
    const { sim, events, step } = fight();
    step(12);
    const me = sim.world.get(homeShip(sim), ShipC)!;
    const enemy = sim.world.query(ShipC).find((id) => sim.world.get(id, ShipC)?.faction === 'hostile')!;
    const id = sim.world.createEntity();
    sim.world.add(id, DroneC, {
      def: 'drone.defence', ship: enemy, bay: 0, slot: 0, state: 'out', charge: 100, hp: 30, target: null, steps: [], work: 0, inert: false,
      stunUntil: 0, space: true, lift: 0, cool: 0,
    });
    sim.world.add(id, BodyC, { x: me.x + me.width + 3, y: me.y + me.height / 2, heading: 0, alt: ALT.cruise });
    step(30);
    const hits = events.filter((e) => e.type === 'drone.hit' && e.drone === id);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((e) => e.type === 'drone.hit' && e.cause === 'drone')).toBe(true);
    expect(sim.world.has(id, DroneC)).toBe(false);
    expect(events.some((e) => e.type === 'drone.wrecked' && e.drone === id && e.space)).toBe(true);
  });

  it('fire on its tile burns a docked drone, and its bay mends it once the fire is out', () => {
    const sim = newGame(7, content);
    for (let i = 0; i < 20; i++) sim.step();
    for (const c of droneScenarioCommands(sim, true)) sim.enqueue(c);
    for (let i = 0; i < 20; i++) sim.step();
    const id = sim.world.query(DroneC)[0]!;
    const b = sim.world.get(id, BodyC)!;
    const grid = shipGrid(sim, homeShip(sim))!;
    grid.set('fire', Math.floor(b.x), Math.floor(b.y), 255);
    sim.step();
    const hp = sim.world.get(id, DroneC)!.hp;
    expect(hp).toBeLessThan(30);
    grid.set('fire', Math.floor(b.x), Math.floor(b.y), 0);
    for (let i = 0; i < 40; i++) sim.step();
    expect(sim.world.get(id, DroneC)!.hp).toBeGreaterThan(hp);
  });

  it('crew with a hand weapon can shoot an enemy drone inside their ship, never one of their own side', () => {
    const { sim, step } = fight();
    step(2);
    const home = homeShip(sim);
    const grid = shipGrid(sim, home)!;
    const crew = sim.world.query(CrewC, PositionC).find((c) => shipIdOf(sim, sim.world.get(c, PositionC)) === home)!;
    const at = sim.world.get(crew, PositionC)!;
    const enemy = sim.world.query(ShipC).find((id) => sim.world.get(id, ShipC)?.faction === 'hostile')!;
    const weapon = content.items['item.sidearm']!.hand!;
    const put = (ship: number): number => {
      const id = sim.world.createEntity();
      sim.world.add(id, DroneC, {
        def: 'drone.repair', ship, bay: 0, slot: 0, state: 'out', charge: 100, hp: 40, target: null, steps: [], work: 0, inert: false,
        stunUntil: 0, space: false, lift: 0, cool: 0,
      });
      sim.world.add(id, BodyC, { x: at.x + 0.5, y: at.y + 0.5, heading: 0, alt: ALT.drone });
      return id;
    };
    const own = put(home);
    expect(droneInReach(sim, grid, 'player', home, at, weapon)).toBeNull();
    sim.world.destroyEntity(own);
    const foe = put(enemy);
    expect(droneInReach(sim, grid, 'player', home, at, weapon)?.id).toBe(foe);
  });
});
