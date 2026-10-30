import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { CrewC, ModuleC, homeShip, newGame, type SimEvent } from '../sim';
import { shipIdOf } from '../sim/regions';
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
