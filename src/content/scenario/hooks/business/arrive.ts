import { defineHook } from '../../types';

/** The business scenario's miner and trader turn up a few seconds into play. */
export default defineHook({
  afterBuild(ctx) {
    const { seconds } = ctx.args as { seconds: number };
    ctx.after(Math.round(seconds * 20), () => {
      ctx.dispatch({ type: 'debug.pirates', node: ctx.sim.galaxy.current, faction: 'traders', role: 'miner' });
      ctx.dispatch({ type: 'debug.pirates', node: ctx.sim.galaxy.current, faction: 'traders', role: 'trader' });
    });
  },
});
