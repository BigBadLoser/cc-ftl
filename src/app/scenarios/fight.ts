import { galaxyIndex, nodeOf } from '../../sim';
import { homeShip } from '../../sim/index';
import { ShipC } from '../../sim';
import { startBoardingScenario } from '../boardingScenario';
import type { Scenario, ScenarioCtx } from './types';

/**
 * `?scenario=fight`: a raider beside the ship and the game running at normal speed, for the combat view; add `&far` for a raider at engagement distance.
 * `?scenario=boarding[&aim]`: the same, with a boarding party (app/boardingScenario.ts). `&charged` also fills the FTL drive.
 */
function fightScenario(boarding: boolean): Scenario {
  return ({ sim, params, dispatch, setSpeed, spawnRaider }: ScenarioCtx) => {
    // The start node holds a station that leaves no room for a raider: jump to an empty neighbour first, deploy where the ship was, then spawn the raider.
    const g = sim.galaxy;
    const next = (galaxyIndex(g).adjacent.get(g.current) ?? []).map((e) => (e.a === g.current ? e.b : e.a))
      .find((id) => !nodeOf(sim, id)?.structures.length) ?? g.current;
    const at = sim.world.get(homeShip(sim), ShipC);
    if (next !== g.current) dispatch({ type: 'debug.galaxyTeleport', node: next });
    setTimeout(() => {
      if (at) dispatch({ type: 'sector.deploy', x: at.x, y: at.y });
      setTimeout(() => {
        spawnRaider();
        if (boarding) startBoardingScenario(sim, dispatch, params.has('aim'));
        if (params.has('charged')) dispatch({ type: 'debug.chargeFtl' });
      }, 400);
    }, 400);
    setSpeed(1);
  };
}
export const fight = fightScenario(false);
export const boarding = fightScenario(true);
