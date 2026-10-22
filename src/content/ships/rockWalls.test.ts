import { describe, expect, it } from 'vitest';
import { content } from '../index';
import { gasConductance, isWalkable } from '../../sim/structure';
import {
  AsteroidC, FINISH_TICKS, JobC, ShipC, Sim, Struct, TICK_HZ, homeShip, newGame, shipGrid, spawnCrew, stampShip,
  writeStruct,
} from '../../sim';

function run(sim: Sim, n: number): string[] {
  const log: string[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain()) log.push(e.type === 'command.rejected' ? `rejected:${e.command}:${e.reason}` : e.type);
  }
  return log;
}

/** A player room (x 0..13, y 0..9) with empty space east of it (x 14..16) that tests turn into rock ground. */
function slab(): { sim: Sim; ship: number } {
  const sim = new Sim(3, content);
  const rows = Array.from({ length: 10 }, (_, y) => (y === 0 || y === 9 ? '#'.repeat(14) : `#${'_'.repeat(12)}#`) + '...');
  const ship = stampShip(sim, { name: 'slab', rows }, { faction: 'player', state: 'active', x: 0, y: 0 });
  return { sim, ship };
}

describe('finishing rock into a rock wall', () => {
  it('is free, takes about 8 s, needs a floor beside, and is allowed on the outer layer', () => {
    const { sim, ship } = slab();
    const g = shipGrid(sim, ship)!;
    for (let y = 1; y < 9; y++) for (let x = 9; x <= 12; x++) writeStruct(g, x, y, Struct.Rock);
    for (let y = 0; y < 10; y++) for (let x = 14; x <= 16; x++) writeStruct(g, x, y, Struct.Ground);
    for (let x = 9; x <= 12; x++) writeStruct(g, x, 5, Struct.Floor); // a corridor to the east wall
    writeStruct(g, 13, 5, Struct.Rock); // the hull wall tile as rock: outer layer (ground east of it), beside the floor at 12,5
    writeStruct(g, 15, 7, Struct.Rock); // outer layer, no floor beside
    spawnCrew(sim, ship, ['role.engineer']);
    sim.enqueue({ type: 'job.build', ship, x: 11, y: 2, struct: Struct.RockWall }); // inner rock, no floor beside
    sim.enqueue({ type: 'job.build', ship, x: 15, y: 7, struct: Struct.RockWall });
    sim.enqueue({ type: 'job.build', ship, x: 3, y: 3, struct: Struct.RockWall }); // a floor, not rock
    expect(run(sim, 1).filter((e) => e.startsWith('rejected'))).toEqual(['rejected:job.build:noFloorBeside', 'rejected:job.build:noFloorBeside', 'rejected:job.build:notRock']);
    sim.enqueue({ type: 'job.build', ship, x: 9, y: 4, struct: Struct.RockWall });
    sim.enqueue({ type: 'job.build', ship, x: 13, y: 5, struct: Struct.RockWall });
    run(sim, 1);
    const jobs = [...sim.world.query(JobC)].map((j) => sim.world.get(j, JobC)!);
    expect(jobs).toHaveLength(2);
    for (const j of jobs) {
      expect(j.work).toBe(FINISH_TICKS);
      expect(j.needs ?? []).toEqual([]); // free
    }
    expect(FINISH_TICKS).toBe(8 * TICK_HZ);
    run(sim, 80 * TICK_HZ);
    expect(g.get('struct', 9, 4)).toBe(Struct.RockWall);
    expect(g.get('struct', 13, 5)).toBe(Struct.RockWall);
    expect(g.get('struct', 15, 7)).toBe(Struct.Rock);
  });

  it('is airtight and unwalkable', () => {
    const { sim, ship } = slab();
    const g = shipGrid(sim, ship)!;
    expect(gasConductance(Struct.RockWall, 255)).toBe(0);
    expect(isWalkable(Struct.RockWall)).toBe(false);
    // a rock partition across the room at x 7: air on the west side stays, the vacuum on the east side stays
    for (let y = 1; y < 9; y++) writeStruct(g, 7, y, Struct.RockWall);
    for (let y = 1; y < 9; y++) for (let x = 8; x < 17; x++) { g.set('o2', x, y, 0); g.set('co2', x, y, 0); }
    run(sim, 600);
    expect(g.get('o2', 6, 4)).toBeGreaterThan(20);
    expect(g.get('o2', 9, 4)).toBeLessThan(1);
  });

  it('takes a door, digs out to floor, and cannot be deconstructed', () => {
    const { sim, ship } = slab();
    const g = shipGrid(sim, ship)!;
    for (let y = 1; y < 9; y++) writeStruct(g, 7, y, Struct.RockWall);
    spawnCrew(sim, ship, ['role.engineer']);
    sim.enqueue({ type: 'job.build', ship, x: 7, y: 4, struct: Struct.Door });
    sim.enqueue({ type: 'job.build', ship, x: 7, y: 2, struct: Struct.Wall });
    sim.enqueue({ type: 'job.deconstruct', ship, x: 7, y: 6 });
    expect(run(sim, 1).filter((e) => e.startsWith('rejected'))).toEqual(['rejected:job.build:rockMass', 'rejected:job.deconstruct:nothingToDeconstruct']);
    // the door order is accepted (a door job sits on the rock wall tile, as on a metal wall; it waits for materials here)
    expect([...sim.world.query(JobC)].map((j) => sim.world.get(j, JobC)!)).toMatchObject([{ x: 7, y: 4, struct: Struct.Door }]);
    sim.enqueue({ type: 'job.cancel', ship, x: 7, y: 4 });
    run(sim, 1);
    sim.enqueue({ type: 'job.build', ship, x: 7, y: 6, struct: Struct.Floor });
    run(sim, 1);
    expect([...sim.world.query(JobC)].map((j) => sim.world.get(j, JobC)!.work)).toEqual([15 * TICK_HZ]);
    run(sim, 60 * TICK_HZ);
    expect(g.get('struct', 7, 6)).toBe(Struct.Floor);
  });

  it('works on a claimed asteroid base', () => {
    const sim = newGame(3, content);
    sim.enqueue({ type: 'debug.spawnAsteroid', kind: 'big', seed: 4, coverage: 'mixed', x: 62, y: 40 });
    sim.step();
    const asteroid = [...sim.world.query(AsteroidC)][0]!;
    const a = sim.world.get(asteroid, AsteroidC)!;
    sim.enqueue({ type: 'asteroid.claim', asteroid, x: a.x, y: a.y + Math.floor((a.height - 10) / 2), w: 12, h: 10 });
    run(sim, 1);
    const base = [...sim.world.query(ShipC)].find((id) => sim.world.get(id, ShipC)?.base)!;
    const g = shipGrid(sim, base)!;
    const cx = g.x0 + 5, cy = g.y0 + 5;
    writeStruct(g, cx, cy, Struct.Floor);
    writeStruct(g, cx + 1, cy, Struct.Rock);
    g.set('ship', cx, cy, base);
    expect(homeShip(sim)).not.toBe(base);
    sim.enqueue({ type: 'job.build', ship: base, x: cx + 1, y: cy, struct: Struct.RockWall });
    expect(run(sim, 1)).not.toContain('rejected:job.build:noFloorBeside');
    const job = [...sim.world.query(JobC)].map((j) => sim.world.get(j, JobC)!)[0]!;
    expect(job).toMatchObject({ struct: Struct.RockWall, work: FINISH_TICKS });
  });
});

describe('outpost walls', () => {
  function walls(sim: Sim, ship: number): { rock: number; metal: number } {
    const g = shipGrid(sim, ship)!;
    let rock = 0, metal = 0;
    for (let y = g.y0; y < g.y0 + g.height; y++) {
      for (let x = g.x0; x < g.x0 + g.width; x++) {
        const k = g.get('struct', x, y);
        if (k === Struct.RockWall) rock++;
        if (k === Struct.Wall) metal++;
      }
    }
    return { rock, metal };
  }

  for (const seed of [1, 2, 3]) {
    it(`a dug base (seed ${seed}) has only rock walls; a surface one keeps metal walls`, () => {
      const dug = new Sim(seed, content);
      dug.enqueue({ type: 'debug.spawnOutpost', style: 'dug', seed });
      dug.step();
      const dw = walls(dug, [...dug.world.query(ShipC)][0]!);
      expect(dw.rock).toBeGreaterThan(20);
      expect(dw.metal).toBe(0);
      const surf = new Sim(seed, content);
      surf.enqueue({ type: 'debug.spawnOutpost', style: 'surface', seed });
      surf.step();
      const sw = walls(surf, [...surf.world.query(ShipC)][0]!);
      expect(sw.metal).toBeGreaterThan(20);
      expect(sw.rock).toBe(0);
    });
  }
});
