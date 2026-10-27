import { describe, expect, it } from 'vitest';
import { content } from '../index';
import { generatedLoad, loadOf } from './capacityFixture';
import { factions } from './index';

/**
 * Every ship the game fields must fit within its own engines' hull capacity (ftl/capacity.ts): a captured or bought hull must never
 * start out overweight. Generated ships are stamped into a sim and read with the live `hullLoad`, the count the ship panel shows.
 * The slow twin (engineCapacity.slow.test.ts) sweeps many more seeds.
 */
describe('engine hull capacity: every ship fits', () => {
  it('the starter ship, with room to spare', () => {
    const load = loadOf(content.ships['ship.starter']);
    expect(load.over).toBe(0);
    expect(load.tiles / load.capacity).toBeLessThan(0.5);
  });

  it('every ship template of the game', () => {
    for (const [id, t] of Object.entries(content.ships)) expect(loadOf(t).over, id).toBe(0);
  });

  for (const id of Object.keys(factions)) {
    it(`${id}: a spread of generated ships fits (seeds across depths 0-9)`, () => {
      const bad: string[] = [];
      for (let seed = 0; seed < 14; seed++) {
        const load = generatedLoad(id, seed * 7919 + 13, seed % 10);
        if (load.over > 0) bad.push(`seed ${seed}: hull ${load.tiles} / ${load.capacity}`);
      }
      expect(bad).toEqual([]);
    }, 60000);
  }
});
