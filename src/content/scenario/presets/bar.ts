import { barCommands } from '../lib/bar';
import { definePreset } from '../types';

/** `?scenario=bar` (#441): the bar counter, corner, short counter and stools built as an L in the first open spot of the ship (debug hull). Furniture only. */
export default definePreset({
  doc: 'A bar built as an L in the first open spot of the debug hull.',
  starter: 'ship.debug',
  spec: () => ({
    steps: [{ cmds: (ctx) => barCommands(ctx.sim) }],
    ui: { speed: 1 },
  }),
});
