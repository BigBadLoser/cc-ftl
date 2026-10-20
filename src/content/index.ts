import type { ContentRegistry } from '../sim';
import { structCosts } from './costs';
import { items } from './items';
import { crewNames } from './names';
import { modules } from './modules';
import { recipes } from './recipes';
import { roles } from './roles';
import { weapons } from './weapons';
import { vehicles } from './vehicles';
import { species } from './species';
import { suit } from './suit';
import { factions } from './factions';
import { raiderBoarder, raiderBoarderId, raiderShip, raiderShipId } from './ships/raider';
import { events } from './events';
import { trade } from './trade';
import { creatures } from './creatures';
import { starterShip, starterShipId } from './ships/starter';
import { rogueShipyard, rogueShipyardId } from './ships/rogue';

export const content = {
  ships: { [starterShipId]: starterShip, [raiderShipId]: raiderShip, [raiderBoarderId]: raiderBoarder, [rogueShipyardId]: rogueShipyard },
  roles,
  modules,
  species,
  crewNames,
  items,
  recipes,
  structCosts,
  weapons,
  vehicles,
  suit,
  events,
  factions,
  trade,
  creatures,
} satisfies ContentRegistry;
