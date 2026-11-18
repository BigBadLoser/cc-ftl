import { ShipC, homeShip, type Sim } from '../../../sim';
import { sealPrizeCommands } from '../lib/stasis';
import { definePreset, flag } from '../types';

/**
 * `?scenario=prisoners[&taken[&seal]]` (#116): a raider beside the ship whose whole crew has surrendered (and no boarders, so it yields): the "take prisoners or
 * let them go" alert waits. `&taken` answers it with "take prisoners", so the prize panel lists the prisoners. `&seal` also sets a stasis wheel at home and marks
 * every prisoner for sealing: the prize has no wheel, so a shuttle run fetches them (`sealPrizeCommands`).
 */
export default definePreset({
  doc: 'A raider whose crew has surrendered: take prisoners or let them go.',
  params: { taken: flag(), seal: flag() },
  spec: (p) => {
    const enemy = (sim: Sim): number | undefined => sim.world.query(ShipC).find((id) => id !== homeShip(sim) && sim.world.get(id, ShipC)?.faction === 'hostile');
    return {
      node: { warm: 10, relocate: true },
      ships: [{ kind: 'raider' }],
      steps: [
        { cmds: (ctx) => (enemy(ctx.sim) === undefined ? [] : [{ type: 'debug.surrender', ship: enemy(ctx.sim)! }]) },
        ...(p['taken'] ? [
          { cmds: (ctx: { sim: Sim }) => (enemy(ctx.sim) === undefined ? [] : [{ type: 'ship.settle' as const, ship: enemy(ctx.sim)!, choice: 'takePrisoners' as const }]) },
        ] : []),
        ...(p['taken'] && p['seal'] ? [
          // Once the prize is taken (its crew imprisoned), the wheel and the marks.
          { until: (sim: Sim) => sim.world.query(ShipC).some((id) => sim.world.get(id, ShipC)?.state === 'prize'), max: 400, what: 'the prize is taken' },
          { cmds: (ctx: { sim: Sim }) => { const prize = ctx.sim.world.query(ShipC).find((id) => ctx.sim.world.get(id, ShipC)?.state === 'prize'); return prize === undefined ? [] : sealPrizeCommands(ctx.sim, prize); } },
        ] : []),
      ],
      ui: { speed: 1 },
    };
  },
});
