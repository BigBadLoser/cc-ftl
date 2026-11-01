import { WANTED_AT, clearBlocker, clearCost, isWanted, notorietyOf, type Sim } from '../sim';
import type { UiHeat } from '../ui/api';

/** The player's notoriety as the ship panel and the starmap show it: the number, whether the law wants them, who hunts them and what clearing it costs here. */
export function buildHeat(sim: Sim): UiHeat {
  const n = notorietyOf(sim);
  const content = sim.content.galaxy;
  const hunters = sim.galaxy.fleets.filter((f) => f.hunt).map((f) => content?.factions[f.faction]?.name ?? f.faction);
  return { notoriety: Math.round(n), wanted: isWanted(sim), wantedAt: WANTED_AT, hunters: [...new Set(hunters)], clearCost: clearCost(sim), clearBlocker: clearBlocker(sim) };
}
