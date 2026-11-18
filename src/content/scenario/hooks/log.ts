import { defineHook } from '../types';

/**
 * `?scenario=log`: a raider arrives (the first free spot of a few wins: a rejected spawn overlaps something), and a few seconds later credits come in (the
 * log entry pulses). Timed in ticks (20 per second) so it plays the same at any frame rate.
 */
export default defineHook({
  afterBuild(ctx) {
    const { sim } = ctx;
    const spots = [[110, 80], [60, 20], [20, 100], [150, 30], [100, 50], [40, 90], [130, 110]];
    spots.forEach(([x, y], i) => ctx.after(i * 8, () => {
      if (!sim.sector.inCombat) ctx.dispatch({ type: 'debug.spawnEnemy', template: 'ship.raider', x: x as number, y: y as number });
    }));
    for (const [sec, amount] of [[6, 80], [8, 200], [12, 450]] as const) ctx.after(sec * 20, () => ctx.dispatch({ type: 'debug.setCredits', value: sim.trade.credits + amount }));
  },
});
