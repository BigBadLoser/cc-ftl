import { describe, expect, it } from 'vitest';
import {
  AllegianceC, CoreLinkC, CrewC, DeadC, DownedC, DraftedC, EquipC, HackedC, HealthC, InertC, ModuleC, PathC, PositionC,
  PrisonerC, ShipC, StunC, WreckC, deserialize, isSubdued, newGame, serialize, shipEntityOf, storageCount, StorageC,
  WeaponC, type ContentRegistry, type ModuleDef, type Sim, type SimEvent,
} from '../../sim';
import { applyEffects } from '../../sim/combat/effects';
import { wantsToSurrender } from '../../sim/fight/surrender';
import { content } from '../index';
import { gridIdOf } from '../../sim/regions';

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
const robotsOn = (sim: Sim, gridId: number): number[] => crewOn(sim, gridId).filter((i) => sim.world.get(i, CrewC)!.species.startsWith('species.robot'));
const modulesOf = (sim: Sim, gridId: number, def: string): number[] =>
  sim.world.query(ModuleC).filter((i) => gridIdOf(sim, sim.world.get(i, ModuleC)) === gridId && sim.world.get(i, ModuleC)!.def === def);
const ship = (sim: Sim, gridId: number) => sim.world.get(shipEntityOf(sim, gridId), ShipC)!;
const teleport = (sim: Sim, id: number, gridId: number, x: number, y: number): void => {
  sim.world.add(id, PositionC, { gridId, x, y, toX: x, toY: y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
};
/** Sector tile of tile (lx, ly) of a grid, in its local tiles (from the grid's top-left). */
const local = (sim: Sim, gridId: number, lx: number, ly: number): [number, number] => {
  const g = sim.grids.get(gridId)!;
  return [g.x0 + lx, g.y0 + ly];
};
const core = (sim: Sim): number => modulesOf(sim, 2, 'module.aiCore')[0]!;
const roleOf = (sim: Sim, id: number): string => sim.world.get(id, CrewC)!.role;

/** Player ship (grid 1) plus the rogue shipyard (grid 2), its laser off so only the robot rules matter. */
function setup(seed = 1, c: ContentRegistry = content): Sim {
  const sim = newGame(seed, c);
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.rogueShipyard', x: 100, y: 50 });
  run(sim, 3);
  for (const i of sim.world.query(WeaponC)) if (gridIdOf(sim, sim.world.get(i, ModuleC)) === 2) sim.world.get(i, ModuleC)!.enabled = false;
  return sim;
}
/** A tile of grid 1 a player crew member stands on (walkable floor). */
const playerTile = (sim: Sim): { x: number; y: number } => {
  const p = sim.world.get(crewOn(sim, 1)[0]!, PositionC)!;
  return { x: p.x, y: p.y };
};
function spawnRobot(sim: Sim, role = 'role.robot_worker', gridId = 1, at = playerTile(sim)): number {
  sim.enqueue({ type: 'debug.spawnCrew', gridId, x: at.x, y: at.y, role });
  run(sim, 1);
  return Math.max(...sim.world.query(CrewC));
}
/** Every tile of a grid to vacuum (no air, deep cold). */
function vent(sim: Sim, gridId: number): void {
  const g = sim.grids.get(gridId)!;
  for (let y = g.y0; y < g.y0 + g.height; y++) {
    for (let x = g.x0; x < g.x0 + g.width; x++) {
      g.set('o2', x, y, 0);
      g.set('co2', x, y, 0);
      g.set('temp', x, y, -150);
    }
  }
}

describe('robot species', () => {
  it('ignores oxygen and cold in vacuum, while a human suffocates', () => {
    const sim = setup();
    const robot = spawnRobot(sim);
    const human = crewOn(sim, 1).find((i) => i !== robot)!;
    for (const id of [robot, human]) sim.world.add(id, DraftedC, { target: null });
    for (let i = 0; i < 200; i++) {
      vent(sim, 1);
      sim.step();
    }
    expect(sim.world.get(robot, HealthC)!.hp).toBe(120);
    expect(sim.world.get(human, HealthC)!.hp).toBeLessThan(100);
    expect(sim.world.get(robot, CrewC)!.name).toMatch(/^RX-\d{3}$/);
    expect(sim.world.has(robot, CoreLinkC)).toBe(false); // player robots are free-willed
  });

  it('is repaired by a crew member with the repair skill, using parts or metal, and never heals on its own', () => {
    const lone = setup();
    const r0 = spawnRobot(lone);
    lone.world.add(r0, DraftedC, { target: null });
    for (const c of crewOn(lone, 1)) if (roleOf(lone, c) === 'role.engineer') lone.world.add(c, DeadC, { tick: 0 });
    lone.world.get(r0, HealthC)!.hp = 50;
    run(lone, 400);
    expect(lone.world.get(r0, HealthC)!.hp).toBe(50); // no regen and nobody skilled to mend it

    const sim = setup();
    const robot = spawnRobot(sim);
    sim.world.add(robot, DraftedC, { target: null }); // stands still to be mended
    sim.world.get(robot, HealthC)!.hp = 50;
    const metal = (): number => sim.world.query(StorageC).filter((s) => gridIdOf(sim, sim.world.get(s, ModuleC)) === 1)
      .reduce((n, s) => n + storageCount(sim, s, 'item.metal'), 0);
    const before = metal();
    const out = run(sim, 2400, () => sim.world.get(robot, HealthC)!.hp >= 120);
    expect(sim.world.get(robot, HealthC)!.hp).toBe(120);
    expect(before - metal()).toBe(3); // 70 hp at 25 hp per unit
    const done = of(out, 'crew.jobDone').filter((e) => e.kind === 'mend');
    expect(done).toHaveLength(1);
    expect(roleOf(sim, done[0]!.crew)).toBe('role.engineer');
  });

  it('is wrecked at 0 hp, not downed, and the wreck is salvaged for parts', () => {
    const sim = setup();
    const robot = spawnRobot(sim);
    sim.world.get(robot, HealthC)!.hp = 0;
    const out = run(sim, 2);
    expect(sim.world.has(robot, DeadC) && sim.world.has(robot, WreckC)).toBe(true);
    expect(sim.world.has(robot, DownedC)).toBe(false);
    expect(of(out, 'robot.wrecked')).toHaveLength(1);
    expect(of(out, 'crew.downed')).toHaveLength(0);
    const salvaged = run(sim, 3000, () => !sim.world.has(robot, CrewC));
    expect(of(salvaged, 'robot.salvaged')).toHaveLength(1);
    expect(sim.world.has(robot, CrewC)).toBe(false);
  });

  it('never surrenders, however beaten and outnumbered', () => {
    const sim = setup();
    const robot = robotsOn(sim, 2)[0]!;
    const foes = crewOn(sim, 1).slice(0, 3);
    const at = sim.world.get(robot, PositionC)!;
    foes.forEach((f, i) => teleport(sim, f, 2, at.x + 1 + i, at.y));
    sim.world.get(robot, HealthC)!.hp = 5;
    expect(wantsToSurrender(sim, robot, [robot], foes)).toBe(false);
    const raiderLike = foes[0]!; // a wounded human of the same side, outnumbered, would give up
    sim.world.add(raiderLike, AllegianceC, { faction: 'hostile' });
    sim.world.get(raiderLike, HealthC)!.hp = 5;
    expect(wantsToSurrender(sim, raiderLike, [raiderLike], [foes[1]!, foes[2]!])).toBe(true);
  });

  it('is stunned by ion near the hit and by EMP, for its ionStunSec, then recovers; humans are immune', () => {
    const sim = setup();
    const robot = robotsOn(sim, 2)[0]!;
    const human = crewOn(sim, 1)[0]!;
    const at = sim.world.get(robot, PositionC)!;
    teleport(sim, human, 2, at.x, at.y);
    applyEffects(sim, { gridId: 2, x: at.x, y: at.y, projectile: 0, weapon: 'weapon.ion' }, content.weapons['weapon.ion'].effects);
    expect(sim.world.has(robot, StunC)).toBe(true);
    expect(sim.world.has(human, StunC)).toBe(false);
    expect(isSubdued(sim, robot)).toBe(false); // stunned is not taken
    const pos = { ...sim.world.get(robot, PositionC)! };
    run(sim, 8 * 20 - 5);
    expect(sim.world.get(robot, CrewC)!.activity).toBe('inert');
    expect(sim.world.get(robot, PositionC)).toMatchObject({ x: pos.x, y: pos.y });
    run(sim, 10);
    expect(sim.world.has(robot, StunC)).toBe(false);
    applyEffects(sim, { gridId: 2, x: at.x + 3, y: at.y, projectile: 0, weapon: 'emp' }, [{ type: 'emp', seconds: 5, radius: 3 }]);
    expect(sim.world.has(robot, StunC)).toBe(true);
  });
});

describe('AI control and capture', () => {
  it('robots on the shipyard are rogue and core-linked; they go inert when the core loses power and wake when it returns', () => {
    const sim = setup();
    const robots = robotsOn(sim, 2);
    expect(robots).toHaveLength(3);
    for (const r of robots) {
      expect(sim.world.get(r, AllegianceC)!.faction).toBe('rogue');
      expect(sim.world.get(r, CoreLinkC)!.gridId).toBe(2);
      expect(sim.world.has(r, InertC)).toBe(false);
    }
    sim.world.get(core(sim), ModuleC)!.enabled = false;
    const off = run(sim, 2);
    expect(of(off, 'robot.inert')).toHaveLength(3);
    for (const r of robots) expect(isSubdued(sim, r)).toBe(true);
    sim.world.get(core(sim), ModuleC)!.enabled = true;
    const on = run(sim, 2);
    expect(of(on, 'robot.active')).toHaveLength(3);
  });

  it('a live core blocks capture; once it is destroyed the robots go inert and holding the core takes the ship', () => {
    const sim = setup();
    const party = crewOn(sim, 1).slice(0, 2);
    const c = sim.world.get(core(sim), ModuleC)!;
    party.forEach((p, i) => {
      teleport(sim, p, 2, c.x + 2, c.y + i);
      sim.world.add(p, EquipC, { weapon: 'item.rifle' });
      sim.world.add(p, DraftedC, { target: null });
      sim.world.get(p, HealthC)!.max = sim.world.get(p, HealthC)!.hp = 100000;
    });
    for (const r of robotsOn(sim, 2)) sim.world.add(r, DeadC, { tick: 0 }); // crewless: only the core stands in the way
    run(sim, 300);
    expect(ship(sim, 2).state).toBe('active');
    c.hp = 0;
    const out = run(sim, 400, () => ship(sim, 2).state === 'prize');
    expect(ship(sim, 2)).toMatchObject({ state: 'prize', faction: 'player' });
    expect(of(out, 'ship.captured')).toEqual([{ type: 'ship.captured', gridId: 2, by: 'player', from: 'rogue' }]);
  });

  it('inert robots are taken prisoner on capture and stay down', () => {
    const sim = setup();
    const p = crewOn(sim, 1)[0]!;
    const c = sim.world.get(core(sim), ModuleC)!;
    teleport(sim, p, 2, c.x + 2, c.y);
    sim.world.add(p, DraftedC, { target: null });
    c.enabled = false;
    run(sim, 400, () => ship(sim, 2).state === 'prize');
    expect(ship(sim, 2).state).toBe('prize');
    for (const r of robotsOn(sim, 2)) expect(sim.world.has(r, PrisonerC)).toBe(true);
    c.enabled = true; // the core is the player's now: it does not wake rogue robots
    run(sim, 5);
    for (const r of robotsOn(sim, 2)) expect(sim.world.has(r, InertC)).toBe(true);
  });

  it('an engineer hacks the core (a job, not instant): its robots fight for the player while the hacker holds it, then go inert', () => {
    const sim = setup();
    const eng = crewOn(sim, 1).find((i) => roleOf(sim, i) === 'role.engineer')!;
    const c = sim.world.get(core(sim), ModuleC)!;
    teleport(sim, eng, 2, c.x + 3, c.y + 1);
    const robots = robotsOn(sim, 2);
    for (const r of robots) sim.world.add(r, StunC, { until: 1e9 }); // keep the robots out of the fight
    sim.enqueue({ type: 'crew.hack', id: eng, module: core(sim) });
    run(sim, 100);
    expect(sim.world.has(core(sim), HackedC)).toBe(false);
    const out = run(sim, 1000, () => sim.world.has(core(sim), HackedC));
    expect(sim.world.get(core(sim), HackedC)).toMatchObject({ by: 'player', hacker: eng });
    expect(of(out, 'core.hacked')).toHaveLength(1);
    const flip = run(sim, 2);
    expect(of(flip, 'robot.flipped')).toHaveLength(robots.length);
    for (const r of robots) {
      expect(sim.world.get(r, AllegianceC)!.faction).toBe('player');
      expect(sim.world.has(r, InertC)).toBe(false);
    }
    sim.enqueue({ type: 'crew.hack', id: crewOn(sim, 1)[0]!, module: core(sim) });
    expect(of(run(sim, 1), 'command.rejected')).toHaveLength(1); // held: nothing to hack
    teleport(sim, eng, 2, ...local(sim, 2, 15, 5)); // the hacker walks away: the hold breaks
    run(sim, 2);
    expect(sim.world.get(core(sim), HackedC)!.hacker).toBe(0);
    for (const r of robots) {
      expect(sim.world.get(r, AllegianceC)!.faction).toBe('rogue');
      expect(sim.world.has(r, InertC)).toBe(true);
    }
  });
});

describe('robot fabricator', () => {
  const fast = {
    ...content,
    modules: {
      ...content.modules,
      'module.robotFabricator': {
        ...content.modules['module.robotFabricator'],
        robotFabricator: { roles: ['role.robot_worker', 'role.robot_security'], intervalSec: 1, cap: 2 },
      } as ModuleDef,
    },
  };

  it('builds robots up to its cap only while the core is live, and replaces losses', () => {
    const sim = setup(1, fast);
    const start = robotsOn(sim, 2).length;
    const out = run(sim, 200);
    const made = of(out, 'robot.fabricated').map((e) => e.crew);
    expect(made).toHaveLength(2);
    expect(robotsOn(sim, 2)).toHaveLength(start + 2);
    expect(made.map((r) => roleOf(sim, r))).toEqual(['role.robot_worker', 'role.robot_security']);
    for (const r of made) expect(sim.world.get(r, CoreLinkC)!.gridId).toBe(2);
    sim.world.get(made[0]!, HealthC)!.hp = 0; // wrecked: the slot frees up
    expect(of(run(sim, 60), 'robot.fabricated')).toHaveLength(1);
    sim.world.get(core(sim), ModuleC)!.enabled = false;
    sim.world.get(made[1]!, HealthC)!.hp = 0;
    expect(of(run(sim, 200), 'robot.fabricated')).toHaveLength(0);
    sim.world.get(core(sim), ModuleC)!.enabled = true;
    expect(of(run(sim, 60), 'robot.fabricated')).toHaveLength(1);
  });

  it('stops while unpowered itself', () => {
    const sim = setup(1, fast);
    for (const f of modulesOf(sim, 2, 'module.robotFabricator')) sim.world.get(f, ModuleC)!.enabled = false;
    expect(of(run(sim, 200), 'robot.fabricated')).toHaveLength(0);
  });
});

describe('determinism and saves', () => {
  /** A boarding party in a firefight with the robots, the core live, the fabricator running. */
  function fight(seed: number): Sim {
    const sim = setup(seed);
    for (const i of sim.world.query(WeaponC)) if (gridIdOf(sim, sim.world.get(i, ModuleC)) === 2) sim.world.get(i, ModuleC)!.enabled = true;
    const party = crewOn(sim, 1).slice(0, 3);
    party.forEach((p, i) => {
      teleport(sim, p, 2, ...local(sim, 2, 9, 6 + i));
      sim.world.add(p, EquipC, { weapon: i === 0 ? 'item.ion_pistol' : 'item.rifle' });
      sim.world.add(p, DraftedC, { target: null });
    });
    return sim;
  }

  it('same seed, same robot fight', () => {
    const a = fight(7);
    const b = fight(7);
    const ea = run(a, 900);
    run(b, 900);
    expect(serialize(a)).toBe(serialize(b));
    expect(of(ea, 'crew.hit').length).toBeGreaterThan(0);
  });

  it('save and load mid-fight continues identically', () => {
    const a = fight(3);
    const ea = run(a, 300);
    expect(of(ea, 'crew.attacked').length).toBeGreaterThan(0);
    const b = deserialize(serialize(a), content);
    run(a, 600);
    run(b, 600);
    expect(serialize(b)).toBe(serialize(a));
  });
});
