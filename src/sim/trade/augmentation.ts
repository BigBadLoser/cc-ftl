import { implantLoad } from '../crew/implants';
import { HEAVY_LOAD } from '../crew/tuningSurgery';
import type { Sim } from '../sim';
import { playerCrewPackedOk } from '../story/world';

/**
 * How many of the player's crew are heavily augmented: an implant load (crew/implants.ts `implantLoad`, the summed cyber points) of `HEAVY_LOAD` or more.
 * The zealots talk to a ship whose crew is machine-touched enough (`TradeFactionDef.augmentBonus`).
 */
export function augmentedCrew(sim: Sim): number {
  return playerCrewPackedOk(sim).filter((id) => implantLoad(sim, id) >= HEAVY_LOAD).length;
}
