import type { Scenario } from './types';

/**
 * `?scenario=hullplan`: playtest the hull plan brushes. A trading hub (visit cap 100) beside the ship, plenty of credits and metal, the Hull plan
 * tool open with the Rectangle brush, and the game running at normal speed. The plan starts empty; the station's Shipyard tab is one click away.
 */
export const hullplan: Scenario = ({ dispatch, setSpeed, setTool, spawnStation }) => {
  spawnStation('station.trading', 'hub', false); // the camera stays on the ship and the open space around it
  dispatch({ type: 'debug.setCredits', value: 100000 });
  dispatch({ type: 'debug.giveItems', item: 'item.metal', count: 500 });
  setTool({ tool: 'build', build: 'hull', hull: { brush: 'rect', erase: false, mirror: false } });
  setSpeed(1);
};
