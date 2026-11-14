import { galaxyIndex, nodeOf, ShipC } from '../../sim';
import { homeShip } from '../../sim/index';
import type { Scenario } from './types';

/**
 * `?scenario=prisoners[&taken]` (#116): a raider beside the ship whose whole crew has surrendered (and no boarders, so it yields): the "take prisoners or let
 * them go" alert waits. `&taken` answers it with "take prisoners", so the prize panel lists the prisoners.
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
      }, 500);
    }, 400);
  }, 400);
  setSpeed(1);
};
