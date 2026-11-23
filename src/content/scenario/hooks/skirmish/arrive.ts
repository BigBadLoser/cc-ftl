import { defineHook } from '../../types';

/** The skirmish scenario's two fleets turn up a few seconds into play (so the game, its log and its alerts are there to see the fight start). */
export default defineHook({
  afterBuild(ctx) {
    const { a, b, seconds } = ctx.args as { a: string; b: string; seconds: number };
    ctx.after(Math.round(seconds * 20), () => {
      ctx.dispatch({ type: 'debug.pirates', node: ctx.sim.galaxy.current, faction: a });
      ctx.dispatch({ type: 'debug.pirates', node: ctx.sim.galaxy.current, faction: b });
    });
  },
});
