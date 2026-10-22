import { describe, expect, it } from 'vitest';
import { content } from '../index';
import {
  AsteroidC, JobC, LEVEL_TICKS, ShipC, Sim, Struct, deserialize, generateOutpost, placementError, serialize, shipGrid, spawnCrew, stampShip,
  totalStock, validateOutpost, writeStruct, type OreDef,
} from '../../sim';

const ORES = Object.values(content.ores) as OreDef[];

describe('outposts', () => {
  for (const style of ['surface', 'dug'] as const) {
    it(`${style}: deterministic and valid`, () => {
      for (let seed = 1; seed <= 4; seed++) {
        const a = generateOutpost(style, seed, ORES)!;
        expect(a, `seed ${seed}`).not.toBeNull();
        const b = generateOutpost(style, seed, ORES)!;
        expect(b.template).toEqual(a.template);
        expect(Array.from(b.asteroid.struct)).toEqual(Array.from(a.asteroid.struct));
        expect(validateOutpost(a, content.modules), `${style} #${seed}\n${a.template.rows.join('\n')}`).toEqual([]);
      }
    });
  }
});

function run(sim: Sim, n: number): string[] {
  const log: string[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain()) log.push(e.type === 'command.rejected' ? `rejected:${e.command}:${e.reason}` : e.type);
  }
  return log;
}

/** A sector with one outpost; returns the sim and its base region. */
function outpost(style: 'surface' | 'dug', seed = 1): { sim: Sim; ship: number; asteroid: number } {
  const sim = new Sim(seed, content);
  sim.enqueue({ type: 'debug.spawnOutpost', style, seed });
  sim.step();
  const ship = [...sim.world.query(ShipC)][0]!;
  const asteroid = [...sim.world.query(AsteroidC)][0]!;
  return { sim, ship, asteroid };
}

function floorO2(sim: Sim, ship: number): { min: number; mean: number } {
  const g = shipGrid(sim, ship)!;
  let min = Infinity, sum = 0, n = 0;
  for (let y = g.y0; y < g.y0 + g.height; y++) {
    for (let x = g.x0; x < g.x0 + g.width; x++) {
      if (g.get('struct', x, y) !== Struct.Floor) continue;
      const o = g.get('o2', x, y);
      min = Math.min(min, o);
      sum += o;
      n++;
    }
  }
  return { min, mean: sum / n };
}

describe('outposts in the sector', () => {
  it('a dug base is airtight: rock mass walls hold its air', () => {
    const { sim, ship } = outpost('dug');
    run(sim, 30 * 20);
    const o2 = floorO2(sim, ship);
    expect(o2.min).toBeGreaterThan(17);
    expect(o2.mean).toBeGreaterThan(19);
    expect(run(sim, 20)).not.toContain('hull.breach');
  });

  it('a surface base holds air in its habitats and tubes; the ground around stays vacuum', () => {
    const { sim, ship } = outpost('surface');
    run(sim, 30 * 20);
    expect(floorO2(sim, ship).min).toBeGreaterThan(17);
    const g = shipGrid(sim, ship)!;
    for (let y = g.y0; y < g.y0 + g.height; y++) for (let x = g.x0; x < g.x0 + g.width; x++) if (g.get('struct', x, y) === Struct.Ground) expect(g.get('o2', x, y)).toBe(0);
  });

  it('survives a save and load round trip and plays on identically', () => {
    const { sim } = outpost('dug', 2);
    run(sim, 40);
    const b = deserialize(serialize(sim), content);
    expect(serialize(b)).toBe(serialize(sim));
    expect(run(b, 200)).toEqual(run(sim, 200));
    expect(serialize(b)).toBe(serialize(sim));
  });
});

/**
 * A player fixture at (0, 0): a walled 14x10 room (x 0..13) and an open strip outside its east wall (x 14..16) that tests turn
 * into rock ground and rock mass.
 */
function slab(): { sim: Sim; ship: number } {
  const sim = new Sim(3, content);
  const rows = Array.from({ length: 10 }, (_, y) => (y === 0 || y === 9 ? '#'.repeat(14) : `#${'_'.repeat(12)}#`) + '___');
  const ship = stampShip(sim, { name: 'slab', rows }, { faction: 'player', state: 'active', x: 0, y: 0 });
  return { sim, ship };
}

describe('digging, levelling and building on rock', () => {
  it('a dig turns rock mass into floor and drops its vein ore; the outer layer cannot be dug; levelling makes ground', () => {
    const { sim, ship } = slab();
    const g = shipGrid(sim, ship)!;
    // rock mass inside the room (x 9..12, against the east wall) and outside it, on ground (x 14..16)
    for (let y = 1; y < 9; y++) for (let x = 9; x <= 12; x++) writeStruct(g, x, y, Struct.Rock);
    for (let y = 0; y < 10; y++) for (let x = 14; x <= 16; x++) writeStruct(g, x, y, Struct.Ground);
    writeStruct(g, 15, 4, Struct.Rock); // touches ground
    writeStruct(g, 16, 6, Struct.Rock); // at the ship's edge
    g.set('ore', 9, 4, 1);
    g.set('oreAmt', 9, 4, 30);
    spawnCrew(sim, ship, ['role.engineer']);
    sim.enqueue({ type: 'job.build', ship, x: 15, y: 4, struct: Struct.Floor });
    sim.enqueue({ type: 'job.build', ship, x: 16, y: 6, struct: Struct.Floor });
    sim.enqueue({ type: 'job.build', ship, x: 10, y: 4, struct: Struct.Wall });
    sim.enqueue({ type: 'job.build', ship, x: 2, y: 2, struct: Struct.Ground });
    expect(run(sim, 1)).toEqual(['rejected:job.build:outerLayer', 'rejected:job.build:outerLayer', 'rejected:job.build:rockMass', 'rejected:job.build:notRock']);
    const before = totalStock(sim, 'item.iron_ore');
    sim.enqueue({ type: 'job.build', ship, x: 9, y: 4, struct: Struct.Floor });
    sim.enqueue({ type: 'job.build', ship, x: 9, y: 6, struct: Struct.Ground });
    const log = run(sim, 60 * 20);
    expect(log).toContain('rock.dug');
    expect(g.get('struct', 9, 4)).toBe(Struct.Floor);
    expect(g.get('ore', 9, 4)).toBe(0);
    expect(g.get('ship', 9, 4)).toBe(ship);
    expect(g.get('struct', 9, 6)).toBe(Struct.Ground);
    expect(totalStock(sim, 'item.iron_ore') - before).toBe(30);
  });

  it('a module footprint may clip up to a quarter rock mass (auto-levelled by its job), not more', () => {
    const { sim, ship } = slab();
    const g = shipGrid(sim, ship)!;
    for (let y = 1; y < 9; y++) for (let x = 1; x < 13; x++) writeStruct(g, x, y, Struct.Ground);
    writeStruct(g, 2, 2, Struct.Rock);
    writeStruct(g, 3, 2, Struct.Rock);
    expect(placementError(sim, ship, 'module.pod_bay', 2, 2, 0)).toBeNull(); // 2 of 9 tiles
    writeStruct(g, 4, 2, Struct.Rock);
    expect(placementError(sim, ship, 'module.pod_bay', 2, 2, 0)).toBe('rockMass'); // 3 of 9
    writeStruct(g, 4, 2, Struct.Ground);
    expect(placementError(sim, ship, 'module.storage', 8, 7, 0)).toBeNull(); // plain ground is a foundation
    spawnCrew(sim, ship, ['role.engineer']);
    run(sim, 1);
    sim.enqueue({ type: 'job.buildModule', ship, def: 'module.pod_bay', x: 2, y: 2, rot: 0 });
    run(sim, 1);
    const job = [...sim.world.query(JobC)].map((j) => sim.world.get(j, JobC)!).find((j) => j.kind === 'module')!;
    expect(job.work).toBe(content.modules['module.pod_bay'].buildWork + 2 * (LEVEL_TICKS / 2));
  });
});
