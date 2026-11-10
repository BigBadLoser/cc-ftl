import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { ProjectileC, ShipC, homeShip, newGame, type Sim, type SimEvent } from '../sim';
import { ALT, BodyC } from '../sim/body';
import { spawnDrone } from '../sim/drones/bay';
import { DroneC } from '../sim/drones/components';
import { ModuleC } from '../sim';
import { shipIds } from '../sim/regions';
import { DRONE_LAND_GAP_SEC, ENEMY_DRONE_MIN_DEPTH } from '../sim/tuning';
import { droneScenarioCommands } from './droneScenario';

const TPS = 20;

/** Our ship with two bays and two defence drones, and a generated hostile ship of `faction` at `depth` 40 tiles off. */
function against(faction: string, depth: number, seed = 5): { sim: Sim; enemy: number; events: SimEvent[]; ticks: number[]; step: (secs: number) => void } {
  const sim = newGame(7, content);
  const events: SimEvent[] = [];
  const ticks: number[] = [];
  const step = (secs: number): void => {
    for (let i = 0; i < secs * TPS; i++) {
      sim.step();
      for (const e of sim.events.drain()) {
        events.push(e);
        ticks.push(sim.tick);
      }
    }
  };
  step(1);
  for (const c of droneScenarioCommands(sim, true)) sim.enqueue(c);
  step(1);
  sim.enqueue({ type: 'debug.spawnGenerated', faction, seed, depth, cx: 130, cy: 70 });
  step(0.1);
  const enemy = shipIds(sim).find((id) => id !== homeShip(sim))!;
  return { sim, enemy, events, ticks, step };
}

const dronesOf = (sim: Sim, ship: number): number[] => sim.world.query(DroneC).filter((id) => sim.world.get(id, DroneC)?.ship === ship);

describe('enemy drones (#318 slice 2b)', () => {
  for (const faction of ['faction.navy', 'faction.drones']) {
    it(`${faction}: a ship from depth ${ENEMY_DRONE_MIN_DEPTH} on carries a drone bay with defence drones docked in it, shallower ones none`, () => {
      const deep = against(faction, 5);
      const ds = dronesOf(deep.sim, deep.enemy);
      expect(ds.length).toBe(1);
      expect(deep.sim.world.get(ds[0] as number, DroneC)).toMatchObject({ def: 'drone.defence' });
      // docked, or just starting to launch: a launch order can land in the first tenth of a second, depending on the entity ids of the start ship
      expect(['docked', 'launch']).toContain(deep.sim.world.get(ds[0] as number, DroneC)?.state);
      expect(deep.sim.world.query(ModuleC).some((m) => deep.sim.world.get(m, ModuleC)?.def === 'module.droneBay')).toBe(true);
      const late = against(faction, 8);
      expect(dronesOf(late.sim, late.enemy).length).toBe(2);
      const shallow = against(faction, ENEMY_DRONE_MIN_DEPTH - 1);
      expect(dronesOf(shallow.sim, shallow.enemy).length).toBe(0);
    });
  }

  it('an enemy defence drone goes up when the fight starts and shoots down our missile', () => {
    const { sim, enemy, events, step } = against('faction.navy', 8);
    step(12);
    const mine = dronesOf(sim, enemy);
    expect(events.some((e) => e.type === 'drone.launchedSpace' && e.ship === enemy)).toBe(true);
    expect(mine.some((id) => sim.world.get(id, DroneC)?.space)).toBe(true);
    // A missile of ours, hanging in flight beside their ship: their drones may take it.
    const e = sim.world.get(enemy, ShipC)!;
    const p = sim.world.createEntity();
    sim.world.add(p, ProjectileC, {
      weapon: 'weapon.missile', fromShip: homeShip(sim), fromModuleId: 0, target: { ship: enemy, moduleId: 0 },
      x0: e.x - 6, y0: e.y + e.height / 2, x1: e.x - 6, y1: e.y + e.height / 2, x: e.x - 6, y: e.y + e.height / 2, t: 0.5, dt: 0, spread: 0, pdRolled: true,
    });
    step(40);
    const hit = events.find((x) => x.type === 'projectile.intercepted' && x.projectile === p);
    expect(hit?.type === 'projectile.intercepted' && mine.includes(hit.by ?? 0)).toBe(true);
  });

  it('our drones and point defence shoot an enemy drone that comes close, and it does not provoke anything', () => {
    const { sim, enemy, events, step } = against('faction.navy', 8);
    step(8);
    const me = sim.world.get(homeShip(sim), ShipC)!;
    const target = dronesOf(sim, enemy).find((id) => sim.world.get(id, DroneC)?.space)!;
    const b = sim.world.get(target, BodyC);
    expect(b).toBeDefined();
    if (b) [b.x, b.y] = [me.x + me.width + 3, me.y + me.height / 2];
    step(30);
    expect(events.some((e) => e.type === 'drone.hit' && e.drone === target)).toBe(true);
  });
});

describe('a wrecked ship takes its drones with it (#318 slice 2b)', () => {
  it('drones out in space and docked ones are wrecked when their ship becomes a wreck', () => {
    const { sim, enemy, events, step } = against('faction.navy', 8);
    step(12);
    expect(dronesOf(sim, enemy).some((id) => sim.world.get(id, DroneC)?.space)).toBe(true);
    sim.world.get(enemy, ShipC)!.state = 'wreck';
    step(1);
    expect(dronesOf(sim, enemy).length).toBe(0);
    expect(events.filter((e) => e.type === 'drone.wrecked' && e.ship === enemy).length).toBe(2);
  });
});

describe('staggered return (#318 slice 2b)', () => {
  it('recalled drones land one after another, not all at once, and are all in before the departure', () => {
    const { sim, events, ticks, step } = against('faction.navy', 1);
    step(14);
    expect(sim.world.query(DroneC).filter((id) => sim.world.get(id, DroneC)?.space).length).toBe(2);
    // Both just off the ship in the same spot, so they would come in together.
    const me = sim.world.get(homeShip(sim), ShipC)!;
    for (const id of sim.world.query(DroneC)) {
      const b = sim.world.get(id, BodyC)!;
      [b.x, b.y] = [me.x + me.width / 2, me.y - 6];
    }
    sim.enqueue({ type: 'debug.chargeFtl' });
    step(0.1);
    const from = ticks.length;
    sim.enqueue({ type: 'combat.flee', ship: homeShip(sim) });
    step(9);
    const docked = events.map((e, i) => ({ e, t: ticks[i] as number })).slice(from).filter((x) => x.e.type === 'drone.docked').map((x) => x.t);
    expect(docked.length).toBe(2);
    expect(((docked[1] as number) - (docked[0] as number)) / TPS).toBeGreaterThanOrEqual(DRONE_LAND_GAP_SEC - 0.1);
    expect(events.some((e) => e.type === 'drone.lost')).toBe(false);
  });

  it('four drones out and an immediate departure: the queue never strands one', () => {
    const { sim, events, step } = against('faction.navy', 1);
    step(14);
    const me = sim.world.get(homeShip(sim), ShipC)!;
    const bays = sim.world.query(ModuleC).filter((m) => sim.world.get(m, ModuleC)?.def === 'module.droneBay');
    // Two more guards (the Mk I core only lets two launch, but nothing stops more being out), all four in one spot.
    for (const [bay, slot] of [[bays[0] as number, 1], [bays[1] as number, 1]] as const) {
      const id = spawnDrone(sim, 'drone.defence', bay, slot);
      if (!id) continue;
      const d = sim.world.get(id, DroneC)!;
      Object.assign(d, { state: 'out', space: true });
      Object.assign(sim.world.get(id, BodyC)!, { alt: ALT.cruise });
    }
    for (const id of sim.world.query(DroneC)) {
      const b = sim.world.get(id, BodyC)!;
      [b.x, b.y] = [me.x + me.width / 2, me.y - 5];
    }
    expect(sim.world.query(DroneC).filter((id) => sim.world.get(id, DroneC)?.space).length).toBe(4);
    sim.enqueue({ type: 'debug.chargeFtl' });
    step(0.1);
    sim.enqueue({ type: 'combat.flee', ship: homeShip(sim) });
    step(14);
    expect(sim.sector.state).toBe('hyperspace');
    expect(events.filter((e) => e.type === 'drone.lost').length).toBe(0);
    const lifted = (sim.sector.packet?.entities ?? []).map((e) => (e.c as Record<string, unknown>).drone as { state: string } | undefined).filter((d) => !!d);
    expect(lifted.map((d) => d?.state)).toEqual(['docked', 'docked', 'docked', 'docked']);
  });
});
