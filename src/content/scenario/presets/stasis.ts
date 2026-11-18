import { CrewC, PositionC, playerShip, type Command } from '../../../sim';
import { playerCrew } from '../../../sim/story/world';
import { DEAL_FROM, nearestOwner, newHostiles, prisonerCommands } from '../lib/stasis';
import { definePreset, flag } from '../types';

/**
 * `?scenario=stasis[&deals][&unpowered]` (#116): a stasis wheel (ten empty slabs) near the middle of the ship and two hostile prisoners standing by the crew,
 * plus two spare empty slabs on the floor. Both are marked for sealing, so the crew seal each prisoner where they stand and cart the slab to the wheel on their
 * own. `&unpowered` (the `stasis.unpowered` scenario hook): once both are in, the wheel is switched off, so the stasis alert runs and, a game hour later, the
 * prisoners thaw (switch it back on in time to stop it). `&deals`: a third prisoner, left unsealed; the prisoners were taken from the node's first station's
 * owner, a raider clan and Meridian, so that station's Prisoners service (hail it) shows a ransom, a bounty or a refusal for the raider, and a refusal for the unsealed one.
 */
export default definePreset({
  doc: 'A stasis wheel and two prisoners the crew seal and cart to it.',
  params: { deals: flag(), unpowered: flag() },
  starter: 'ship.debug',
  spec: (p) => {
    const deals = !!p['deals'];
    let before = new Set<number>();
    return {
      ship: { template: 'ship.debug', populate: true, crew: 'rolled' as const },
      node: { warm: 4 },
      steps: [
        {
          cmds: (ctx): Command[] => {
            before = new Set(ctx.sim.world.query(CrewC));
            const out = prisonerCommands(ctx.sim);
            const third = ctx.sim.world.get(playerCrew(ctx.sim)[3] ?? playerCrew(ctx.sim)[0] ?? 0, PositionC);
            const ship = playerShip(ctx.sim);
            if (deals && third && ship) out.push({ type: 'debug.spawnCrew', ship, x: third.x, y: third.y, role: 'role.engineer', faction: 'hostile' });
            return out;
          },
        },
        {
          // The spawns land on the next tick: imprison them, and mark them for sealing (the crew seal only a marked prisoner).
          cmds: (ctx): Command[] => newHostiles(ctx.sim, before).flatMap((id, i): Command[] => {
            const from = i === 0 ? nearestOwner(ctx.sim) ?? 'navy' : DEAL_FROM[i];
            return [
              { type: 'debug.imprison', crew: id, ...(deals && from ? { from } : {}) },
              ...(!deals || i < 2 ? [{ type: 'prisoner.seal' as const, crew: id, on: true }] : []),
            ];
          }),
        },
      ],
      hooks: p['unpowered'] ? [{ name: 'stasis.unpowered' }] : [],
      ui: { speed: 1 },
    };
  },
});
