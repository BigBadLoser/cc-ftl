import type { ContentRegistry } from '../sim';
import { crewNames } from './names';
import { modules } from './modules';
import { roles } from './roles';
import { species } from './species';
import { starterShip, starterShipId } from './ships/starter';

export const content = {
  ships: { [starterShipId]: starterShip },
  roles,
  modules,
  species,
  crewNames,
} satisfies ContentRegistry;
