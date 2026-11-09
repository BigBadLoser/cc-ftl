import type { Scenario } from './types';

/**
 * `?scenario=busy` (#389): a node with a trading station and two other ships beside the player's, for profiling a busy node.
 * A generated civilian ship (roofed) and a derelict stand at fixed spots; the station is east of everything (zoom out to see it).
 * `&arrive=<seconds>` (#388): one more generated ship appears that many seconds in, for profiling an arrival.
 */
export const busy: Scenario = ({ params, dispatch, setSpeed }) => {
  if (!params.has('empty')) {
    // West of the node's own station: a civilian ship (roofed, as every other ship is) north of yours and a wreck south of it. These
    // spots are free at seed 1 (the old ones, a navy ship east and a wreck south, were rejected as too close and never spawned).
    dispatch({ type: 'debug.spawnGenerated', faction: 'faction.civilian', depth: 2, seed: 5, cx: 35, cy: 14 });
    dispatch({ type: 'debug.spawnDerelict', faction: 'faction.navy', depth: 2, seed: 3, cx: 28, cy: 105, intensity: 0.8, cause: 'combat' });
    dispatch({ type: 'debug.spawnStation', kind: 'station.trading', size: 'station', seed: 7 });
  }
  const arrive = Number(params.get('arrive'));
  if (arrive > 0) setTimeout(() => dispatch({ type: 'debug.spawnGenerated', faction: `faction.${params.get('arriveFaction') ?? 'civilian'}`, depth: 2, seed: 11, cx: 160, cy: 40 }), arrive * 1000);
  setSpeed(1);
};
