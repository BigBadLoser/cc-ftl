import { definePreset } from '../types';

/**
 * `?scenario=hullplan`: playtest the hull plan brushes. A trading hub (visit cap 100) beside the ship, plenty of credits and metal, the Hull plan tool open with
 * the Rectangle brush, and the game running at normal speed. The plan starts empty; the station's Shipyard tab is one click away.
 */
export default definePreset({
  doc: 'A trading hub beside the ship, credits and metal, the hull plan tool open.',
  spec: () => ({
    node: { stations: [{ kind: 'station.trading', size: 'hub' }] }, // the camera stays on the ship and the open space around it
    items: { credits: 100000, give: { 'item.metal': 500 } },
    ui: { speed: 1, tool: { tool: 'build', build: 'hull', hull: { brush: 'rect', erase: false, mirror: false } } },
  }),
});
