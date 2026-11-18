import { definePreset, flag, num, str } from '../types';

/**
 * `?scenario=busy` (#389): a node with a trading station and two other ships beside the player's, for profiling a busy node. A generated civilian ship (roofed) and
 * a derelict stand at fixed spots (free at seed 1); the station is east of everything (zoom out to see it). `&empty`: none of them. `&arrive=<seconds>`
 * (#388): one more generated ship appears that many seconds in (`&arriveFaction=`), for profiling an arrival (the `busy.arrive` scenario hook).
 */
export default definePreset({
  doc: 'A trading station, a civilian ship and a derelict beside the player.',
  params: { empty: flag(), arrive: num(), arriveFaction: str() },
  spec: (p) => ({
    ...(p['empty'] ? {} : {
      ships: [
        { kind: 'generated' as const, faction: 'faction.civilian', depth: 2, seed: 5, at: [35, 14] as const },
        { kind: 'derelict' as const, faction: 'faction.navy', depth: 2, seed: 3, at: [28, 105] as const, intensity: 0.8, cause: 'combat' as const },
      ],
      node: { stations: [{ kind: 'station.trading', size: 'station' as const, seed: 7 }] },
    }),
    hooks: typeof p['arrive'] === 'number' && p['arrive'] > 0 ? [{ name: 'busy.arrive', args: { seconds: p['arrive'], faction: p['arriveFaction'] ?? 'civilian' } }] : [],
    ui: { speed: 1 },
  }),
});
