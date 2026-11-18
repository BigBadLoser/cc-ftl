import { InspectionC } from '../../../../sim/inspect/types';
import { defineHook } from '../../types';

/** `&select`: once the inspectors search, select the lead inspector (their panel, with the Attack button). */
export default defineHook({
  afterBuild(ctx) {
    const { sim } = ctx;
    const lead = () => {
      const id = sim.world.query(InspectionC).find((v) => sim.world.get(v, InspectionC)?.phase === 'search');
      return id === undefined ? undefined : sim.world.get(id, InspectionC)?.crew[0];
    };
    ctx.when(() => lead() !== undefined, () => ctx.ui({ kind: 'select', crew: lead()!, focus: true }), 20000);
  },
});
