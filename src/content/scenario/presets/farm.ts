import { pickCrew } from '../lib/crewPick';
import { definePreset } from '../types';

/**
 * `?scenario=farm` (#59): three hydroponics beds near the galley (greens half grown, protein beans ready to harvest, herbs set but empty), some produce in
 * hand, a keep-4 meal order at the galley, and a cook (the first crew member, cooking level 3 (1400 xp)) who turns out fine meals. Crew work as usual from here.
 */
export default definePreset({
  doc: 'Three hydroponics beds, produce in hand, meal orders and a hungry level-3 cook.',
  spec: () => ({
    node: { warm: 12 },
    modules: {
      add: [
        { def: 'module.hydroponics', near: 'module.galley', plot: { crop: 'crop.greens', grown: 110 } },
        { def: 'module.hydroponics', near: 'module.galley', plot: { crop: 'crop.beans', ready: true } },
        { def: 'module.hydroponics', near: 'module.galley', plot: { crop: 'crop.herbs' } },
      ],
      orders: [
        { at: 'module.galley', recipe: 'recipe.meal_greens', mode: 'keep', target: 4 },
        { at: 'module.galley', recipe: 'recipe.meal_beans', mode: 'keep', target: 4 },
      ],
    },
    // Hungry, so the first meal eaten shows its mood factor.
    crew: [{ who: 0, set: { xp: { cooking: 1500 }, hunger: 20 }, drop: { 'item.greens': 12, 'item.beans': 6, 'item.meal_fine': 4 } }],
    ui: { speed: 1, select: (sim) => pickCrew(sim, 0) },
  }),
});
