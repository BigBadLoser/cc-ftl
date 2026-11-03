import { ShipC, type Sim } from '../sim';

/**
 * The foreign ship or station a world click on `shipId` should open the inspector for, or null. A derelict (wreck) opens its ship
 * panel with the salvage order; the player's own ships go by the module/tile selection.
 */
export function foreignShipTarget(sim: Sim, shipId: number, home: number): number | null {
  if (shipId === home) return null;
  const ship = sim.world.get(shipId, ShipC);
  if (!ship || ship.faction === 'player' || ship.outpost?.hidden) return null;
  return shipId;
}
