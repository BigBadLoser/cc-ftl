import { describe, expect, it } from 'vitest';
import { ShipC, newGame, type RoleDef, type Sim, type SpeciesDef } from '../../sim';
import { EggSacC, NestC } from '../../sim/aliens/components';
import { content } from '../index';

function derelict(faction: string, cause: 'combat' | 'decay', seed: number): { sim: Sim; id: number } {
  const sim = newGame(1, content);
  sim.enqueue({ type: 'debug.spawnDerelict', faction, seed, depth: 2, cx: 130, cy: 70, intensity: 0.6, cause });
  sim.step();
  const id = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)?.faction === 'neutral') ?? 0;
  return { sim, id };
}
const sacsOn = (sim: Sim, id: number) => sim.world.query(EggSacC).filter((s) => sim.world.get(s, EggSacC)?.ship === id);

describe('derelict infestations', () => {
  it('old civilian and scrapper wrecks carry dormant egg sacs and a nest as entities, not static dressing', () => {
    for (const f of ['faction.civilian', 'faction.scrapper']) {
      const { sim, id } = derelict(f, 'decay', 4);
      const sacs = sacsOn(sim, id);
      expect(sacs.length).toBeGreaterThan(0);
      expect(sacs.every((s) => sim.world.get(s, EggSacC)?.state === 'dormant')).toBe(true);
      expect(sim.world.query(NestC).length).toBeGreaterThan(0);
      expect(sim.world.get(id, ShipC)?.ruin?.hooks.some((h) => h.art?.startsWith('decay.eggsac'))).toBe(false);
    }
  });

  it('fresh navy combat wrecks have no aliens', () => {
    for (const seed of [1, 2, 3]) {
      const { sim, id } = derelict('faction.navy', 'combat', seed);
      expect(id).not.toBe(0);
      expect(sacsOn(sim, id)).toEqual([]);
      expect(sim.world.query(NestC)).toEqual([]);
    }
  });

  it('every alien role in the hatch table is a creature with the art species', () => {
    for (const { role } of content.creatures.hatch) {
      const r = (content.roles as Record<string, RoleDef>)[role];
      const sp = (content.species as Record<string, SpeciesDef>)[r?.species ?? ''];
      expect(sp?.creature).toBeTruthy();
      expect(sp?.natural).toBeTruthy();
    }
  });
});
