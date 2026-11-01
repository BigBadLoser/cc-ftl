import type { ContentRegistry } from '../sim';
import { structCosts } from './costs';
import { items } from './items';
import { crewNames } from './names';
import { modules as baseModules } from './modules';
import { tierModules } from './tiers';
import { research, researchBands } from './research';
import { recipes } from './recipes';
import { roles } from './roles';
import { traits } from './traits';
import { weapons } from './weapons';
import { vehicles } from './vehicles';
import { species } from './species';
import { suit } from './suit';
import { factions } from './factions';
import { raiderBoarder, raiderBoarderId, raiderShip, raiderShipId } from './ships/raider';
import { events } from './events';
import { goals } from './goals';
import { galaxy } from './galaxy';
import { trade } from './trade';
import { stations } from './stations';
import { yard } from './yard';
import { blackMarkets } from './blackMarkets';
import { creatures } from './creatures';
import { ores } from './ores';
import { starterShip, starterShipId } from './ships/starter';
import { rogueShipyard, rogueShipyardId } from './ships/rogue';

const modules = { ...baseModules, ...tierModules };

export const content = {
  ships: { [starterShipId]: starterShip, [raiderShipId]: raiderShip, [raiderBoarderId]: raiderBoarder, [rogueShipyardId]: rogueShipyard },
  roles,
  modules,
  species,
  crewNames,
  traits,
  items,
  recipes,
  structCosts,
  weapons,
  vehicles,
  suit,
  events,
  goals,
  factions,
  galaxy,
  stations,
  yard,
  blackMarkets,
  trade,
  creatures,
  ores,
  research,
  researchBands: [...researchBands],
} satisfies ContentRegistry;
