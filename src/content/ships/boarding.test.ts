import { describe, expect, it } from 'vitest';
import { AssignmentC, CrewC, DeadC, DownedC, DraftedC, EquipC, FighterC, HealthC, JobC, ModuleC, PositionC, SabotageOrderC, StunC, deserialize, serialize, type Sim } from '../../sim';
import { content } from '../index';
import { shipIdOf } from '../../sim/regions';
import { SABOTAGE_PER_SEC } from '../../sim/tuning';
import { TICK_HZ } from '../../sim/time';
import { crewOn, dockParty, raiderCrew, modulesOf, nth, of, run, setup, ship } from './boardingFixture';

const hpOf = (sim: Sim, id: number): number => sim.world.get(id, ModuleC)!.hp;
const sabotageJobs = (sim: Sim): number[] => sim.world.query(JobC).filter((j) => sim.world.get(j, JobC)!.kind === 'sabotage');
/** A raider module far from the bridge that a lone boarder can wreck (not the reactor: losing it wrecks the whole ship). */
const target = (sim: Sim): number => modulesOf(sim, 2, 'module.burstLaser')[0]!;
const reactor = (sim: Sim): number => modulesOf(sim, 2, 'module.reactor')[0]!;

describe('sabotage', () => {
  it('boarders walk to the module and wreck it through the weapon-hit path', () => {
    const sim = setup();
    const { party } = dockParty(sim);
    const laser = target(sim);
    const hp0 = hpOf(sim, laser);
    expect(hp0).toBeGreaterThan(0);
    sim.enqueue({ type: 'crew.sabotage', ids: party, module: laser });
    const out = run(sim, 2000, () => hpOf(sim, laser) <= 0);
    out.push(...run(sim, 5));
    expect(hpOf(sim, laser)).toBe(0);
    expect(sim.world.get(laser, ModuleC)!.wrecked).toBe(true);
    // the same event a weapon hit gives, once
    expect(of(out, 'module.destroyed')).toEqual([{ type: 'module.destroyed', moduleId: laser, def: 'module.burstLaser', ship: nth(sim, 2) }]);
    expect(of(out, 'crew.sabotageStarted').map((e) => e.crew).sort()).toEqual([...party].sort());
    const ended = of(out, 'crew.sabotageEnded');
    expect(ended.length).toBe(party.length);
    for (const e of ended) expect(e).toMatchObject({ module: laser, ship: nth(sim, 2), reason: 'destroyed' });
    expect(sabotageJobs(sim)).toEqual([]);
    for (const c of party) expect(sim.world.has(c, AssignmentC)).toBe(false);
  });

  it('melee and ranged boarders wreck at the same rate, and several add up', () => {
    const rate = (equip: string | null, n: number): number => {
      const sim = setup();
      const { party } = dockParty(sim, n);
      for (const c of party) sim.world.add(c, EquipC, { weapon: equip });
      const laser = target(sim);
      sim.enqueue({ type: 'crew.sabotage', ids: party, module: laser });
      // wait until they all stand at work, then measure over one second
      run(sim, 2000, () => party.every((c) => sim.world.get(c, CrewC)!.activity === 'working'));
      const before = hpOf(sim, laser);
      run(sim, TICK_HZ);
      return before - hpOf(sim, laser);
    };
    const bare = rate(null, 1);
    const rifle = rate('item.rifle', 1);
    expect(bare).toBeCloseTo(SABOTAGE_PER_SEC, 5);
    expect(rifle).toBeCloseTo(bare, 5);
    expect(rate(null, 2)).toBeCloseTo(2 * SABOTAGE_PER_SEC, 5);
  });

  it('is paused when attacked: the boarders defend themselves instead', () => {
    const sim = setup();
    const { party } = dockParty(sim, 1);
    const laser = reactor(sim);
    sim.enqueue({ type: 'crew.sabotage', ids: party, module: laser });
    run(sim, 2000, () => sim.world.get(party[0]!, CrewC)!.activity === 'working');
    sim.world.add(party[0]!, EquipC, { weapon: 'item.rifle' }); // armed, so it fights back
    sim.world.get(party[0]!, HealthC)!.max = sim.world.get(party[0]!, HealthC)!.hp = 100000; // outlasts the fight
    const at = sim.world.get(party[0]!, PositionC)!;
    const raider = raiderCrew(sim)[0]!; // a raider wakes up beside them
    sim.world.remove(raider, StunC);
    sim.world.add(raider, PositionC, { x: at.x, y: at.y - 1, toX: at.x, toY: at.y - 1, progress: 0, facing: 0 });
    const out = run(sim, 600, () => !sim.world.has(party[0]!, AssignmentC));
    out.push(...run(sim, 60));
    expect(of(out, 'crew.sabotagePaused')).toEqual([{ type: 'crew.sabotagePaused', crew: party[0], module: laser, ship: nth(sim, 2) }]);
    expect(of(out, 'crew.sabotageEnded')).toEqual([]);
    expect(of(out, 'crew.attacked').some((e) => e.crew === party[0])).toBe(true);
    expect(sabotageJobs(sim)).toEqual([]);
    expect(hpOf(sim, laser)).toBeGreaterThan(0);
  });

  it('pauses for a fight and resumes by itself once the attacker is dead, also across save and load', () => {
    const play = (reload: boolean): { events: string; hp: number; dead: boolean } => {
      let sim = setup();
      const { party } = dockParty(sim, 1);
      const boarder = party[0]!;
      const core = reactor(sim);
      sim.world.add(boarder, EquipC, { weapon: 'item.rifle' });
      sim.world.get(boarder, HealthC)!.max = sim.world.get(boarder, HealthC)!.hp = 100000;
      sim.enqueue({ type: 'crew.sabotage', ids: party, module: core });
      const events = run(sim, 2000, () => sim.world.get(boarder, CrewC)!.activity === 'working');
      const at = sim.world.get(boarder, PositionC)!;
      const raider = raiderCrew(sim)[0]!;
      sim.world.remove(raider, StunC);
      sim.world.add(raider, PositionC, { x: at.x, y: at.y - 1, toX: at.x, toY: at.y - 1, progress: 0, facing: 0 });
      events.push(...run(sim, 600, () => sim.world.has(boarder, SabotageOrderC) && !sim.world.has(boarder, AssignmentC)));
      events.push(...run(sim, 1));
      expect(of(events, 'crew.sabotagePaused')).toHaveLength(1);
      expect(of(events, 'crew.sabotageEnded')).toEqual([]);
      expect(sim.world.get(boarder, SabotageOrderC)?.module).toBe(core); // the order is kept while the job is gone
      expect(sabotageJobs(sim)).toEqual([]);
      run(sim, 20); // the fight goes on: still paused
      expect(sabotageJobs(sim)).toEqual([]);
      if (reload) sim = deserialize(serialize(sim), content);
      sim.world.get(raider, HealthC)!.hp = 0; // the attacker goes down
      events.push(...run(sim, 3000, () => hpOf(sim, core) <= 0));
      events.push(...run(sim, 5));
      expect(of(events, 'crew.sabotageResumed')).toHaveLength(1);
      expect(sim.world.has(boarder, SabotageOrderC)).toBe(false);
      return { events: events.filter((e) => e.type.startsWith('crew.sabotage')).map((e) => e.type).join(), hp: hpOf(sim, core), dead: sim.world.has(raider, DeadC) || sim.world.has(raider, DownedC) };
    };
    const base = play(false);
    expect(base).toMatchObject({ hp: 0, dead: true });
    expect(base.events).toBe('crew.sabotageStarted,crew.sabotagePaused,crew.sabotageResumed,crew.sabotageEnded');
    expect(play(true)).toEqual(base);
  });

  it('starts paused when ordered mid-fight: no sabotage while the boarder is engaged, then it resumes', () => {
    const sim = setup();
    const { party } = dockParty(sim, 1);
    const boarder = party[0]!;
    const core = reactor(sim);
    sim.world.add(boarder, EquipC, { weapon: 'item.rifle' });
    sim.world.get(boarder, HealthC)!.max = sim.world.get(boarder, HealthC)!.hp = 100000;
    const at = sim.world.get(boarder, PositionC)!;
    const raider = raiderCrew(sim)[0]!;
    sim.world.remove(raider, StunC);
    sim.world.add(raider, PositionC, { x: at.x, y: at.y - 1, toX: at.x, toY: at.y - 1, progress: 0, facing: 0 });
    run(sim, 600, () => sim.world.get(boarder, FighterC)?.mode === 'engage');
    expect(sim.world.get(boarder, FighterC)?.mode).toBe('engage');
    const hp = hpOf(sim, core);
    sim.enqueue({ type: 'crew.sabotage', ids: party, module: core });
    const out = run(sim, 20);
    expect(of(out, 'crew.sabotagePaused')).toHaveLength(1);
    expect(sabotageJobs(sim)).toEqual([]);
    expect(sim.world.get(boarder, SabotageOrderC)?.module).toBe(core);
    expect(hpOf(sim, core)).toBe(hp); // not wrecking while it fights
    sim.world.get(raider, HealthC)!.hp = 0;
    const after = run(sim, 3000, () => hpOf(sim, core) < hp);
    expect(of(after, 'crew.sabotageResumed')).toHaveLength(1);
    expect(hpOf(sim, core)).toBeLessThan(hp);
  });

  it('an explicit attack order ends the sabotage for good; automatic defence only pauses it', () => {
    const sim = setup();
    const { party } = dockParty(sim, 1);
    const boarder = party[0]!;
    const core = reactor(sim);
    sim.world.add(boarder, EquipC, { weapon: 'item.rifle' });
    sim.enqueue({ type: 'crew.sabotage', ids: party, module: core });
    run(sim, 2000, () => sim.world.get(boarder, CrewC)!.activity === 'working');
    const raider = raiderCrew(sim)[0]!;
    const at = sim.world.get(boarder, PositionC)!;
    sim.world.remove(raider, StunC);
    sim.world.add(raider, PositionC, { x: at.x, y: at.y - 1, toX: at.x, toY: at.y - 1, progress: 0, facing: 0 });
    sim.enqueue({ type: 'crew.attack', id: boarder, target: raider });
    const out = run(sim, 5);
    expect(of(out, 'crew.sabotageEnded')).toEqual([{ type: 'crew.sabotageEnded', crew: boarder, module: core, ship: nth(sim, 2), reason: 'interrupted' }]);
    expect(sim.world.has(boarder, SabotageOrderC)).toBe(false);
    sim.world.get(raider, HealthC)!.hp = 0; // the target is defeated
    const hp = hpOf(sim, core);
    const later = run(sim, 200);
    expect(of(later, 'crew.sabotageResumed')).toEqual([]);
    expect(sabotageJobs(sim)).toEqual([]);
    expect(hpOf(sim, core)).toBe(hp);
  });

  it('stops when the boarder goes down', () => {
    const sim = setup();
    const { party } = dockParty(sim, 1);
    const laser = target(sim);
    sim.enqueue({ type: 'crew.sabotage', ids: party, module: laser });
    run(sim, 2000, () => sim.world.get(party[0]!, CrewC)!.activity === 'working');
    sim.world.get(party[0]!, HealthC)!.hp = 0;
    const out = run(sim, 10);
    expect(sim.world.has(party[0]!, DownedC)).toBe(true);
    expect(of(out, 'crew.sabotageEnded').map((e) => e.reason)).toEqual(['downed']);
    const hp = hpOf(sim, laser);
    run(sim, 40);
    expect(hpOf(sim, laser)).toBe(hp);
    expect(sabotageJobs(sim)).toEqual([]);
  });

  it('is replaced by a new order, a draft release or a cancel', () => {
    const sim = setup();
    const { party } = dockParty(sim, 3);
    const laser = target(sim);
    sim.enqueue({ type: 'crew.sabotage', ids: party, module: laser });
    run(sim, 2000, () => party.every((c) => sim.world.get(c, CrewC)!.activity === 'working'));
    const at = sim.world.get(party[0]!, PositionC)!;
    sim.enqueue({ type: 'crew.moveTo', id: party[0]!, x: at.x - 1, y: at.y, ship: nth(sim, 2) }); // re-ordered
    sim.enqueue({ type: 'crew.draft', id: party[1]!, drafted: false }); // drafted off
    sim.enqueue({ type: 'crew.cancelSabotage', ids: [party[2]!] }); // cancelled
    const out = run(sim, 10);
    const why = Object.fromEntries(of(out, 'crew.sabotageEnded').map((e) => [e.crew, e.reason]));
    expect(why).toEqual({ [party[0]!]: 'interrupted', [party[1]!]: 'interrupted', [party[2]!]: 'cancelled' });
    expect(sabotageJobs(sim)).toEqual([]);
    expect(sim.world.has(party[2]!, DraftedC)).toBe(true); // a cancel leaves them standing by
    const hp = hpOf(sim, laser);
    run(sim, 40);
    expect(hpOf(sim, laser)).toBe(hp);
    sim.enqueue({ type: 'crew.cancelSabotage', ids: party });
    expect(of(run(sim, 2), 'command.rejected')).toEqual([{ type: 'command.rejected', command: 'crew.cancelSabotage', reason: 'noSabotage' }]);
  });

  it('rejects orders that make no sense and changes nothing', () => {
    const sim = setup();
    const { party } = dockParty(sim, 1);
    const laser = target(sim);
    const own = modulesOf(sim, 1, 'module.reactor')[0]!;
    const home = crewOn(sim, 1)[0]!;
    const rejects = (cmd: { ids: number[]; module: number }): string[] => {
      sim.enqueue({ type: 'crew.sabotage', ...cmd });
      return of(run(sim, 2), 'command.rejected').map((e) => e.reason);
    };
    expect(rejects({ ids: party, module: own })).toEqual(['notHostile']); // their own ship's module
    expect(rejects({ ids: [home], module: laser })).toEqual(['notAboard']); // not on that ship
    expect(rejects({ ids: [home], module: 999999 })).toEqual(['badTarget']);
    sim.world.get(laser, ModuleC)!.hp = 0;
    expect(rejects({ ids: party, module: laser })).toEqual(['badTarget']); // already destroyed
    expect(sabotageJobs(sim)).toEqual([]);
  });

  it('survives save and load in the middle, ending exactly as an uninterrupted run', () => {
    const play = (saveAt: 'walking' | 'working' | null): { tick: number; hp: number; events: string } => {
      let sim = setup();
      const { party } = dockParty(sim, 2);
      const laser = target(sim);
      sim.enqueue({ type: 'crew.sabotage', ids: party, module: laser });
      const events = run(sim, 3);
      const stage = saveAt === 'walking' ? () => true : () => party.some((c) => sim.world.get(c, CrewC)!.activity === 'working') && hpOf(sim, laser) < 70;
      if (saveAt) {
        events.push(...run(sim, 2000, stage));
        sim = deserialize(serialize(sim), content);
      }
      events.push(...run(sim, 2000, () => hpOf(sim, laser) <= 0));
      events.push(...run(sim, 5));
      return { tick: sim.tick, hp: hpOf(sim, laser), events: of(events, 'crew.sabotageEnded').map((e) => `${e.crew}:${e.reason}`).join() };
    };
    const base = play(null);
    expect(base.hp).toBe(0);
    expect(play('walking')).toEqual(base);
    expect(play('working')).toEqual(base);
  });
});
void [shipIdOf, ship];
