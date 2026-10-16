import type { ContentRegistry } from '../sim';
import { starterShip, starterShipId } from './ships/starter';

export const content = {
  ships: { [starterShipId]: starterShip },
} satisfies ContentRegistry;
