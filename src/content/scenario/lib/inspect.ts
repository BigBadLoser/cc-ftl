import { AirlockC, ModuleC, ShipC, TraderC, homeShip, type Command, type Sim } from '../../../sim';
import { InspectionC } from '../../../sim/inspect/types';
import { shipIdOf } from '../../../sim/regions';

/** The navy-run station beside the player (the first immobile ship), if it is there yet. */
export const inspectStation = (sim: Sim): number | undefined =>
  sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)?.immobile && sim.world.get(i, TraderC)?.owner === 'navy');

/** The commands that set the scene once the station stands: contraband in the hold (unless `clean`), the airlocks off (`eva`), and the hail. */
export function inspectCommands(sim: Sim, station: number, opts: { clean?: boolean; eva?: boolean } = {}): Command[] {
  const ship = homeShip(sim);
  const locks = sim.world.query(AirlockC).filter((a) => shipIdOf(sim, sim.world.get(a, ModuleC)!) === ship);
  return [
    { type: 'debug.setCredits', value: 2000 },
    ...(opts.clean ? [] : [{ type: 'debug.giveItems' as const, item: 'item.stolen_goods', count: 12 }]),
    ...(opts.eva ? locks.map((id) => ({ type: 'module.setEnabled' as const, id, enabled: false })) : []),
    { type: 'trade.hail', ship: station },
  ];
}

/** The steps that run an inspection on to `phase` ('search': the inspectors aboard; 'settle': waiting for the player's answer). */
export const untilInspectPhase = (phase: 'search' | 'settle') => ({
  until: (sim: Sim): boolean => sim.world.query(InspectionC).some((v) => sim.world.get(v, InspectionC)?.phase === phase),
  what: `inspection ${phase}`,
  // An open story decision is cleared as it appears, so nothing else holds the run (as the tests' own waits always did).
  each: (sim: Sim): void => void (sim.story.active = null),
});
