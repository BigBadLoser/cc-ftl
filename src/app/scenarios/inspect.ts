import { CrewC, PositionC, type Command, type Sim } from '../../sim';
import { inspectStation, inspectCommands } from '../../content/scenario/lib/inspect';

export { inspectStation, inspectCommands };
import { AllegianceC } from '../../sim/fight/components';
import { InspectionC } from '../../sim/inspect/types';
import { shipIdOf } from '../../sim/regions';
import type { Scenario } from './types';


/**
 * `&fight` (#138 step 3): once the inspectors are aboard and searching, one of the player's crew on the ship is drafted and ordered to attack the lead
 * inspector, which turns the inspection into a fight. Polls the sim (read only) and sends the commands.
 */
export function fightWhenAboard(sim: Sim, dispatch: (cmd: Command) => void, tries = 2400): void {
  const id = sim.world.query(InspectionC).find((v) => sim.world.get(v, InspectionC)?.phase === 'search');
  const insp = id === undefined ? undefined : sim.world.get(id, InspectionC);
  if (!insp) {
    if (tries > 0) setTimeout(() => fightWhenAboard(sim, dispatch, tries - 1), 250);
    return;
  }
  const me = sim.world.query(CrewC).find((c) => {
    const p = sim.world.get(c, PositionC);
    return sim.world.get(c, AllegianceC)?.faction === 'player' && !!p && shipIdOf(sim, p) === insp.ship;
  });
  if (me === undefined || insp.crew[0] === undefined) return;
  dispatch({ type: 'crew.draft', id: me, drafted: true });
  setTimeout(() => dispatch({ type: 'crew.attack', id: me, target: insp.crew[0] as number }), 300);
}

/** `&select`: once the inspectors search, select the lead inspector (their panel, with the Attack button). Polls the sim (read only). */
function selectLeadWhenAboard(sim: Sim, select: (id: number, focus: boolean) => void, tries = 2400): void {
  const id = sim.world.query(InspectionC).find((v) => sim.world.get(v, InspectionC)?.phase === 'search');
  const lead = id === undefined ? undefined : sim.world.get(id, InspectionC)?.crew[0];
  if (lead !== undefined) return select(lead, true);
  if (tries > 0) setTimeout(() => selectLeadWhenAboard(sim, select, tries - 1), 250);
}

/**
 * `?scenario=inspect[&clean][&eva][&fight][&select]` (#138 step 1; `&fight` and `&select` step 3, above): a contraband inspection at a station. A navy-run trading outpost beside the ship, stolen goods in
 * the hold (`&clean`: none), and the station hailed: its inspectors come over by shuttle, search the holds, carry the goods off and wait for an
 * answer (the alert). `&eva`: the ship's airlocks are switched off, so they cross in suits and wait on the hull until one is switched back on.
 */
export const inspect: Scenario = ({ sim, params, dispatch, setSpeed, spawnStation, selectCrew }) => {
  spawnStation('station.trading', 'outpost', true, 'navy');
  setSpeed(1);
  const go = (tries: number): void => {
    const station = inspectStation(sim);
    if (station === undefined) {
      if (tries > 0) setTimeout(() => go(tries - 1), 100);
      return;
    }
    for (const cmd of inspectCommands(sim, station, { clean: params.has('clean'), eva: params.has('eva') })) dispatch(cmd);
    if (params.has('fight')) fightWhenAboard(sim, dispatch);
    if (params.has('select')) selectLeadWhenAboard(sim, (lead, focus) => selectCrew(lead, focus));
  };
  go(50);
};
