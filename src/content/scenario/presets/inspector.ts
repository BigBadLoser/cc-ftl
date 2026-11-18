import { pickCrew } from '../lib/crewPick';
import { definePreset } from '../types';

/**
 * `?scenario=inspector`: look at the crew inspector's tabs. The first organic crew member (a gunner when there is one) gets several traits, some skill XP, a
 * rifle in hand and a few needs low enough to show in their mood; they are selected.
 */
export default definePreset({
  doc: 'A crew member with traits, XP, a rifle and a mixed mood, selected.',
  spec: () => ({
    crew: [{
      who: 'role.gunner',
      set: { weapon: 'item.rifle', hunger: 52, rest: 24, traits: ['trait.marksman', 'trait.strong', 'trait.workaholic', 'trait.social', 'trait.gifted'], xp: { gunnery: 160, construction: 45, piloting: 70 } },
    }],
    ui: { speed: 1, select: (sim) => pickCrew(sim, 'role.gunner') },
  }),
});
