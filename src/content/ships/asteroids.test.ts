import { describe, expect, it } from 'vitest';
import {
  AsteroidC, ShipC, asteroidAt, deserialize, galaxyIndex, generateAsteroid, homeShip, isAsteroidRock, newGame, ownerAt,
  serialize, shipAt, shipIdAt, type OreDef, type Sim,
} from '../../sim';
import { content } from '../index';

const ORES = Object.values(content.ores) as OreDef[];

function run(sim: Sim, n: number): string[] {
  const log: string[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain()) log.push(e.type === 'command.rejected' ? `${e.type}:${e.command}:${e.reason}` : e.type);
  }
  return log;
}

const asteroids = (sim: Sim): number[] => [...sim.world.query(AsteroidC)].sort((a, b) => a - b);

/** Every rock tile's (struct, ore, oreAmt, owner) over an asteroid's bbox, as a string. */
function rockTiles(sim: Sim, id: number): string {
  const a = sim.world.get(id, AsteroidC)!;
  const g = sim.sector.grid;
  const out: number[] = [];
  for (let y = a.y; y < a.y + a.height; y++) {
    for (let x = a.x; x < a.x + a.width; x++) out.push(g.get('struct', x, y), g.get('ore', x, y), g.get('oreAmt', x, y), g.get('ship', x, y));
  }
  return out.join(',');
}

describe('asteroids in the sector', () => {
  it('debug.spawnAsteroid stamps the plan: rock owned by the asteroid, ore as generated, not a ship', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnAsteroid', kind: 'big', seed: 4, coverage: 'mixed' });
    expect(run(sim, 1)).toContain('asteroid.spawned');
    const [id] = asteroids(sim);
    const a = sim.world.get(id!, AsteroidC)!;
    expect(sim.world.has(id!, ShipC)).toBe(false);
    const plan = generateAsteroid('big', 4, ORES, { coverage: 'mixed' });
    expect([a.width, a.height, a.coverage]).toEqual([plan.w, plan.h, 'mixed']);
    let rock = 0;
    for (let y = 0; y < plan.h; y++) {
      for (let x = 0; x < plan.w; x++) {
        const i = y * plan.w + x;
        const sx = a.x + x, sy = a.y + y;
        expect(sim.sector.grid.get('struct', sx, sy)).toBe(plan.struct[i]);
        expect(sim.sector.grid.get('ore', sx, sy)).toBe(plan.ore[i]);
        if (!isAsteroidRock(plan.struct[i]!)) continue;
        rock++;
        expect(ownerAt(sim, sx, sy)).toBe(id);
        expect(asteroidAt(sim, sx, sy)).toBe(id);
        expect(shipAt(sim, sx, sy)).toBe(0);
        expect(shipIdAt(sim, sx, sy)).toBe(0);
      }
    }
    expect(rock).toBeGreaterThan(500);
  });

  it('keeps the gap rule both ways: no asteroid on a ship, no ship on an asteroid', () => {
    const sim = newGame(1, content);
    const s = sim.world.get(homeShip(sim), ShipC)!;
    sim.enqueue({ type: 'debug.spawnAsteroid', kind: 'big', seed: 4, x: s.x, y: s.y });
    expect(run(sim, 1)).toContain('command.rejected:debug.spawnAsteroid:overlap');
    sim.enqueue({ type: 'debug.spawnAsteroid', kind: 'field', seed: 2 });
    run(sim, 1);
    const [id] = asteroids(sim);
    const part = sim.world.get(id!, AsteroidC)!.parts[0]!;
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: part.x, y: part.y });
    expect(run(sim, 1)).toContain('command.rejected:debug.spawnEnemy:overlap');
    sim.enqueue({ type: 'debug.spawnAsteroid', kind: 'field', seed: 2, x: sim.world.get(id!, AsteroidC)!.x, y: sim.world.get(id!, AsteroidC)!.y });
    expect(run(sim, 1)).toContain('command.rejected:debug.spawnAsteroid:overlap');
  });

  it('survives a save and load round trip, and the sim plays on identically', () => {
    const a = newGame(2, content);
    a.enqueue({ type: 'debug.spawnAsteroid', kind: 'field', seed: 9 });
    run(a, 20);
    const b = deserialize(serialize(a), content);
    expect(serialize(b)).toBe(serialize(a));
    const [id] = asteroids(b);
    expect(rockTiles(b, id!)).toBe(rockTiles(a, id!));
    expect(run(b, 100)).toEqual(run(a, 100));
    expect(serialize(b)).toBe(serialize(a));
  });

  it('stays in its node when the player jumps away, and comes back whole on return', () => {
    const sim = newGame(3, content);
    sim.enqueue({ type: 'debug.spawnAsteroid', kind: 'big', seed: 5 });
    run(sim, 1);
    const [id] = asteroids(sim);
    const before = { c: JSON.stringify(sim.world.get(id!, AsteroidC)), tiles: rockTiles(sim, id!) };
    const ship = homeShip(sim);
    const s = sim.world.get(ship, ShipC)!;
    const home = { x: s.x, y: s.y };
    const start = sim.sector.node;
    const away = (galaxyIndex(sim.galaxy).adjacent.get(start) ?? []).map((e) => (e.a === start ? e.b : e.a)).sort()[0]!;
    sim.enqueue({ type: 'debug.galaxyTeleport', node: away });
    run(sim, 1);
    expect(asteroids(sim)).toEqual([]);
    expect(sim.archives.find((x) => x.node === start)?.entities.some((e) => e.id === id)).toBe(true);
    // a generated ship may lie on the home spot in the away node: deploy at the first clear one
    for (let i = 0; i < 80; i++) {
      sim.enqueue({ type: 'sector.deploy', x: home.x + ((i % 8) - 3) * 40, y: home.y + (Math.floor(i / 8) - 4) * 40 });
      sim.step();
      if (!sim.events.drain().some((e) => e.type === 'command.rejected')) break;
    }
    sim.enqueue({ type: 'debug.galaxyTeleport', node: start });
    run(sim, 1);
    expect(asteroids(sim)).toEqual([id]);
    expect(JSON.stringify(sim.world.get(id!, AsteroidC))).toBe(before.c);
    expect(rockTiles(sim, id!)).toBe(before.tiles);
    // the asteroid blocks deploying onto it
    const a = sim.world.get(id!, AsteroidC)!;
    sim.enqueue({ type: 'sector.deploy', x: a.x, y: a.y });
    expect(run(sim, 1).some((e) => e === 'command.rejected:sector.deploy:overlap' || e === 'command.rejected:sector.deploy:outOfBounds')).toBe(true);
    sim.enqueue({ type: 'sector.deploy', ...home });
    expect(run(sim, 1)).toContain('sector.deployed');
  });
});
