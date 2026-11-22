import { definePreset, str } from '../types';

/**
 * `?scenario=skirmish[&a=pirates][&b=traders]` (#603): two fleets of factions at war turn up in the player's node a few seconds in (up to two ships each), so
 * they meet there and fight as real ships: watch, or fire on one side to join the other (the `skirmish.arrive` hook). The opening grace is skipped. Also the
 * profiler's busy-node fight (`profile:sim --scenario preset:skirmish`).
 */
export default definePreset({
  doc: 'Two fleets at war fight in the player\'s node; join a side or watch.',
  params: { a: str(), b: str() },
  profile: { ticks: 3000 },
  spec: (p) => ({
    steps: [{ cmds: [{ type: 'story.skipGoals' as const }] }],
    hooks: [{ name: 'skirmish.arrive', args: { a: typeof p['a'] === 'string' ? p['a'] : 'pirates', b: typeof p['b'] === 'string' ? p['b'] : 'traders', seconds: 3 } }],
    ui: { speed: 1 },
  }),
});
