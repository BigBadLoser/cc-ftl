import { describe, expect, it } from 'vitest';
import { assembled } from './stationRecipeFixture';
import { stationRecipes } from './stationRecipes';

/** Every recipe on four seeds: all rooms and beds stand, no solid 2x2 wall, the hull holds, every floor tile is reachable. */
describe('station recipes, every variation', () => {
  for (const recipe of stationRecipes.tree) {
    it(`tree: ${recipe.name}`, () => {
      for (const seed of [1, 2, 3, 4]) expect(assembled(recipe, 'station.pirate', 'hub', seed), `seed ${seed}`).toEqual([]);
    });
  }
  for (const recipe of stationRecipes.spine) {
    it(`spine: ${recipe.name}`, () => {
      for (const seed of [1, 2, 3, 4]) expect(assembled(recipe, 'station.mining', 'station', seed), `seed ${seed}`).toEqual([]);
    });
  }
  for (const recipe of stationRecipes.compound) {
    it(`compound: ${recipe.name}`, () => {
      for (const seed of [1, 2, 3, 4]) expect(assembled(recipe, 'station.mining', 'station', seed), `seed ${seed}`).toEqual([]);
    });
  }
});
