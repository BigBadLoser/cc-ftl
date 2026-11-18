import { CrewC, PositionC, homeShip } from '../../../sim';
import { definePreset } from '../types';

/**
 * `?scenario=log`: look at the ship's log and alerts. A raider arrives (combat alert, jumps to it), a fire breaks out on the ship, and a few seconds later
 * 450 credits come in (the log entry pulses). The raider and the credits are the `log` scenario hook, so they play on from the scene's first frame.
 */
export default definePreset({
  doc: 'A raider arrives, a fire breaks out, credits come in: the log and the urgent alerts.',
  spec: () => ({
    node: { warm: 1 },
    steps: [{
      cmds: (ctx) => {
        const crew = ctx.sim.world.query(CrewC)[0];
        const p = crew === undefined ? undefined : ctx.sim.world.get(crew, PositionC);
        return p ? [{ type: 'debug.setField', ship: homeShip(ctx.sim), x: Math.round(p.x), y: Math.round(p.y), field: 'fire', value: 200 }] : [];
      },
    }],
    hooks: [{ name: 'log' }],
    ui: { speed: 3 },
  }),
});
