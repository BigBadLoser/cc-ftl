import type { ContentRegistry } from '../sim';
import { crewNames } from './names';
import { roles } from './roles';
import { species } from './species';
import { starterShip, starterShipId } from './ships/starter';

export const content = {
  ships: { [starterShipId]: starterShip },
  roles,
  species,
  crewNames,
} satisfies ContentRegistry;
