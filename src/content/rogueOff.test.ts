import { describe, expect, it } from 'vitest';
import { newGame } from '../sim';
import { ensureChunk } from '../sim/galaxy/state';
import { content } from '.';

/** Rogue AI ships are off for now (#427): their sealed reactor pods can't be refuelled. The faction and its shipgen stay for later. */
describe('rogue AI is switched off', () => {
  it('no fleet, ship or derelict generator in a few seeds is the drone faction', () => {
    expect(content.factions?.['faction.drones']).toBeDefined(); // kept for later
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sim = newGame(seed, content);
      sim.sector.state = 'deploying';
      for (let cy = -5; cy <= 5; cy++) for (let cx = -5; cx <= 5; cx++) ensureChunk(sim, cx, cy);
      expect(sim.galaxy.fleets.length).toBeGreaterThan(0);
      for (const f of sim.galaxy.fleets) {
        expect(f.faction, `seed ${seed}`).not.toBe('rogue');
        for (const c of f.ships) expect(c.shipgen, `seed ${seed}`).not.toBe('faction.drones');
      }
    }
  });

  it('no faction offers drone ships and traffic never draws them', () => {
    for (const [id, f] of Object.entries(content.galaxy.factions)) {
      expect(f.ships.some((s) => s.value === 'faction.drones'), id).toBe(false);
    }
    expect((content.galaxy.factions['rogue'] as { traffic?: unknown } | undefined)?.traffic).toBeUndefined();
  });
});
