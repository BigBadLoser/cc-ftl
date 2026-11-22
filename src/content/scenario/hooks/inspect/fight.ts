import { CrewC, PositionC, isPlayers } from '../../../../sim';
import { InspectionC } from '../../../../sim/inspect/types';
import { shipIdOf } from '../../../../sim/regions';
import { defineHook } from '../../types';

/**
 * `&fight` (#138 step 3): once the inspectors are aboard and searching, one of the player's crew on the ship is drafted and, a moment later, ordered
 * to attack the lead inspector, which turns the inspection into a fight.
 */
export default defineHook({
  afterBuild(ctx) {
    const { sim } = ctx;
    const searching = () => sim.world.query(InspectionC).find((v) => sim.world.get(v, InspectionC)?.phase === 'search');
    ctx.when(() => searching() !== undefined, () => {
      const insp = sim.world.get(searching()!, InspectionC)!;
      const me = sim.world.query(CrewC).find((c) => {
        const p = sim.world.get(c, PositionC);
        return isPlayers(sim, c, { held: false }) && !!p && shipIdOf(sim, p) === insp.ship;
      });
      if (me === undefined || insp.crew[0] === undefined) return;
      ctx.dispatch({ type: 'crew.draft', id: me, drafted: true });
      ctx.after(6, () => ctx.dispatch({ type: 'crew.attack', id: me, target: insp.crew[0] as number }));
    }, 20000);
  },
});
