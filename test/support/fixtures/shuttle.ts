import { raiderShip } from '../../../src/content/ships/raider';
import { starterShip } from '../../../src/content/ships/starter';
import { newGame } from '../../../src/sim/newGame';
import type { ContentRegistry, ShipTemplate } from '../../../src/sim/registry';
import type { Sim } from '../../../src/sim/sim';
import { content } from '../content';
import { CrewC } from '../../../src/sim/crew/components';
import type { SimEvent } from '../../../src/sim/events';
import { ModuleC } from '../../../src/sim/modules/components';
import { shipIdOf } from '../../../src/sim/regions';
import { AboardC, VehicleC } from '../../../src/sim/vehicles/components';
import { run } from '../run';
import { nth } from '../sim';
import { cachedWorld } from '../world';

/** The starter with a second point-defence module in the quarters. */
export const twoPdStarter: ShipTemplate = { ...starterShip, modules: [...starterShip.modules, { def: 'module.pointDefense', x: 18, y: 5, rot: 0 }] };

/** The raider with a missile launcher (and missiles) in place of one burst laser: the only raider that can shoot a shuttle. */
export const missileRaider: ShipTemplate = {
  ...raiderShip,
  modules: [
    ...raiderShip.modules.filter((m) => !(m.def === 'module.burstLaser' && m.x === 12)),
    { def: 'module.missileLauncher', x: 12, y: 10, rot: 0 },
    { def: 'module.storage', x: 3, y: 10, rot: 0, stock: [{ item: 'item.missile', count: 40 }] },
  ],
};

export const missileRaiderId = 'ship.missileRaider';
/** Content with the two-turret starter and the missile raider registered. */
export const shuttleContent: ContentRegistry = {
  ...content, ships: { ...content.ships, 'ship.starter': twoPdStarter, [missileRaiderId]: missileRaider },
};

/**
 * Starter (ship 1) facing a raider (ship 2) 80 tiles away, after 5 ticks. With the plain or the shuttle content it is built once per
 * worker and cloned per call; any other content builds fresh.
 */
export function shuttleSetup(seed = 1, reg: ContentRegistry = content, enemy = 'ship.raider'): Sim {
  const build = (): Sim => {
    const sim = newGame(seed, reg);
    sim.enqueue({ type: 'debug.spawnEnemy', template: enemy, x: 100, y: 50 });
    run(sim, 5);
    return sim;
  };
  const tag = reg === content ? 'content' : reg === shuttleContent ? 'shuttle' : null;
  return tag ? cachedWorld(`shuttle:${tag}:${seed}:${enemy}`, build) : build();
}

export const shuttleOf = (sim: Sim, shipId: number): number => sim.world.query(VehicleC).find((i) => sim.world.get(i, VehicleC)!.homeShip === nth(sim, shipId))!;
export const airlockOf = (sim: Sim, shipId: number): number =>
  sim.world.query(ModuleC).find((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === nth(sim, shipId) && sim.world.get(i, ModuleC)!.def === 'module.airlock')!;
export const roleOf = (sim: Sim, id: number): string => sim.world.get(id, CrewC)!.role;

/** Order `crew` aboard `vehicle` and step until they all are (at most 400 ticks); the events seen. */
export function embark(sim: Sim, crew: number[], vehicle: number): SimEvent[] {
  for (const c of crew) sim.enqueue({ type: 'vehicle.embark', crew: c, vehicle });
  return run(sim, 400, { until: (s) => crew.every((c) => s.world.has(c, AboardC)) });
}

/** Step one tick at a time, at most `max` ticks, until an event matching `found` is drained; every event seen (that tick's included). */
export function runTo(sim: Sim, max: number, found: (e: SimEvent) => boolean): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < max; i++) {
    const ev = run(sim, 1);
    out.push(...ev);
    if (ev.some(found)) break;
  }
  return out;
}
