import { defineHook } from '../../types';

/** `&arrive=<seconds>` of the busy scenario: one more generated ship appears that many seconds in. */
export default defineHook({
  afterBuild(ctx) {
    const { seconds, faction } = ctx.args as { seconds: number; faction: string };
    ctx.after(Math.round(seconds * 20), () => ctx.dispatch({ type: 'debug.spawnGenerated', faction: `faction.${faction}`, depth: 2, seed: 11, cx: 160, cy: 40 }));
  },
});
