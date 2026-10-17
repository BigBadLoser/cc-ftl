import type { ContentRegistry } from '../sim';
import { structCosts } from './costs';
import { items } from './items';
import { crewNames } from './names';
import { modules } from './modules';
import { recipes } from './recipes';
import { roles } from './roles';
import { weapons } from './weapons';
import { species } from './species';
import { raiderShip, raiderShipId } from './ships/raider';
import { starterShip, starterShipId } from './ships/starter';

export const content = {
  ships: { [starterShipId]: starterShip, [raiderShipId]: raiderShip },
  roles,
  modules,
  species,
  crewNames,
  items,
  recipes,
  structCosts,
  weapons,
} satisfies ContentRegistry;
