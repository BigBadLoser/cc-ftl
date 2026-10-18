import { describe, expect, it } from 'vitest';
import {
  CrewC, DeadC, DraftedC, HealthC, JobC, ModuleC, NeedsC, PositionC, StorageC, deserialize, newGame, placementError, serialize,
  spawnModule, stat, storageAdd, storageCount, type Sim, type SimEvent,
} from '../../sim';
import { applyEffects } from '../../sim/combat/effects';
import { content } from '../index';

const run = (sim: Sim, n: number, stop: () => boolean = () => false): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n && !stop(); i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
const of = <T extends SimEvent['type']>(events: SimEvent[], type: T): Extract<SimEvent, { type: T }>[] =>
  events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
const crewOn = (sim: Sim, gridId: number): number[] => sim.world.query(CrewC).filter((i) => sim.world.get(i, PositionC)?.gridId === gridId);
const roleOf = (sim: Sim, id: number): string => sim.world.get(id, CrewC)!.role;
const storages = (sim: Sim): number[] => sim.world.query(StorageC).filter((s) => sim.world.get(s, ModuleC)!.gridId === 1);
const stock = (sim: Sim, item: string): number => storages(sim).reduce((n, s) => n + storageCount(sim, s, item), 0);
const charge = (sim: Sim, id: number): number => sim.world.get(id, NeedsC)!.charge!;
const killEngineers = (sim: Sim): void => {
  for (const c of crewOn(sim, 1)) if (roleOf(sim, c) === 'role.engineer') sim.world.add(c, DeadC, { tick: 0 });
};

function setup(seed = 1): Sim {
  const sim = newGame(seed, content);
  run(sim, 2);
  return sim;
}
/** Place `n` robot bays on the first free spots of the player ship. */
function bays(sim: Sim, n = 1): number[] {
  const grid = sim.grids.get(1)!;
  const out: number[] = [];
  for (let y = 0; y < grid.height && out.length < n; y++) {
    for (let x = 0; x < grid.width && out.length < n; x++) {
      if (placementError(sim, 1, 'module.robotBay', x, y, 0) === null) out.push(spawnModule(sim, 1, 'module.robotBay', x, y, 0));
    }
  }
  run(sim, 1);
  return out;
}
function spawnRobot(sim: Sim, role = 'role.robot_worker'): number {
  const p = sim.world.get(crewOn(sim, 1)[0]!, PositionC)!;
  sim.enqueue({ type: 'debug.spawnCrew', gridId: 1, x: p.x, y: p.y, role });
  run(sim, 1);
  return Math.max(...sim.world.query(CrewC));
}

describe('robot variants', () => {
  it('the security bot is a heavy chassis: more hp, armour, slower', () => {
    const sim = setup();
    const worker = spawnRobot(sim);
    const sec = spawnRobot(sim, 'role.robot_security');
    expect(sim.world.get(sec, CrewC)!.species).toBe('species.robot_heavy');
    expect(sim.world.get(sec, HealthC)!.max).toBe(200);
    expect(sim.world.get(worker, HealthC)!.max).toBe(120);
    expect(stat(sim, sec, 'moveSpeed')).toBeLessThan(stat(sim, worker, 'moveSpeed'));
    const at = sim.world.get(sec, PositionC)!;
    applyEffects(sim, { gridId: 1, x: at.x, y: at.y, projectile: 0, weapon: 'test' }, [{ type: 'crewDamage', amount: 10 }]);
    expect(sim.world.get(sec, HealthC)!.hp).toBeCloseTo(193);
    expect(sim.world.get(worker, HealthC)!.hp).toBeCloseTo(110);
  });
});

describe('repair and charge', () => {
  it('a robot holds still while a crew mender works on it', () => {
    const sim = setup();
    const robot = spawnRobot(sim);
    sim.world.get(robot, HealthC)!.hp = 70;
    const mended = (): boolean => sim.world.query(JobC).some((j) => {
      const job = sim.world.get(j, JobC)!;
      return job.kind === 'mend' && job.target === robot && job.reservedBy !== 0;
    });
    run(sim, 200, mended);
    expect(mended()).toBe(true);
    run(sim, 2); // finish the step under way
    const p = { ...sim.world.get(robot, PositionC)! };
    let moved = false;
    run(sim, 2400, () => {
      const q = sim.world.get(robot, PositionC)!;
      if (mended() && (q.x !== p.x || q.y !== p.y)) moved = true;
      return !mended();
    });
    expect(moved).toBe(false);
    expect(sim.world.get(robot, HealthC)!.hp).toBe(120);
  });

  it('the battery drains, faster when busy; low charge sends the robot to a free bay, which recharges it', () => {
    const sim = setup();
    const [bay] = bays(sim);
    const robot = spawnRobot(sim);
    sim.world.add(robot, DraftedC, { target: null });
    run(sim, 100);
    expect(charge(sim, robot)).toBeCloseTo(100 - 0.12 * 5, 1);
    sim.world.remove(robot, DraftedC);
    sim.world.get(robot, NeedsC)!.charge = 19;
    const out = run(sim, 600, () => sim.world.get(robot, CrewC)!.activity === 'charging');
    expect(sim.world.get(robot, CrewC)!.activity).toBe('charging');
    expect(of(out, 'robot.charging')).toEqual([{ type: 'robot.charging', crew: robot, bay }]);
    expect(sim.world.get(bay!, ModuleC)!.reservedBy).toBe(robot); // its home bay now
    const m = sim.world.get(bay!, ModuleC)!;
    expect(sim.world.get(robot, PositionC)).toMatchObject({ x: m.x, y: m.y });
    const done = run(sim, 2000, () => sim.world.get(robot, CrewC)!.activity !== 'charging');
    expect(of(done, 'robot.charged')).toHaveLength(1);
    expect(charge(sim, robot)).toBeGreaterThanOrEqual(99.9);
  });

  it('a damaged robot goes to its bay, which repairs it with metal from storage (no mender needed)', () => {
    const sim = setup();
    killEngineers(sim);
    bays(sim);
    const robot = spawnRobot(sim);
    sim.world.get(robot, HealthC)!.hp = 40;
    const metal = stock(sim, 'item.metal');
    run(sim, 3000, () => sim.world.get(robot, HealthC)!.hp >= 120);
    expect(sim.world.get(robot, HealthC)!.hp).toBe(120);
    expect(metal - stock(sim, 'item.metal')).toBe(4); // 80 hp at 25 per unit
  });

  it('one robot per bay: a second robot finds no bay and carries on', () => {
    const sim = setup();
    const [bay] = bays(sim);
    const a = spawnRobot(sim);
    const b = spawnRobot(sim);
    for (const r of [a, b]) sim.world.get(r, NeedsC)!.charge = 5;
    run(sim, 600);
    const charging = [a, b].filter((r) => sim.world.get(r, CrewC)!.activity === 'charging');
    expect(charging).toHaveLength(1);
    expect(sim.world.get(bay!, ModuleC)!.reservedBy).toBe(charging[0]);
  });
});

describe('robot assembly', () => {
  it('consumes the materials over time and spawns a player robot whose home is the bay; one per bay', () => {
    const sim = setup();
    const [bay] = bays(sim);
    storageAdd(sim, storages(sim)[0]!, 'item.parts', 20);
    const before = { parts: stock(sim, 'item.parts'), metal: stock(sim, 'item.metal'), elec: stock(sim, 'item.electronics') };
    sim.enqueue({ type: 'module.assembleRobot', moduleId: bay!, role: 'role.robot_worker' });
    sim.enqueue({ type: 'module.assembleRobot', moduleId: bay!, role: 'role.robot_repair' });
    const first = run(sim, 2);
    expect(of(first, 'command.rejected').map((e) => e.reason)).toEqual(['bayTaken']);
    sim.enqueue({ type: 'module.assembleRobot', moduleId: bay!, role: 'role.engineer' });
    expect(of(run(sim, 1), 'command.rejected').map((e) => e.reason)).toEqual(['badRole']);
    const out = run(sim, 4000, () => sim.world.query(CrewC).some((c) => roleOf(sim, c) === 'role.robot_worker'));
    const made = sim.world.query(CrewC).find((c) => roleOf(sim, c) === 'role.robot_worker')!;
    expect(made).toBeDefined();
    expect(of(out, 'robot.assembled')).toEqual([{ type: 'robot.assembled', crew: made, bay, gridId: 1 }]);
    expect(sim.world.get(bay!, ModuleC)!.reservedBy).toBe(made);
    expect(before.parts - stock(sim, 'item.parts')).toBe(6);
    expect(before.metal - stock(sim, 'item.metal')).toBe(10);
    expect(before.elec - stock(sim, 'item.electronics')).toBe(4);
    sim.enqueue({ type: 'module.assembleRobot', moduleId: bay!, role: 'role.robot_repair' });
    expect(of(run(sim, 1), 'command.rejected').map((e) => e.reason)).toEqual(['bayTaken']);
  });

  it('cancelling drops the delivered materials and frees the bay', () => {
    const sim = setup();
    const [bay] = bays(sim);
    storageAdd(sim, storages(sim)[0]!, 'item.parts', 20);
    sim.enqueue({ type: 'module.assembleRobot', moduleId: bay!, role: 'role.robot_worker' });
    run(sim, 300);
    sim.enqueue({ type: 'module.cancelAssembly', moduleId: bay! });
    run(sim, 1);
    expect(sim.world.query(JobC).some((j) => sim.world.get(j, JobC)!.kind === 'assemble')).toBe(false);
    sim.enqueue({ type: 'module.assembleRobot', moduleId: bay!, role: 'role.robot_worker' });
    expect(of(run(sim, 1), 'command.rejected')).toHaveLength(0);
  });
});

describe('determinism', () => {
  function scene(seed: number): Sim {
    const sim = setup(seed);
    const [bay] = bays(sim, 2);
    storageAdd(sim, storages(sim)[0]!, 'item.parts', 20);
    sim.enqueue({ type: 'module.assembleRobot', moduleId: bay!, role: 'role.robot_repair' });
    const r = spawnRobot(sim);
    sim.world.get(r, NeedsC)!.charge = 10;
    sim.world.get(r, HealthC)!.hp = 50;
    return sim;
  }

  it('same seed, same bays, charging and assembly; save/load mid-charge continues identically', () => {
    const a = scene(5);
    const b = scene(5);
    run(a, 700);
    run(b, 700);
    expect(serialize(a)).toBe(serialize(b));
    const c = deserialize(serialize(a), content);
    run(a, 900);
    run(c, 900);
    expect(serialize(c)).toBe(serialize(a));
  });
});
