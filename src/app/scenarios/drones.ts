import { content } from '../../content';
import { ShipC, galaxyIndex, nodeOf } from '../../sim';
import { homeShip } from '../../sim/index';
import { droneScenarioCommands } from '../droneScenario';
import { enemyUpgradeCommands, upgradeScenarioCommands } from '../upgradeScenario';
import type { Scenario } from './types';

/**
 * `?scenario=drones&fight` (#318 slice 2): two drone bays and two defence drones, and a missile-armed Lancer at engagement distance. The fight
 * starts at once, the drones go up through their hatches and guard the ship. Charge the drive and jump (or flee) to see them recalled
 * (`&charged`: the drive starts full). `&enemy=navy|drones[&depth=N]` fights a generated ship with defence drones instead of the Lancer (slice 2b).
 * The `upgrades` kind (`?scenario=upgrades`, app/upgradeScenario.ts) is the same fight with its own player set-up, against a navy ship.
 */
export function droneFight(kind: 'drones' | 'upgrades'): Scenario {
  return ({ sim, params, dispatch, setSpeed }) => {
    const g = sim.galaxy;
    const next = (galaxyIndex(g).adjacent.get(g.current) ?? []).map((e) => (e.a === g.current ? e.b : e.a))
      .find((id) => !nodeOf(sim, id)?.structures.length) ?? g.current;
    const homeShipC = () => sim.world.get(homeShip(sim), ShipC);
    const at = homeShipC();
    setSpeed(1);
    // Each step waits for the sim to get there, however slow the first frames are.
    const when = (ready: () => boolean, then: () => void): void => void (ready() ? then() : setTimeout(() => when(ready, then), 150));
    when(() => sim.tick >= 10, () => {
      if (next !== g.current) dispatch({ type: 'debug.galaxyTeleport', node: next });
      when(() => sim.sector.state === 'deploying' || next === g.current, () => {
        // Where the ship was, else the first clear one of a few open spots.
        const tries = [...(at ? [[at.x, at.y] as const] : []), [20, 50], [100, 60], [60, 90], [150, 40], [10, 10]] as const;
        const deploy = (i: number): void => {
          const p = tries[i];
          if (!p || sim.sector.state !== 'deploying') return;
          dispatch({ type: 'sector.deploy', x: p[0], y: p[1] });
          setTimeout(() => deploy(i + 1), 250); // the deploy screen holds the clock: wait in real time
        };
        deploy(0);
        when(() => sim.sector.state === 'active' && !!homeShipC(), () => {
          for (const cmd of kind === 'upgrades' ? upgradeScenarioCommands(sim) : droneScenarioCommands(sim, true)) dispatch(cmd);
          const mine = homeShipC();
          const t = (content.ships as Record<string, { rows: readonly string[] }>)['ship.lancer'];
          if (!mine || !t) return;
          const w = Math.max(...t.rows.map((r) => r.length)), h = t.rows.length;
          const clamp = (x: number, y: number) => ({ x: Math.max(0, Math.min(sim.sector.width - w, x)), y: Math.max(0, Math.min(sim.sector.height - h, y)) });
          // Engagement distance off the ship, trying the sides in turn until one is clear (a rock or a ship may be in the way).
          const spots = [
            clamp(mine.x + mine.width + 40, mine.y - 30), clamp(mine.x - w - 40, mine.y - 30),
            clamp(mine.x + mine.width + 40, mine.y + mine.height + 20), clamp(mine.x - w - 40, mine.y + mine.height + 20),
          ];
          const hostile = (): boolean => sim.world.query(ShipC).some((id) => sim.world.get(id, ShipC)?.faction === 'hostile');
          // `&enemy=navy` or `&enemy=drones` (rogue AI): a generated ship of that faction instead, with its drone bay and defence drones (`&depth=N`, default 6).
          const faction = params.get('enemy') ?? (kind === 'upgrades' ? 'navy' : null);
          const depth = Number(params.get('depth') ?? 6);
          const tryAt = (i: number): void => {
            const p = spots[i];
            if (!p || hostile()) return;
            if (faction) dispatch({ type: 'debug.spawnGenerated', faction: `faction.${faction}`, depth, seed: 5, cx: p.x + 37, cy: p.y + 14 });
            else dispatch({ type: 'debug.spawnEnemy', template: 'ship.lancer', x: p.x, y: p.y });
            const sent = sim.tick;
            when(() => sim.tick >= sent + 10, () => {
              if (kind === 'upgrades') {
                const enemy = sim.world.query(ShipC).find((id) => id !== homeShip(sim));
                if (enemy !== undefined) for (const cmd of enemyUpgradeCommands(sim, enemy)) dispatch(cmd);
              }
              tryAt(i + 1);
            });
          };
          // A moment later, so the drones are in their bays before the fight starts.
          const start = sim.tick;
          when(() => sim.tick >= start + 30, () => {
            tryAt(0);
            if (params.has('charged')) dispatch({ type: 'debug.chargeFtl' }); // `&charged`: ready to flee, to see the drones recalled
          });
        });
      });
    });
  };
}

/**
 * `?scenario=drones`: drone bays, three drones, a fire, a damaged console and hurt crew (app/droneScenario.ts). `&fight` is the fight above; `&breach`: repair
 * drones with metal and a hole in the hull; they go out through the hatch and seal it.
 */
export const drones: Scenario = (ctx) => {
  if (ctx.params.has('fight')) return droneFight('drones')(ctx);
  const { sim, dispatch, setSpeed, params } = ctx;
  setSpeed(1);
  // After a few ticks (rooms, power), however slow the first frames are.
  const setUp = (): void => {
    if (sim.tick < 10) return void setTimeout(setUp, params.has('breach') ? 150 : 200);
    for (const cmd of params.has('breach') ? droneScenarioCommands(sim, false, true) : droneScenarioCommands(sim)) dispatch(cmd);
  };
  setUp();
};
