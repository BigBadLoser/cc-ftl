import type { FactionDef } from '../../sim';
import { civilian } from './civilian';
import { drones } from './drones';
import { navy } from './navy';
import { cartel, mercenary, raider, zealot } from './pirates';
import { scrapper } from './scrapper';

/** Factions whose ships are generated (see src/sim/shipgen). */
export const factions = {
  'faction.scrapper': scrapper,
  'faction.raider': raider,
  'faction.cartel': cartel,
  'faction.zealot': zealot,
  'faction.mercenary': mercenary,
  'faction.drones': drones,
  'faction.navy': navy,
  'faction.civilian': civilian,
} satisfies Record<string, FactionDef>;
