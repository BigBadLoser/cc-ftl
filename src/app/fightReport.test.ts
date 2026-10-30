import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { CrewC, ModuleC, ShipC, homeShip, newGame, type SimEvent } from '../sim';
import { shipIdOf, shipIds } from '../sim/regions';
import { createFightReporter, fightLine } from './fightReport';

describe('fight report', () => {
  it('collects a fight from its events and reports it when combat ends', () => {
    const sim = newGame(3, content);
    const ship = homeShip(sim);
    const reporter = createFightReporter(sim);
    const mods = sim.world.query(ModuleC).filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === ship);
    const crew = sim.world.query(CrewC)[0] as number;
    const lost = mods[0] as number;
    const hit = mods[1] as number;
    expect(reporter.onEvents([{ type: 'combat.started' }])).toBeNull();
    const events: SimEvent[] = [
      { type: 'module.destroyed', moduleId: lost, def: sim.world.get(lost, ModuleC)!.def, ship },
      { type: 'projectile.hit', projectile: 1, weapon: 'weapon.burstLaser', ship, x: 0, y: 0, moduleId: hit },
      { type: 'crew.downed', crew },
      { type: 'ship.fled', ship: 999 },
    ];
    expect(reporter.onEvents(events)).toBeNull();
    const done = reporter.onEvents([{ type: 'combat.ended' }]);
    expect(done?.report).toMatchObject({ outcome: 'fled', lost: [{}], down: [{ name: sim.world.get(crew, CrewC)!.name }] });
    expect(done?.summary.text).toBe('Fight over: 1 module lost, 1 crew down');
  });

  it('keeps damaged modules a jump away lifted out of the world', () => {
    const sim = newGame(3, content);
    const ship = homeShip(sim);
    const reporter = createFightReporter(sim);
    const hit = sim.world.query(ModuleC).find((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === ship) as number;
    const name = sim.content.modules[sim.world.get(hit, ModuleC)!.def]?.name;
    reporter.onEvents([{ type: 'combat.started' }, { type: 'projectile.hit', projectile: 1, weapon: 'weapon.burstLaser', ship, x: 0, y: 0, moduleId: hit }]);
    sim.world.remove(hit, ModuleC); // what liftShip does to the fleeing ship's modules before `combat.ended`
    const done = reporter.onEvents([{ type: 'ship.fled', ship }, { type: 'combat.ended' }]);
    expect(done?.report.damaged).toMatchObject([{ name }]);
    expect(done?.summary.text).toBe('Fight over: 1 module damaged');
  });

  it('tracks a fight already under way when the reporter starts (a save loaded mid-fight)', () => {
    const sim = newGame(3, content);
    const ship = homeShip(sim);
    sim.sector.inCombat = true;
    const reporter = createFightReporter(sim);
    const lost = sim.world.query(ModuleC).find((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === ship) as number;
    reporter.onEvents([{ type: 'module.destroyed', moduleId: lost, def: sim.world.get(lost, ModuleC)!.def, ship }]);
    expect(reporter.onEvents([{ type: 'combat.ended' }])?.summary.text).toBe('Fight over: 1 module lost');
  });

  it('takes the enemy from ships still in the fight, not an earlier wreck', () => {
    const sim = newGame(3, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    sim.step();
    const wreck = shipIds(sim)[1] as number;
    Object.assign(sim.world.get(wreck, ShipC)!, { state: 'wreck', integrity: 0.1 });
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 140, y: 50 });
    sim.step();
    const reporter = createFightReporter(sim);
    reporter.onEvents([{ type: 'combat.started' }]);
    const done = reporter.onEvents([{ type: 'crew.died', crew: 999 }, { type: 'combat.ended' }]);
    expect(done?.report.enemyHull).toBe(1);
  });

  it('reads the final hull from the jump packet when the ship has left', () => {
    const sim = newGame(3, content);
    const ship = homeShip(sim);
    const reporter = createFightReporter(sim);
    reporter.onEvents([{ type: 'combat.started' }]);
    // Hull lost with no event after it (fire), then a jump away lifts the ship before `combat.ended`.
    const lifted = { ...sim.world.get(ship, ShipC)!, integrity: 0.6 };
    sim.world.remove(ship, ShipC);
    sim.sector.state = 'hyperspace';
    sim.sector.packet = { ship, w: 1, h: 1, tiles: {}, entities: [{ id: ship, c: { [ShipC.name]: lifted } }] };
    const done = reporter.onEvents([{ type: 'combat.ended' }]);
    expect(done?.report).toMatchObject({ outcome: 'youFled', hullAfter: 0.6 });
    expect(done?.summary.text).toBe('Fight over: hull −40%');
  });

  it('counts a module the prize lost before its capture as an enemy loss', () => {
    const sim = newGame(3, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    sim.step();
    const prize = shipIds(sim)[1] as number;
    const reporter = createFightReporter(sim);
    reporter.onEvents([{ type: 'combat.started' }]);
    // The capture lands in the same frame as the destruction, so by the time the events are read the prize is already the player's.
    sim.world.get(prize, ShipC)!.faction = 'player';
    const mod = sim.world.query(ModuleC).find((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === prize) as number;
    const done = reporter.onEvents([{ type: 'module.destroyed', moduleId: mod, def: sim.world.get(mod, ModuleC)!.def, ship: prize }, { type: 'ship.captured', ship: prize, by: 'player', from: 'hostile' }, { type: 'combat.ended' }]);
    expect(done?.report).toMatchObject({ outcome: 'captured', lost: [], enemyLost: [{}] });
  });

  it('keeps a crew death on the player side when a jump detaches the crew before the events are read', () => {
    const sim = newGame(3, content);
    const reporter = createFightReporter(sim);
    reporter.onEvents([{ type: 'combat.started' }]);
    const crew = sim.world.query(CrewC)[0] as number;
    const name = sim.world.get(crew, CrewC)!.name;
    sim.world.detach(crew); // what the jump does to the ship's occupants before this frame's events are drained
    const done = reporter.onEvents([{ type: 'crew.died', crew }, { type: 'combat.ended' }]);
    expect(done?.report).toMatchObject({ dead: [{ name }], enemyCrew: 0 });
  });

  it('reads the enemy hull as the fight ends, not as of the previous frame', () => {
    const sim = newGame(3, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    sim.step();
    const enemy = shipIds(sim)[1] as number;
    const reporter = createFightReporter(sim);
    reporter.onEvents([{ type: 'combat.started' }]);
    sim.world.get(enemy, ShipC)!.integrity = 0.4;
    const mod = sim.world.query(ModuleC).find((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === enemy) as number;
    const done = reporter.onEvents([
      { type: 'module.destroyed', moduleId: mod, def: sim.world.get(mod, ModuleC)!.def, ship: enemy },
      { type: 'ship.fled', ship: enemy },
      { type: 'combat.ended' },
    ]);
    expect(done?.report).toMatchObject({ outcome: 'fled', enemyHull: 0.4 });
  });

  it('counts a shot fired in the frame of a jump away', () => {
    const sim = newGame(3, content);
    const ship = homeShip(sim);
    const reporter = createFightReporter(sim);
    reporter.onEvents([{ type: 'combat.started' }]);
    sim.world.detach(ship); // the jump lifts the ship before this frame's events are drained
    const done = reporter.onEvents([{ type: 'weapon.fired', ship, weapon: 'weapon.missile', weaponId: 1, projectile: 1, targetShip: 0, targetModuleId: 0 }, { type: 'combat.ended' }]);
    expect(done?.report.ammo).toEqual([{ name: 'Missile', n: 1 }]);
  });

  it('names the captured ship, not the first enemy, when another one fled', () => {
    const sim = newGame(3, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    sim.step();
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 140, y: 50 });
    sim.step();
    const [, a, b] = shipIds(sim) as [number, number, number];
    sim.world.get(b, ShipC)!.name = 'Raider B';
    sim.world.get(b, ShipC)!.integrity = 0.3;
    const reporter = createFightReporter(sim);
    reporter.onEvents([{ type: 'combat.started' }]);
    const done = reporter.onEvents([{ type: 'ship.fled', ship: a }, { type: 'ship.captured', ship: b, by: 'player', from: 'hostile' }, { type: 'combat.ended' }]);
    expect(done?.report).toMatchObject({ outcome: 'captured', enemy: 'Raider B', prize: 'Raider B', enemyHull: 0.3 });
  });

  it('says nothing for a fight that cost nothing', () => {
    const sim = newGame(3, content);
    const reporter = createFightReporter(sim);
    reporter.onEvents([{ type: 'combat.started' }]);
    expect(reporter.onEvents([{ type: 'combat.ended' }])).toBeNull();
  });

  it('words losses and kills in one line', () => {
    const l = (n: number) => Array.from({ length: n }, () => ({ name: 'x', subject: null }));
    const r = { outcome: 'destroyed' as const, enemy: 'R', seconds: 5, hullBefore: 1, hullAfter: 0.5, enemyHull: 0, enemyCrew: 0, lost: l(4), damaged: [], down: l(2), dead: [], enemyLost: l(1), ammo: [], prize: null };
    expect(fightLine(r)?.text).toBe('Fight over: 4 modules lost, 2 crew down, 1 enemy module destroyed');
  });

  it('still reports a fight whose only costs were hull, damage, ammo or enemy crew', () => {
    const base = { outcome: 'fled' as const, enemy: 'R', seconds: 5, hullBefore: 1, hullAfter: 1, enemyHull: 0.8, enemyCrew: 0, lost: [], damaged: [], down: [], dead: [], enemyLost: [], ammo: [], prize: null };
    expect(fightLine({ ...base, hullAfter: 0.93, damaged: [{ name: 'Shield generator', subject: null }] })).toMatchObject({ tone: 'bad', text: 'Fight over: hull −7%, 1 module damaged' });
    expect(fightLine({ ...base, ammo: [{ name: 'Missile', n: 2 }] })?.text).toBe('Fight over: 2 missiles spent');
    expect(fightLine({ ...base, enemyCrew: 3 })).toMatchObject({ tone: 'good', text: 'Fight over: 3 enemy crew killed' });
    expect(fightLine(base)).toBeNull();
  });
});
