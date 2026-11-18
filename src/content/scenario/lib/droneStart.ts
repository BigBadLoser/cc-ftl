import { definePreset, flag, num, str, type Preset } from '../types';
import { droneScenarioCommands } from './drone';
import { spawnFightEnemy } from './droneFight';
import { upgradeScenarioCommands } from './upgrade';

/**
 * The drone and upgrade starts. `?scenario=drones`: drone bays, three drones, a fire, a damaged console and hurt crew. `&breach`: repair drones with metal and a
 * hole in the hull; they go out through the hatch and seal it. `&fight` (#318 slice 2): two drone bays and two defence drones, and a missile-armed Lancer at
 * engagement distance; the fight starts at once, the drones go up through their hatches and guard the ship. `&charged`: the drive starts full, to flee and see
 * them recalled. `&enemy=navy|drones[&depth=N]` fights a generated ship with defence drones instead of the Lancer (slice 2b). `?scenario=upgrades[&enemy=navy][&depth=6]`:
 * the same fight with its own player set-up (a flak cannon, scrap and one of each general upgrade aboard) against a navy ship.
 */
export function dronePreset(kind: 'drones' | 'upgrades', doc: string): Preset {
  return definePreset({
    doc,
    params: { fight: flag(), breach: flag(), charged: flag(), enemy: str(), depth: num() },
    spec: (p) => {
      const fight = kind === 'upgrades' || !!p['fight'];
      if (!fight) {
        return { node: { warm: 10 }, steps: [{ cmds: (ctx) => droneScenarioCommands(ctx.sim, false, !!p['breach']) }], ui: { speed: 1 } };
      }
      const faction = typeof p['enemy'] === 'string' ? p['enemy'] : kind === 'upgrades' ? 'navy' : null;
      return {
        node: { warm: 10, relocate: true },
        steps: [
          { cmds: (ctx) => (kind === 'upgrades' ? upgradeScenarioCommands(ctx.sim) : droneScenarioCommands(ctx.sim, true)), ticks: 31 }, // a moment, so the drones are in their bays before the fight starts
          { run: (ctx) => spawnFightEnemy(ctx, { kind, faction, depth: typeof p['depth'] === 'number' ? p['depth'] : 6 }) },
          ...(p['charged'] ? [{ cmds: [{ type: 'debug.chargeFtl' as const }] }] : []),
        ],
        ui: { speed: 1 },
      };
    },
  });
}
