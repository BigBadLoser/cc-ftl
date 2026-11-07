import { ambush, freighter } from './ambush';
import { boarding, fight } from './fight';
import { bonds, breaks, inspector } from './crew';
import { damage } from './damage';
import { drones } from './drones';
import { hullplan } from './hullplan';
import { bounty, handover, survey } from './jobs';
import { logScenario } from './log';
import { medpod } from './medpod';
import type { Scenario, ScenarioCtx } from './types';
import { upgrades } from './upgrades';

/** Debug starts by their `?scenario=` name. A new one is a file in this folder and a line here. */
export const scenarios: Readonly<Record<string, Scenario>> = {
  log: logScenario, ambush, freighter, handover, bounty, survey, fight, boarding, inspector, breaks, bonds, drones, upgrades, damage, hullplan, medpod,
};

/** Start the scenario `name` (none, or an unknown name, starts nothing). */
export function startScenario(name: string | null, ctx: ScenarioCtx): void {
  const run = name === null ? undefined : scenarios[name];
  if (run) run(ctx);
}
export type { Scenario, ScenarioCtx } from './types';
