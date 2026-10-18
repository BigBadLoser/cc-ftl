import type { FactionDef } from '../../sim';
import { drones } from './drones';
import { navy } from './navy';
import { scrapper } from './scrapper';

/** Factions whose ships are generated (see src/sim/shipgen). */
export const factions = {
  'faction.scrapper': scrapper,
  'faction.drones': drones,
  'faction.navy': navy,
} satisfies Record<string, FactionDef>;
