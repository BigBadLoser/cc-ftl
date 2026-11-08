import { AirlockC, ModuleC, ShipC, TraderC, homeShip, type Command, type Sim } from '../../sim';
import { shipIdOf } from '../../sim/regions';
import type { Scenario } from './types';

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

/**
 * `?scenario=inspect[&clean][&eva]` (#138 step 1): a contraband inspection at a station. A navy-run trading outpost beside the ship, stolen goods in
 * the hold (`&clean`: none), and the station hailed: its inspectors come over by shuttle, search the holds, carry the goods off and wait for an
 * answer (the alert). `&eva`: the ship's airlocks are switched off, so they cross in suits and wait on the hull until one is switched back on.
 */
export const inspect: Scenario = ({ sim, params, dispatch, setSpeed, spawnStation }) => {
  spawnStation('station.trading', 'outpost', true, 'navy');
  setSpeed(1);
  const go = (tries: number): void => {
    const station = inspectStation(sim);
    if (station === undefined) {
      if (tries > 0) setTimeout(() => go(tries - 1), 100);
      return;
    }
    for (const cmd of inspectCommands(sim, station, { clean: params.has('clean'), eva: params.has('eva') })) dispatch(cmd);
  };
  go(50);
};
