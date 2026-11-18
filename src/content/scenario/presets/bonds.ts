import { pickCrew } from '../lib/crewPick';
import { definePreset } from '../types';

/**
 * `?scenario=bonds`: look at relationships (issue #239). The first crew member has two friends and a rival, each with a reason, so the crew card lists them and
 * hovering one of them says why; they are selected.
 */
export default definePreset({
  doc: 'The first crew member has two friends and a rival.',
  spec: () => ({
    node: { warm: 10 },
    crew: [{ who: 0, bonds: [{ with: 1, delta: 62, reason: 'fought' }, { with: 2, delta: 55, reason: 'chat' }, { with: 3, delta: -58, reason: 'row' }] }],
    ui: { speed: 1, select: (sim) => pickCrew(sim, 0) },
  }),
});
