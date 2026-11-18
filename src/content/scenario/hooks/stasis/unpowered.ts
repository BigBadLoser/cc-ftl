import { ModuleC } from '../../../../sim';
import { PrisonerC } from '../../../../sim/fight/components';
import { slabPlace } from '../../../../sim/stasis/query';
import { defineHook } from '../../types';

/**
 * `&unpowered` of the stasis scenario: once every prisoner is in the wheel, the wheel is switched off, so the stasis alert runs and, a game hour later, the
 * prisoners thaw (switch it back on in time to stop it).
 */
export default defineHook({
  afterBuild(ctx) {
    const { sim } = ctx;
    const wheel = (): number | undefined => sim.world.query(ModuleC).find((id) => sim.world.get(id, ModuleC)?.def === 'module.stasis_wheel');
    const allIn = (): boolean => {
      const caught = sim.world.query(PrisonerC);
      return caught.length > 0 && caught.every((id) => slabPlace(sim, id)?.kind === 'wheel');
    };
    ctx.when(() => wheel() !== undefined && allIn(), () => ctx.dispatch({ type: 'module.setEnabled', id: wheel()!, enabled: false }), 20 * 60 * 30);
  },
});
