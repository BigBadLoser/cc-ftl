import { CrewC, MoodC, ShipC, playerShip } from '../../../../sim';
import { defineHook } from '../../types';

/**
 * `&deliver` of the medpod scenario: the passenger is made cheerful and sociable (in a good enough mood to ask to join at the destination), then once they are
 * in the mood (or after a minute anyway) the passage card is taken and the ship put at its destination, deployed where it was.
 */
export default defineHook({
  afterBuild(ctx) {
    const { sim } = ctx;
    const guest = sim.world.query(CrewC).at(-1);
    if (guest === undefined) return;
    ctx.dispatch({ type: 'debug.setCrew', id: guest, traits: ['trait.cheerful', 'trait.social'] });
    ctx.after(50, () => ctx.when(() => (sim.world.get(guest, MoodC)?.value ?? 0) > 60, () => deliver(), 60 * 20));
    // After a minute anyway.
    ctx.after(50 + 60 * 20, () => { if (!ctx.state['delivered']) deliver(); });
    function deliver(): void {
      if (ctx.state['delivered']) return;
      ctx.state['delivered'] = true;
      const card = sim.galaxy.posted?.find((j) => !j.refused);
      const at = sim.world.get(playerShip(sim), ShipC);
      if (!card?.to || !at) return;
      ctx.dispatch({ type: 'jobs.accept', key: card.key });
      ctx.after(6, () => {
        ctx.dispatch({ type: 'debug.galaxyTeleport', node: card.to as string });
        ctx.after(8, () => ctx.dispatch({ type: 'sector.deploy', x: at.x, y: at.y }));
      });
    }
  },
});
