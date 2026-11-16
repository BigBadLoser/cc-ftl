import { ShipC, currentNode, playerShip, populateCargo } from '../../sim';
import type { Scenario } from './types';

/**
 * `?scenario=lostcargo` (#503): the node's lost cargo made by the same spawner a node population uses (`populateCargo`), a few tiles east of the player's
 * ship so both are in view. `&cargoSeed=` picks the draw (a different pair, size and load); `&tier=` is the danger tier that sets the goods.
 */
export const lostcargo: Scenario = ({ sim, params, setSpeed }) => {
  setSpeed(1);
  const ship = sim.world.get(playerShip(sim), ShipC);
  const node = currentNode(sim);
  if (!ship || !node) return;
  const tier = Number(params.get('tier') ?? node.danger);
  populateCargo(sim, { ...node, danger: tier }, Number(params.get('cargoSeed') ?? 7), { x: ship.x + ship.width + 10, y: ship.y + ship.height / 2 - 4 });
};
