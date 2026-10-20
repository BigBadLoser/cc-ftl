import { describe, expect, it } from 'vitest';
import { CrewC, ModuleC, PLAYER_START, Struct, deserialize, newGame, serialize, type Sim } from '../../sim';
import { content } from '../index';

/** Sector tile of a starter-ship tile (the player ship is stamped at PLAYER_START). */
const at = (x: number, y: number) => ({ x: PLAYER_START.x + x, y: PLAYER_START.y + y });
const run = (sim: Sim, n: number) => { for (let i = 0; i < n; i++) sim.step(); };
const ROOM_TILES = (sim: Sim, room: number): number[] => {
  const g = sim.grids.get(1)!;
  const out: number[] = [];
  g.raw('room').forEach((r, i) => { if (r === room) out.push(i); });
  return out;
};
const meanO2 = (sim: Sim, tiles: number[]) => {
  const o2 = sim.grids.get(1)!.raw('o2');
  return tiles.reduce((s, i) => s + (o2[i] as number), 0) / tiles.length;
};

describe('starter ship', () => {
  it('parses to 30x20 and has at least 4 rooms', () => {
    const sim = newGame(1, content);
    sim.step();
    const g = sim.grids.get(1)!;
    expect([g.width, g.height]).toEqual([30, 20]);
    const rooms = new Set<number>();
    for (const r of g.raw('room')) if (r) rooms.add(r);
    expect(rooms.size).toBeGreaterThanOrEqual(4);
  });

  it('has its modules placed, powered, and every room lit and breathable', () => {
    const sim = newGame(1, content);
    run(sim, 20 * 30);
    const mods = sim.world.query(ModuleC).map((i) => sim.world.get(i, ModuleC)!);
    expect(mods.filter((m) => m.def === 'module.bed')).toHaveLength(4);
    expect(mods.every((m) => m.powered)).toBe(true);
    const g = sim.grids.get(1)!;
    for (let i = 0; i < g.raw('room').length; i++) {
      if (g.raw('room')[i] === 0) continue;
      expect(g.raw('light')[i], `tile ${i} is dark`).toBeGreaterThanOrEqual(40);
    }
    for (const room of new Set(g.raw('room'))) {
      if (room === 0) continue;
      expect(meanO2(sim, ROOM_TILES(sim, room))).toBeGreaterThan(18);
    }
    expect(sim.world.query(CrewC).length).toBeGreaterThan(0);
    expect(sim.events.drain().some((e) => e.type === 'crew.died' || e.type === 'crew.downed')).toBe(false);
  });

  it('vents the quarters through a hull breach while the sealed room next door holds air', () => {
    const sim = newGame(1, content);
    run(sim, 20);
    const g = sim.grids.get(1)!;
    const quarters = ROOM_TILES(sim, g.get('room', at(10, 6).x, at(10, 6).y));
    const neighbour = ROOM_TILES(sim, g.get('room', at(19, 6).x, at(19, 6).y));
    sim.enqueue({ type: 'debug.setStruct', gridId: 1, ...at(11, 1), kind: Struct.Floor }); // north hull, space beyond
    run(sim, 20 * 90);
    expect(meanO2(sim, quarters)).toBeLessThan(5);
    expect(meanO2(sim, neighbour)).toBeGreaterThan(18);
  });

  it('is deterministic: same seed and commands give the same save', () => {
    const go = (): string => {
      const sim = newGame(42, content);
      sim.enqueue({ type: 'debug.ignite', gridId: 1, ...at(10, 6) });
      run(sim, 400);
      sim.enqueue({ type: 'debug.setStruct', gridId: 1, ...at(11, 1), kind: Struct.Floor });
      run(sim, 800);
      return serialize(sim);
    };
    expect(go()).toBe(go());
  });

  it('round-trips a save taken mid-fire and keeps simulating identically', () => {
    const sim = newGame(7, content);
    sim.enqueue({ type: 'debug.ignite', gridId: 1, ...at(10, 6) });
    run(sim, 160);
    const json = serialize(sim);
    const loaded = deserialize(json, content);
    expect(serialize(loaded)).toBe(json);
    run(sim, 300);
    run(loaded, 300);
    expect(serialize(loaded)).toBe(serialize(sim));
  });

  it('steps 1000 ticks in well under two seconds', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.ignite', gridId: 1, ...at(10, 6) });
    const start = performance.now();
    run(sim, 1000);
    const ms = performance.now() - start;
    expect(ms).toBeLessThan(2000);
  });
});
