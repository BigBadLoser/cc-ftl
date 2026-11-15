import { galaxyIndex, nodeOf, ShipC } from '../../sim';
import { homeShip } from '../../sim/index';
import { sealPrizeCommands } from './stasis';
import type { Scenario } from './types';

/**
 * `?scenario=prisoners[&taken[&seal]]` (#116): a raider beside the ship whose whole crew has surrendered (and no boarders, so it yields): the "take prisoners or let
 * them go" alert waits. `&taken` answers it with "take prisoners", so the prize panel lists the prisoners. `&seal` also sets a stasis wheel at home and marks
 * every prisoner for sealing: the prize has no wheel, so a shuttle run fetches them (`sealPrizeCommands`).
 */
export const prisoners: Scenario = ({ sim, params, dispatch, setSpeed, spawnRaider }) => {
  const g = sim.galaxy;
  const next = (galaxyIndex(g).adjacent.get(g.current) ?? []).map((e) => (e.a === g.current ? e.b : e.a))
    .find((id) => !nodeOf(sim, id)?.structures.length) ?? g.current;
  const at = sim.world.get(homeShip(sim), ShipC);
  if (next !== g.current) dispatch({ type: 'debug.galaxyTeleport', node: next });
  setTimeout(() => {
    if (at) dispatch({ type: 'sector.deploy', x: at.x, y: at.y });
    setTimeout(() => {
      // The raider can only come once the ship is deployed (the player may have to do so first): spawn it then, and wait for it.
      let tries = 0;
      const poll = setInterval(() => {
        const enemy = sim.world.query(ShipC).find((id) => id !== homeShip(sim) && sim.world.get(id, ShipC)?.faction === 'hostile');
        if (enemy === undefined) {
          if (sim.sector.state === 'active' && tries++ % 4 === 0) spawnRaider();
          return;
        }
        clearInterval(poll);
        dispatch({ type: 'debug.surrender', ship: enemy });
        if (params.has('taken')) setTimeout(() => dispatch({ type: 'ship.settle', ship: enemy, choice: 'takePrisoners' }), 800);
        if (params.has('taken') && params.has('seal')) {
          // Once the prize is taken (its crew imprisoned), the wheel and the marks.
          const mark = (): void => {
            if (sim.world.get(enemy, ShipC)?.state !== 'prize') return void setTimeout(mark, 300);
            for (const cmd of sealPrizeCommands(sim, enemy)) dispatch(cmd);
          };
          setTimeout(mark, 1200);
        }
      }, 500);
    }, 400);
  }, 400);
  setSpeed(1);
};
