import { ShipC, currentNode, playerShip, populateCargo } from '../../../sim';
import { ContainerC } from '../../../sim/containers/components';
import { definePreset, flag, num } from '../types';

/**
 * `?scenario=lostcargo` (#503): the node's lost cargo made by the same spawner a node population uses (`populateCargo`), west of the player's ship, so both are in
 * view. `&cargoSeed=` picks the draw (a different pair, size and load); `&tier=` is the danger tier that sets the goods; `&cut` orders the first box opened, so the
 * crew's cutting job can be watched (the game runs at speed 3 then).
 */
export default definePreset({
  doc: 'The node\'s lost cargo, spawned west of the ship.',
  params: { cargoSeed: num(), tier: num(), cut: flag() },
  spec: (p) => ({
    node: { warm: 10 },
    steps: [{
      // The same spawner a node population uses (not a command: the world generator itself), so the scenario shows what play would make.
      run: (ctx) => {
        const { sim } = ctx;
        const ship = sim.world.get(playerShip(sim), ShipC);
        const node = currentNode(sim);
        if (!ship || !node) return;
        const tier = typeof p['tier'] === 'number' ? p['tier'] : node.danger;
        populateCargo(sim, { ...node, danger: tier }, typeof p['cargoSeed'] === 'number' ? p['cargoSeed'] : 7, { x: Math.max(8, ship.x - 26), y: ship.y + ship.height / 2 - 4 });
        const id = sim.world.query(ContainerC)[0];
        if (p['cut'] && id !== undefined) ctx.enqueue({ type: 'container.open', id });
      },
    }],
    ui: { speed: p['cut'] ? 3 : 1 },
  }),
});
