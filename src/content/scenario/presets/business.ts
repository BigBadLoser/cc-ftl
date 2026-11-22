import { definePreset } from '../types';

/**
 * `?scenario=business` (#603): NPC ships go about their business in the player's node. An asteroid field lies off the bow, and a few seconds in a
 * Free Traders miner turns up by the field and a trader by the station (when the node has one): the miner's pod goes out to mine (the
 * `business.arrive` hook). The opening grace is skipped.
 */
export default definePreset({
  doc: 'An NPC miner works the field and a trader calls at the station in the player\'s node.',
  params: {},
  spec: () => ({
    steps: [{ cmds: [{ type: 'story.skipGoals' as const }, { type: 'debug.spawnAsteroid' as const, kind: 'field' as const, seed: 7, x: 40, y: 150 }] }],
    hooks: [{ name: 'business.arrive', args: { seconds: 3 } }],
    ui: { speed: 1 },
  }),
});
