import { describe, expect, it } from 'vitest';
import { CrewC, ModuleC, homeShip, newGame, shipGrid, type Sim } from '../../../src/sim';
import { SHIPS, withShip } from './kits';

/**
 * The starter ships' minute-long run (src/content/ships/starterShips.test.ts) for every hand-drawn variant: all crew alive,
 * every module powered, every room lit and breathable.
 */
const run = (sim: Sim, n: number): void => { for (let i = 0; i < n; i++) sim.step(); };

for (const { ship, variants } of SHIPS) {
  describe.each(variants)(`${ship} variant $name`, (v) => {
    it('builds with its crew, every module powered, every room lit and breathable, and survives a minute', () => {
      const sim = newGame(1, withShip(v.template), 'ship.variant');
      run(sim, 20 * 60);
      expect(sim.world.query(CrewC)).toHaveLength(v.template.crew!.length);
      const mods = sim.world.query(ModuleC).map((i) => sim.world.get(i, ModuleC)!);
      expect(mods.filter((m) => !m.powered).map((m) => m.def)).toEqual([]);
      const g = shipGrid(sim, homeShip(sim))!;
      const room = g.load('room');
      const light = g.load('light');
      const dark: string[] = [];
      for (let i = 0; i < room.length; i++) if (room[i] !== 0 && (light[i] as number) < 40) dark.push(`${i % g.width},${Math.floor(i / g.width)}`);
      expect(dark).toEqual([]);
      const o2 = g.load('o2');
      for (const r of new Set(room)) {
        if (r === 0) continue;
        const tiles: number[] = [];
        room.forEach((x, i) => { if (x === r) tiles.push(i); });
        expect(tiles.reduce((a, i) => a + (o2[i] as number), 0) / tiles.length, `room ${r} air`).toBeGreaterThan(18);
      }
      expect(sim.events.drain().some((e) => e.type === 'crew.died' || e.type === 'crew.downed')).toBe(false);
    });
  });
}
