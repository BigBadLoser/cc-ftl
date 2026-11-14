import { describe, expect, it } from 'vitest';
import { CombatC, CrewC, DownedC, ModuleC, RecoveringC, PositionC, ShipC, SurrenderedC, WeaponC, deserialize, newGame, serialize, type Sim } from '../../sim';
import { wreckShip } from '../../sim/combat/wreck';
import { repKey } from '../../sim/galaxy/standing';
import { PrisonerC } from '../../sim/fight/components';
import { content } from '../index';
import { shipIdOf, shipIds } from '../../sim/regions';
import { killCrew } from '../../sim/crew/death';
import { AllegianceC } from '../../sim/fight/components';

const nth = (sim: Sim, n: number): number => shipIds(sim)[n - 1] as number;
const crewOf = (sim: Sim, shipId: number): number[] =>
  sim.world.query(CrewC, PositionC).filter((c) => shipIdOf(sim, sim.world.get(c, PositionC)!) === shipId && sim.world.get(c, AllegianceC)?.faction !== 'player');
function setup(template = 'ship.raider'): Sim {
  const sim = newGame(1, content);
  sim.enqueue({ type: 'debug.spawnEnemy', template, x: 20, y: 90 });
  sim.step();
  sim.events.drain();
  return sim;
}
const run = (sim: Sim, n: number): void => { for (let i = 0; i < n; i++) sim.step(); };

const settle = (sim: Sim, ship: number, choice: 'letGo' | 'takePrisoners'): void => { sim.enqueue({ type: 'ship.settle', ship, choice }); run(sim, 2); };

describe('the fight ends in the player\'s answer when the enemy crew is subdued or dead', () => {
  it('waits for the answer when the crew all surrendered or died, and letting them go leaves a derelict, the fight over', () => {
    const sim = setup();
    const enemy = nth(sim, 2);
    const crew = crewOf(sim, enemy);
    expect(crew.length).toBeGreaterThan(1);
    expect(sim.world.get(enemy, ShipC)!.state).toBe('active');
    run(sim, 30);
    expect(sim.sector.inCombat).toBe(true);
    crew.forEach((c, i) => (i % 2 ? sim.world.add(c, SurrenderedC, { tick: sim.tick }) : killCrew(sim, c)));
    run(sim, 30);
    expect(sim.world.get(enemy, ShipC)!.yielded).toBe(true);
    expect(sim.world.get(enemy, ShipC)!.state).not.toBe('wreck');
    expect(sim.sector.inCombat).toBe(true); // the fight holds until the answer
    const left = crew.filter((c) => sim.world.has(c, SurrenderedC));
    settle(sim, enemy, 'letGo');
    expect(sim.world.get(enemy, ShipC)!.state).toBe('wreck');
    expect(sim.world.get(enemy, ShipC)!.yielded).toBeUndefined();
    expect(sim.sector.inCombat).toBe(false);
    for (const c of left) expect(sim.world.has(c, CrewC)).toBe(false); // gone, not killed
  });

  it('taking prisoners makes the ship a prize and its subdued crew (downed too) prisoners', () => {
    const sim = setup();
    const enemy = nth(sim, 2);
    const crew = crewOf(sim, enemy);
    crew.forEach((c, i) => (i % 2 ? sim.world.add(c, SurrenderedC, { tick: sim.tick }) : sim.world.add(c, DownedC, { bleed: 99, stabilized: false, bed: 0 })));
    run(sim, 30);
    expect(sim.world.get(enemy, ShipC)!.yielded).toBe(true);
    settle(sim, enemy, 'takePrisoners');
    expect(sim.world.get(enemy, ShipC)!.state).toBe('prize');
    expect(sim.world.get(enemy, ShipC)!.faction).toBe('player');
    for (const c of crew) expect(sim.world.has(c, PrisonerC)).toBe(true);
  });

  it('releasing a prisoner removes them and raises their faction\'s standing; a crew member who is no prisoner is refused', () => {
    const sim = setup();
    const enemy = nth(sim, 2);
    const crew = crewOf(sim, enemy);
    sim.world.get(enemy, ShipC)!.gen = { faction: 'faction.raider', seed: 1, depth: 1 }; // a generated raider: the one galaxy faction that flies the raider kit
    for (const c of crew) sim.world.add(c, SurrenderedC, { tick: sim.tick });
    run(sim, 30);
    settle(sim, enemy, 'takePrisoners');
    const [first, second] = crew as [number, number];
    const before = { ...sim.story.reputation };
    sim.events.drain();
    sim.enqueue({ type: 'prisoner.release', crew: first });
    run(sim, 1);
    const ev = sim.events.drain().filter((e) => e.type === 'crew.released');
    expect(ev).toHaveLength(1);
    expect(sim.world.has(first, CrewC)).toBe(false);
    expect(sim.world.has(second, PrisonerC)).toBe(true);
    const faction = (ev[0] as { faction: string }).faction;
    expect(faction).not.toBe('');
    const key = repKey(sim, faction);
    expect(sim.story.reputation[key] ?? 0).toBeGreaterThan(before[key] ?? 0);
    const mine = sim.world.query(CrewC, PositionC).find((c) => sim.world.get(c, AllegianceC)?.faction === 'player')!;
    sim.enqueue({ type: 'prisoner.release', crew: mine });
    run(sim, 1);
    expect(sim.world.has(mine, CrewC)).toBe(true);
  });

  it('a yielded ship cannot charge or fire its weapons, and cannot jump away', () => {
    const sim = setup();
    const enemy = nth(sim, 2);
    const guns = sim.world.query(WeaponC).filter((w) => shipIdOf(sim, sim.world.get(w, ModuleC)!) === enemy);
    expect(guns.length).toBeGreaterThan(0);
    for (const c of crewOf(sim, enemy)) sim.world.add(c, SurrenderedC, { tick: sim.tick });
    run(sim, 30);
    expect(sim.world.get(enemy, ShipC)!.yielded).toBe(true);
    for (const g of guns) sim.world.get(g, WeaponC)!.charge = 0;
    sim.world.get(enemy, CombatC)!.ftl = 1e6;
    sim.events.drain();
    const fired: string[] = [];
    for (let i = 0; i < 200; i++) {
      sim.step();
      for (const e of sim.events.drain()) if (e.type === 'weapon.fired' || e.type === 'ship.fled') fired.push(e.type);
    }
    expect(fired).toEqual([]);
    for (const g of guns) expect(sim.world.get(g, WeaponC)!.charge).toBe(0);
    sim.enqueue({ type: 'combat.flee', ship: enemy });
    run(sim, 2);
    expect(sim.world.get(enemy, ShipC)!.state).toBe('active');
  });

  it('a yielded ship that is destroyed before the answer is no longer offered, and the answer is refused', () => {
    const sim = setup();
    const enemy = nth(sim, 2);
    for (const c of crewOf(sim, enemy)) sim.world.add(c, SurrenderedC, { tick: sim.tick });
    run(sim, 30);
    expect(sim.world.get(enemy, ShipC)!.yielded).toBe(true);
    wreckShip(sim, enemy);
    expect(sim.world.get(enemy, ShipC)!.yielded).toBeUndefined();
    sim.world.get(enemy, ShipC)!.yielded = true; // even a stale flag cannot turn a wreck back into a prize
    settle(sim, enemy, 'takePrisoners');
    expect(sim.world.get(enemy, ShipC)!.state).toBe('wreck');
    expect(sim.world.get(enemy, ShipC)!.faction).not.toBe('player');
  });

  it('releasing a prisoner who lies in a bed frees the bed', () => {
    const sim = setup();
    const enemy = nth(sim, 2);
    const crew = crewOf(sim, enemy);
    for (const c of crew) sim.world.add(c, SurrenderedC, { tick: sim.tick });
    run(sim, 30);
    settle(sim, enemy, 'takePrisoners');
    const [downed, resting] = crew as [number, number];
    const mods = sim.world.query(ModuleC).filter((m) => shipIdOf(sim, sim.world.get(m, ModuleC)!) === enemy);
    const [bedA, bedB] = mods as [number, number];
    sim.world.add(downed, DownedC, { bleed: 99, stabilized: true, bed: bedA });
    sim.world.get(bedA, ModuleC)!.reservedBy = downed;
    sim.world.add(resting, RecoveringC, { bed: bedB });
    sim.world.get(bedB, ModuleC)!.reservedBy = resting;
    sim.enqueue({ type: 'prisoner.release', crew: downed });
    sim.enqueue({ type: 'prisoner.release', crew: resting });
    run(sim, 2);
    expect(sim.world.has(downed, CrewC)).toBe(false);
    expect(sim.world.get(bedA, ModuleC)!.reservedBy).toBe(0);
    expect(sim.world.get(bedB, ModuleC)!.reservedBy).toBe(0);
  });

  it('rejects an answer for a ship nobody is waiting on', () => {
    const sim = setup();
    const enemy = nth(sim, 2);
    settle(sim, enemy, 'takePrisoners');
    expect(sim.world.get(enemy, ShipC)!.state).toBe('active');
    expect(sim.world.get(enemy, ShipC)!.faction).not.toBe('player');
  });

  it('survives a save and load while the answer waits', () => {
    const sim = setup();
    const enemy = nth(sim, 2);
    for (const c of crewOf(sim, enemy)) sim.world.add(c, SurrenderedC, { tick: sim.tick });
    run(sim, 30);
    const copy = deserialize(serialize(sim), content);
    expect(copy.world.get(enemy, ShipC)!.yielded).toBe(true);
    settle(copy, enemy, 'takePrisoners');
    expect(copy.world.get(enemy, ShipC)!.state).toBe('prize');
  });

  it('keeps fighting while one enemy crew member is still able', () => {
    const sim = setup();
    const enemy = nth(sim, 2);
    const [, ...rest] = crewOf(sim, enemy);
    for (const c of rest) sim.world.add(c, SurrenderedC, { tick: sim.tick });
    run(sim, 60);
    expect(sim.world.get(enemy, ShipC)!.state).not.toBe('wreck');
  });

  it('leaves a ship that never had crew alone', () => {
    const sim = newGame(1, { ...content, ships: { ...content.ships, 'ship.empty': { ...content.ships['ship.raider'], crew: [] } } });
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.empty', x: 20, y: 90 });
    run(sim, 60);
    expect(sim.world.get(nth(sim, 2), ShipC)!.state).not.toBe('wreck');
  });

  it('leaves the capture to the boarders while player crew stand aboard', () => {
    const sim = setup();
    const enemy = nth(sim, 2);
    const ship = sim.world.get(enemy, ShipC)!;
    const mine = sim.world.query(CrewC, PositionC).find((c) => sim.world.get(c, AllegianceC)?.faction === 'player')!;
    const pos = sim.world.get(mine, PositionC)!;
    const keep = { x: pos.x, y: pos.y };
    for (const c of crewOf(sim, enemy)) sim.world.add(c, SurrenderedC, { tick: sim.tick });
    Object.assign(pos, { x: ship.x + 2, y: ship.y + 2 });
    run(sim, 30);
    expect(sim.world.get(enemy, ShipC)!.state).not.toBe('wreck');
    Object.assign(pos, keep);
    run(sim, 30);
    expect(sim.world.get(enemy, ShipC)!.yielded).toBe(true);
  });
});
