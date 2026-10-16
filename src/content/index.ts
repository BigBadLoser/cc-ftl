import type { ContentRegistry } from '../sim';
import { structCosts } from './costs';
import { items } from './items';
import { crewNames } from './names';
import { modules } from './modules';
import { recipes } from './recipes';
import { roles } from './roles';
import { species } from './species';
import { starterShip, starterShipId } from './ships/starter';

export const content = {
  ships: { [starterShipId]: starterShip },
  roles,
  modules,
  species,
  crewNames,
  items,
  recipes,
  structCosts,
} satisfies ContentRegistry;
