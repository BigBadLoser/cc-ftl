import { ShipC, currentNode, playerShip, populateCargo } from '../../sim';
import { ContainerC } from '../../sim/containers/components';
import type { Scenario } from './types';

/**
 * `?scenario=lostcargo` (#503): the node's lost cargo made by the same spawner a node population uses (`populateCargo`), west of the player's ship once it
 * has deployed, so both are in view. `&cargoSeed=` picks the draw (a different pair, size and load); `&tier=` is the danger tier that sets the goods; `&cut`
 * orders the first box opened, so the crew's cutting job can be watched (the game runs at speed 3 then).
 */
export const lostcargo: Scenario = ({ sim, params, setSpeed }) => {
  setSpeed(params.has('cut') ? 3 : 1);
  setTimeout(() => {
    const ship = sim.world.get(playerShip(sim), ShipC);
    const node = currentNode(sim);
    if (!ship || !node) return;
    const tier = Number(params.get('tier') ?? node.danger);
    populateCargo(sim, { ...node, danger: tier }, Number(params.get('cargoSeed') ?? 7), { x: Math.max(8, ship.x - 26), y: ship.y + ship.height / 2 - 4 });
    const id = sim.world.query(ContainerC)[0];
    if (params.has('cut') && id !== undefined) sim.enqueue({ type: 'container.open', id });
  }, 3000);
};
