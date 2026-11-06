import { CrewC, PositionC } from '../../sim';
import { homeShip } from '../../sim/index';
import type { Scenario } from './types';

/**
 * `?scenario=log`: look at the ship's log and alerts. A raider arrives (combat alert, jumps to it), a fire breaks out on the ship, and a few
 * seconds later 450 credits come in (the log entry pulses).
 */
export const logScenario: Scenario = ({ sim, dispatch, setSpeed }) => {
  // The first free spot wins (a rejected spawn overlaps something).
  const spots = [[110, 80], [60, 20], [20, 100], [150, 30], [100, 50], [40, 90], [130, 110]];
  spots.forEach(([x, y], i) => setTimeout(() => { if (!sim.sector.inCombat) dispatch({ type: 'debug.spawnEnemy', template: 'ship.raider', x: x as number, y: y as number }); }, i * 400));
  const crew = sim.world.query(CrewC)[0];
  const p = crew === undefined ? undefined : sim.world.get(crew, PositionC);
  if (p) dispatch({ type: 'debug.setField', ship: homeShip(sim), x: Math.round(p.x), y: Math.round(p.y), field: 'fire', value: 200 });
  setSpeed(3);
  for (const [ms, amount] of [[6000, 80], [8000, 200], [12000, 450]] as const) setTimeout(() => dispatch({ type: 'debug.setCredits', value: sim.trade.credits + amount }), ms);
};
