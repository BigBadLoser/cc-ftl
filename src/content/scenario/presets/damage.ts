import { damageScenarioCommands } from '../lib/damage';
import { definePreset } from '../types';

/** `?scenario=damage`: a fire, a hull breach and a damaged reactor. Crew answer the fire and the breach on their own (rooms exist after the first ticks, so the scene is set then). */
export default definePreset({
  doc: 'A fire, a hull breach and a damaged reactor.',
  spec: () => ({
    node: { warm: 10 },
    steps: [{ cmds: (ctx) => damageScenarioCommands(ctx.sim) }],
    ui: { speed: 1 },
  }),
});
