import type { Scenario } from './types';

/**
 * `?scenario=busy` (#389): a node with a trading station and two other ships beside the player's, for profiling a busy node.
 * A generated navy ship and a derelict stand at fixed spots; the station is east of everything (zoom out to see it).
 * `&arrive=<seconds>` (#388): one more generated ship appears that many seconds in, for profiling an arrival.
 */
export const busy: Scenario = ({ params, dispatch, setSpeed }) => {
  if (!params.has('empty')) {
    dispatch({ type: 'debug.spawnGenerated', faction: 'faction.navy', depth: 2, seed: 5, cx: 130, cy: 70 });
    dispatch({ type: 'debug.spawnDerelict', faction: 'faction.navy', depth: 2, seed: 3, cx: 60, cy: 120, intensity: 0.8, cause: 'combat' });
    dispatch({ type: 'debug.spawnStation', kind: 'station.trading', size: 'station', seed: 7 });
  }
  const arrive = Number(params.get('arrive'));
  if (arrive > 0) setTimeout(() => dispatch({ type: 'debug.spawnGenerated', faction: `faction.${params.get('arriveFaction') ?? 'civilian'}`, depth: 2, seed: 11, cx: 160, cy: 40 }), arrive * 1000);
  setSpeed(1);
};
